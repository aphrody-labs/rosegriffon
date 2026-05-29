/**
 * parse-lua-all.ts — Parse ALL decompiled Lua scripts with tree-sitter-lua (WASM)
 *
 * Extracts from every .lua in decompiled/:
 * - Function calls (name, arguments, CRC32 dispatch)
 * - String constants
 * - Large numeric constants (CRC32 candidates)
 * - Table field access patterns
 * - Engine bridge calls (funcLuaCommand, funcLuaMenuCommand, etc.)
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { Language, Parser, Query } from "web-tree-sitter";

const DATA_DIR = resolve(import.meta.dirname, "../../../data");
const DECOMPILED_DIR = resolve(DATA_DIR, "lua_scripts/decompiled");
const OUT_DIR = resolve(DATA_DIR, "lua_scripts/analysis");

interface LuaFileAnalysis {
	file: string;
	tier: string;
	lines: number;
	functions: string[];
	calls: Record<string, number>; // call name → count
	strings: string[];
	crc32Numbers: string[]; // large decimals (>65535)
	engineCalls: { bridge: string; hash: string; line: number }[];
	tableAccess: string[]; // field access patterns like .position, .element
}

interface LuaGlobalIndex {
	totalFiles: number;
	totalLines: number;
	totalFunctions: number;
	totalUniqueStrings: number;
	totalEngineCalls: number;
	totalCRC32Numbers: number;
	parseTimeMs: number;
	files: LuaFileAnalysis[];
	// Aggregated
	allStrings: Record<string, string[]>; // string → [files]
	allCRC32: Record<string, string[]>; // number → [files]
	bridgeCalls: Record<string, Record<string, string[]>>; // bridge → hash → [files]
	allFunctions: Record<string, string[]>; // function name → [files]
	allTableFields: Record<string, number>; // field → count
}

function collectLuaFiles(dir: string, tier: string): { path: string; tier: string }[] {
	const results: { path: string; tier: string }[] = [];
	for (const entry of readdirSync(dir)) {
		const full = resolve(dir, entry);
		const stat = statSync(full);
		if (stat.isDirectory()) {
			results.push(...collectLuaFiles(full, entry));
		} else if (entry.endsWith(".lua")) {
			results.push({ path: full, tier });
		}
	}
	return results;
}

async function main() {
	await Parser.init();
	const parser = new Parser();
	const Lua = await Language.load(resolve(DATA_DIR, "grammars/tree-sitter-lua.wasm"));
	parser.setLanguage(Lua);

	const files = collectLuaFiles(DECOMPILED_DIR, "root");
	console.log(`Found ${files.length} Lua files to parse`);

	// Queries
	const fnDeclQ = new Query(Lua, "(function_declaration name: (_) @fn)");
	const callQ = new Query(Lua, "(function_call name: (_) @call)");
	const strQ = new Query(Lua, "(string) @s");
	const numQ = new Query(Lua, "(number) @n");
	const fieldQ = new Query(Lua, "(dot_index_expression field: (identifier) @field)");

	const allStrings: Record<string, string[]> = {};
	const allCRC32: Record<string, string[]> = {};
	const bridgeCalls: Record<string, Record<string, string[]>> = {};
	const allFunctions: Record<string, string[]> = {};
	const allTableFields: Record<string, number> = {};
	const analyses: LuaFileAnalysis[] = [];

	let totalLines = 0;
	let totalFunctions = 0;
	let totalEngineCalls = 0;
	let totalParseMs = 0;

	const BRIDGE_NAMES = [
		"funcLuaCommand",
		"funcLuaMenuCommand",
		"funcLuaActionCommand",
		"funcLuaCameraCommand",
		"funcLuaEffectCommand",
		"funcLuaSpTacticsCommand",
		"funcLuaMenuNetworkCommand",
		"funcLuaMenuMultiplayCommand",
		"funcLuaMenuDictCommand",
		"funcLuaMenuMapCommand",
	];

	for (let i = 0; i < files.length; i++) {
		const { path: filePath, tier } = files[i];
		const fname = basename(filePath);
		const src = readFileSync(filePath, "utf-8");
		const lineCount = src.split("\n").length;
		totalLines += lineCount;

		const t0 = performance.now();
		const tree = parser.parse(src);
		totalParseMs += performance.now() - t0;
		if (!tree) continue;
		const root = tree.rootNode;

		// Functions
		const fnMatches = fnDeclQ.matches(root);
		const funcNames = fnMatches.map((m) => m.captures[0].node.text);
		totalFunctions += funcNames.length;
		for (const fn of funcNames) {
			if (!allFunctions[fn]) allFunctions[fn] = [];
			allFunctions[fn].push(fname);
		}

		// Calls
		const callMatches = callQ.matches(root);
		const callCounts: Record<string, number> = {};
		for (const m of callMatches) {
			const name = m.captures[0].node.text;
			callCounts[name] = (callCounts[name] || 0) + 1;
		}

		// Strings
		const strMatches = strQ.matches(root);
		const strings: string[] = [];
		for (const m of strMatches) {
			const s = m.captures[0].node.text.replace(/^["']|["']$/g, "");
			if (s.length > 0) {
				strings.push(s);
				if (!allStrings[s]) allStrings[s] = [];
				if (!allStrings[s].includes(fname)) allStrings[s].push(fname);
			}
		}

		// Numbers — CRC32 candidates (unsigned 32-bit range)
		const numMatches = numQ.matches(root);
		const crc32Numbers: string[] = [];
		for (const m of numMatches) {
			const t = m.captures[0].node.text;
			const v = Number(t);
			if (v > 65535 && v <= 0xffffffff) {
				crc32Numbers.push(t);
				if (!allCRC32[t]) allCRC32[t] = [];
				if (!allCRC32[t].includes(fname)) allCRC32[t].push(fname);
			}
		}

		// Table field access
		const fieldMatches = fieldQ.matches(root);
		const tableAccess: string[] = [];
		for (const m of fieldMatches) {
			const field = m.captures[0].node.text;
			tableAccess.push(field);
			allTableFields[field] = (allTableFields[field] || 0) + 1;
		}

		// Engine bridge calls — match patterns like (upval).funcLuaCommand or funcLuaCommand
		const engineCalls: { bridge: string; hash: string; line: number }[] = [];
		for (const [callName, _count] of Object.entries(callCounts)) {
			for (const bridge of BRIDGE_NAMES) {
				if (callName.includes(bridge)) {
					// Try to find the hash argument from the source
					const bridgeRegex = new RegExp(`${bridge}\\s*\\(\\s*(\\d+)`, "g");
					let match: RegExpExecArray | null = bridgeRegex.exec(src);
					while (match !== null) {
						const hash = match[1];
						const line = src.substring(0, match.index).split("\n").length;
						engineCalls.push({ bridge, hash, line });
						totalEngineCalls++;

						if (!bridgeCalls[bridge]) bridgeCalls[bridge] = {};
						if (!bridgeCalls[bridge][hash]) bridgeCalls[bridge][hash] = [];
						if (!bridgeCalls[bridge][hash].includes(fname)) {
							bridgeCalls[bridge][hash].push(fname);
						}
						match = bridgeRegex.exec(src);
					}
					break;
				}
			}
		}

		analyses.push({
			file: fname,
			tier,
			lines: lineCount,
			functions: funcNames,
			calls: callCounts,
			strings: [...new Set(strings)],
			crc32Numbers: [...new Set(crc32Numbers)],
			engineCalls,
			tableAccess: [...new Set(tableAccess)],
		});

		if ((i + 1) % 100 === 0 || i === files.length - 1) {
			console.log(
				`  Parsed ${i + 1}/${files.length} files (${totalLines} lines, ${totalFunctions} functions)`
			);
		}
	}

	const index: LuaGlobalIndex = {
		totalFiles: files.length,
		totalLines,
		totalFunctions,
		totalUniqueStrings: Object.keys(allStrings).length,
		totalEngineCalls,
		totalCRC32Numbers: Object.keys(allCRC32).length,
		parseTimeMs: Math.round(totalParseMs),
		files: analyses,
		allStrings,
		allCRC32,
		bridgeCalls,
		allFunctions,
		allTableFields,
	};

	console.log("\n=== LUA RESULTS ===");
	console.log(`  Files: ${index.totalFiles}`);
	console.log(`  Lines: ${index.totalLines}`);
	console.log(`  Functions: ${index.totalFunctions}`);
	console.log(`  Unique strings: ${index.totalUniqueStrings}`);
	console.log(`  CRC32 candidates: ${index.totalCRC32Numbers}`);
	console.log(`  Engine bridge calls: ${index.totalEngineCalls}`);
	console.log(`  Parse time: ${(totalParseMs / 1000).toFixed(1)}s`);

	// Bridge breakdown
	for (const [bridge, hashes] of Object.entries(bridgeCalls)) {
		console.log(`    ${bridge}: ${Object.keys(hashes).length} unique hashes`);
	}

	// Top table fields
	const topFields = Object.entries(allTableFields)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 30);
	console.log(`  Top table fields: ${topFields.map(([f, c]) => `${f}(${c})`).join(", ")}`);

	// Write
	const outPath = resolve(OUT_DIR, "lua-global-index.json");
	writeFileSync(outPath, JSON.stringify(index, null, 0));
	console.log(`\nWrote ${outPath} (${(readFileSync(outPath).length / 1024 / 1024).toFixed(1)} MB)`);

	// Write compact summary
	const summary = {
		stats: {
			files: index.totalFiles,
			lines: index.totalLines,
			functions: index.totalFunctions,
			uniqueStrings: index.totalUniqueStrings,
			crc32Candidates: index.totalCRC32Numbers,
			engineCalls: index.totalEngineCalls,
		},
		bridgeSummary: Object.fromEntries(
			Object.entries(bridgeCalls).map(([bridge, hashes]) => [
				bridge,
				{
					uniqueHashes: Object.keys(hashes).length,
					totalCalls: Object.values(hashes).reduce((s, a) => s + a.length, 0),
				},
			])
		),
		topStrings: Object.entries(allStrings)
			.sort((a, b) => b[1].length - a[1].length)
			.slice(0, 200)
			.map(([s, files]) => ({ string: s, fileCount: files.length })),
		topCRC32: Object.entries(allCRC32)
			.sort((a, b) => b[1].length - a[1].length)
			.slice(0, 200)
			.map(([n, files]) => ({
				number: n,
				hex: `0x${(Number(n) >>> 0).toString(16).toUpperCase().padStart(8, "0")}`,
				fileCount: files.length,
			})),
		topTableFields: topFields.map(([f, c]) => ({ field: f, count: c })),
		gameDataStrings: Object.entries(allStrings)
			.filter(([s]) =>
				/chara|skill|soccer|team|formation|rarity|element|position|series|star|scout|gacha|summon|ability|training|quest|item|universe|filter|menu/i.test(
					s
				)
			)
			.map(([s, files]) => ({ string: s, files })),
	};
	const summaryPath = resolve(OUT_DIR, "lua-summary.json");
	writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
	console.log(`Wrote ${summaryPath}`);
}

main();
