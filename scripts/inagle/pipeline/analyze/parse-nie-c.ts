/**
 * parse-nie-c.ts — Parse nie.c (4.15M lines, 127MB Ghidra decompilation) with tree-sitter-c
 *
 * Extracts:
 * - All 51k+ function definitions (name, address, params, line range)
 * - All DAT_* globals with usage context
 * - All string literals
 * - All hex constants (CRC32 candidates)
 * - All virtual dispatch calls (vtable patterns)
 * - Cross-references: which functions call which, string usage per function
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import Parser from "tree-sitter";
import C from "tree-sitter-c";

const DATA_DIR = resolve(import.meta.dirname, "../../../data");
const NIE_C_PATH = resolve(DATA_DIR, "../../iecode/ghidra/nie.c");
const OUT_DIR = resolve(DATA_DIR, "lua_scripts/analysis");

interface FunctionInfo {
	name: string;
	returnType: string;
	params: string;
	startLine: number;
	endLine: number;
	callees: string[];
	strings: string[];
	hexConstants: string[];
	datRefs: string[];
}

interface NieCIndex {
	totalLines: number;
	totalFunctions: number;
	totalGlobals: number;
	totalStrings: number;
	parseTimeMs: number;
	queryTimeMs: number;
	functions: Record<string, FunctionInfo>;
	globals: Record<string, { refs: number; firstLine: number }>;
	allStrings: Record<string, string[]>; // string → [function names that use it]
	hexConstants: Record<string, string[]>; // hex → [function names]
	rttClasses: string[];
}

function main() {
	if (!existsSync(NIE_C_PATH)) {
		console.error("nie.c not found at", NIE_C_PATH);
		process.exit(1);
	}

	console.log("Loading nie.c...");
	const src = readFileSync(NIE_C_PATH, "utf-8");
	const lines = src.split("\n");
	console.log(`  ${lines.length} lines, ${(src.length / 1024 / 1024).toFixed(1)} MB`);

	const parser = new Parser();
	parser.setLanguage(C);

	// Parse in chunks of 200k lines to avoid memory issues, then merge
	const CHUNK_SIZE = 200_000;
	const functions: Record<string, FunctionInfo> = {};
	const globals: Record<string, { refs: number; firstLine: number }> = {};
	const allStrings: Record<string, string[]> = {};
	const hexConstants: Record<string, string[]> = {};
	const rttiClasses: Set<string> = new Set();

	const fnQuery = new Parser.Query(
		C,
		"(function_definition type: (_) @ret declarator: (function_declarator declarator: (identifier) @fn parameters: (parameter_list) @params) body: (compound_statement) @body)"
	);
	const idQuery = new Parser.Query(C, "(identifier) @id");
	const strQuery = new Parser.Query(C, "(string_literal) @s");
	const numQuery = new Parser.Query(C, "(number_literal) @n");
	const callQuery = new Parser.Query(C, "(call_expression function: (identifier) @callee)");

	let totalParseMs = 0;
	let totalQueryMs = 0;

	// Find where functions start (skip typedefs/structs at top)
	let funcStartLine = 0;
	for (let i = 0; i < Math.min(lines.length, 100_000); i++) {
		if (
			/^(void|undefined|uint|int|long|ulong|ulonglong|longlong|bool|byte|short|ushort|float|double) (FUN_|_)/.test(
				lines[i]
			)
		) {
			funcStartLine = i;
			break;
		}
	}
	console.log(`  Functions start at line ${funcStartLine}`);

	// Parse typedef section separately (quick)
	const typedefChunk = lines.slice(0, funcStartLine).join("\n");
	const typedefTree = parser.parse(typedefChunk);
	const typedefStrings = strQuery.matches(typedefTree.rootNode);
	for (const m of typedefStrings) {
		const s = m.captures[0].node.text.replace(/^"|"$/g, "");
		if (s.includes("::")) rttiClasses.add(s);
	}
	console.log(`  Typedefs: ${funcStartLine} lines, ${rttiClasses.size} RTTI strings`);

	// Parse function sections in chunks
	const totalChunks = Math.ceil((lines.length - funcStartLine) / CHUNK_SIZE);
	console.log(`  Parsing ${totalChunks} chunks of ${CHUNK_SIZE} lines...`);

	for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
		const startLine = funcStartLine + chunkIdx * CHUNK_SIZE;
		const endLine = Math.min(startLine + CHUNK_SIZE, lines.length);
		const chunk = lines.slice(startLine, endLine).join("\n");

		const t0 = performance.now();
		const tree = parser.parse(chunk);
		const t1 = performance.now();
		totalParseMs += t1 - t0;

		// Extract functions
		const fnMatches = fnQuery.matches(tree.rootNode);
		const _t2 = performance.now();

		for (const m of fnMatches) {
			const retNode = m.captures.find((c) => c.name === "ret")!.node;
			const fnNode = m.captures.find((c) => c.name === "fn")!.node;
			const paramsNode = m.captures.find((c) => c.name === "params")!.node;
			const bodyNode = m.captures.find((c) => c.name === "body")!.node;

			const fnName = fnNode.text;
			const fnStartLine = startLine + fnNode.startPosition.row;
			const fnEndLine = startLine + bodyNode.endPosition.row;

			// Get callees within this function body
			const callMatches = callQuery.matches(bodyNode);
			const callees: string[] = [];
			for (const cm of callMatches) {
				const callee = cm.captures[0].node.text;
				if (callee !== fnName && !callees.includes(callee)) callees.push(callee);
			}

			// Get strings within body
			const strMatches = strQuery.matches(bodyNode);
			const strs: string[] = [];
			for (const sm of strMatches) {
				const s = sm.captures[0].node.text.replace(/^"|"$/g, "");
				if (s.length > 1) {
					strs.push(s);
					if (!allStrings[s]) allStrings[s] = [];
					if (!allStrings[s].includes(fnName)) allStrings[s].push(fnName);
					if (s.includes("::")) rttiClasses.add(s);
				}
			}

			// Get hex constants (CRC32 candidates)
			const numMatches = numQuery.matches(bodyNode);
			const hexes: string[] = [];
			for (const nm of numMatches) {
				const t = nm.captures[0].node.text;
				if (t.startsWith("0x") && t.length >= 6) {
					hexes.push(t);
					if (!hexConstants[t]) hexConstants[t] = [];
					if (!hexConstants[t].includes(fnName)) hexConstants[t].push(fnName);
				}
			}

			// Get DAT_ references
			const idMatches = idQuery.matches(bodyNode);
			const datRefs: string[] = [];
			for (const im of idMatches) {
				const id = im.captures[0].node.text;
				if (id.startsWith("DAT_")) {
					if (!datRefs.includes(id)) datRefs.push(id);
					if (!globals[id]) globals[id] = { refs: 0, firstLine: fnStartLine };
					globals[id].refs++;
				}
			}

			functions[fnName] = {
				name: fnName,
				returnType: retNode.text,
				params: paramsNode.text,
				startLine: fnStartLine,
				endLine: fnEndLine,
				callees: callees.slice(0, 50), // cap at 50
				strings: strs.slice(0, 100),
				hexConstants: hexes.slice(0, 100),
				datRefs: datRefs.slice(0, 50),
			};
		}

		const t3 = performance.now();
		totalQueryMs += t3 - t1;

		const fnCount = Object.keys(functions).length;
		console.log(
			`  Chunk ${chunkIdx + 1}/${totalChunks}: lines ${startLine}-${endLine}, +${fnMatches.length} functions (total: ${fnCount})`
		);
	}

	// Build index
	const index: NieCIndex = {
		totalLines: lines.length,
		totalFunctions: Object.keys(functions).length,
		totalGlobals: Object.keys(globals).length,
		totalStrings: Object.keys(allStrings).length,
		parseTimeMs: Math.round(totalParseMs),
		queryTimeMs: Math.round(totalQueryMs),
		functions,
		globals,
		allStrings,
		hexConstants,
		rttClasses: [...rttiClasses].sort(),
	};

	console.log("\n=== RESULTS ===");
	console.log(`  Functions: ${index.totalFunctions}`);
	console.log(`  Globals: ${index.totalGlobals}`);
	console.log(`  Unique strings: ${index.totalStrings}`);
	console.log(`  Hex constants: ${Object.keys(hexConstants).length}`);
	console.log(`  RTTI classes: ${rttiClasses.size}`);
	console.log(`  Parse time: ${(totalParseMs / 1000).toFixed(1)}s`);
	console.log(`  Query time: ${(totalQueryMs / 1000).toFixed(1)}s`);

	// Write full index
	const outPath = resolve(OUT_DIR, "nie-c-index.json");
	writeFileSync(outPath, JSON.stringify(index, null, 0));
	console.log(`\nWrote ${outPath} (${(readFileSync(outPath).length / 1024 / 1024).toFixed(1)} MB)`);

	// Write compact summary (without full function bodies data)
	const summary = {
		totalLines: index.totalLines,
		totalFunctions: index.totalFunctions,
		totalGlobals: index.totalGlobals,
		totalStrings: index.totalStrings,
		rttClasses: index.rttClasses,
		topCalledFunctions: Object.entries(functions)
			.map(([name, _f]) => ({
				name,
				calledBy: Object.values(functions).filter((f2) => f2.callees.includes(name)).length,
			}))
			.sort((a, b) => b.calledBy - a.calledBy)
			.slice(0, 100),
		topReferencedGlobals: Object.entries(globals)
			.sort((a, b) => b[1].refs - a[1].refs)
			.slice(0, 100)
			.map(([name, info]) => ({ name, ...info })),
		gameDataStrings: Object.entries(allStrings)
			.filter(
				([s]) =>
					s.includes("GDS") ||
					s.includes("Config") ||
					s.includes("soccer") ||
					s.includes("chara") ||
					s.includes("skill") ||
					s.includes("Lua") ||
					s.includes("Star") ||
					s.includes("rarity") ||
					s.includes("scout") ||
					s.includes("item") ||
					s.includes("team") ||
					s.includes("formation") ||
					s.includes("universe") ||
					s.includes("quest") ||
					s.includes("battle")
			)
			.map(([s, fns]) => ({ string: s, usedIn: fns })),
	};

	const summaryPath = resolve(OUT_DIR, "nie-c-summary.json");
	writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
	console.log(`Wrote ${summaryPath}`);
}

main();
