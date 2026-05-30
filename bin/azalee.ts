#!/usr/bin/env bun
/**
 * CLI Azalée - Inazuma Eleven Victory Road Monorepo Toolbelt
 *
 * Utilitaire ultra-rapide en Bun native API pour le traitement de données, RAG,
 * traductions, requêtes SQL/Redis et diagnostics.
 *
 * Spécialement optimisé pour l'interaction via agents IA (Claude/Gemini).
 */

import { Command } from "commander";
import { existsSync, readdirSync, readFileSync, appendFileSync } from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { createInagleService } from "../packages/inagle/src/service.ts";
import { getRedisClient, cache } from "../packages/db/src/redis.ts";
import { queryRag } from "../packages/cron/src/tasks/ie-crawl/rag.ts";

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const program = new Command();

program
	.name("azalee")
	.description("CLI d'Azalée pour Inazuma Eleven: Victory Road")
	.version("1.0.0");

// Helper ANSI colors for console styling (disabled automatically if not in a TTY or if NO_COLOR is set)
const isColorEnabled = process.stdout.isTTY && !process.env.NO_COLOR;
const colors = {
	reset: isColorEnabled ? "\x1b[0m" : "",
	green: isColorEnabled ? "\x1b[32m" : "",
	yellow: isColorEnabled ? "\x1b[33m" : "",
	blue: isColorEnabled ? "\x1b[34m" : "",
	magenta: isColorEnabled ? "\x1b[35m" : "",
	cyan: isColorEnabled ? "\x1b[36m" : "",
	red: isColorEnabled ? "\x1b[31m" : "",
	bold: isColorEnabled ? "\x1b[1m" : "",
};

// Save original console outputs to handle clean JSON silencing
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

function suppressLogs(json: boolean) {
	if (json) {
		console.log = () => {};
		console.warn = () => {};
		console.error = () => {};
	}
}

function restoreLogs(json: boolean) {
	if (json) {
		console.log = originalLog;
		console.warn = originalWarn;
		console.error = originalError;
	}
}

// ─── UTILS ───────────────────────────────────────────────────────────

function cleanJapanese(text: string): string {
	return text.replace(/\[([^/\]]+)\/[^\]]+\]/g, "$1").trim();
}

function escapeRegExp(str: string) {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderAsciiTable(rows: any[]): string {
	if (!rows || rows.length === 0) return "Aucun résultat (0 ligne).";
	const keys = Object.keys(rows[0]);
	
	const stringifiedRows = rows.map(row => {
		const newRow: Record<string, string> = {};
		for (const key of keys) {
			const val = row[key];
			if (val === null || val === undefined) {
				newRow[key] = "NULL";
			} else if (typeof val === "object") {
				newRow[key] = JSON.stringify(val);
			} else {
				newRow[key] = String(val);
			}
			if (newRow[key].length > 45) {
				newRow[key] = newRow[key].substring(0, 42) + "...";
			}
		}
		return newRow;
	});

	const colWidths = keys.map(k => Math.max(k.length, ...stringifiedRows.map(r => r[k].length)));
	
	const topBorder = "┌─" + colWidths.map(w => "─".repeat(w)).join("─┬─") + "─┐";
	const headerLine = "│ " + keys.map((k, i) => k.padEnd(colWidths[i])).join(" │ ") + " │";
	const midBorder = "├─" + colWidths.map(w => "─".repeat(w)).join("─┼─") + "─┤";
	const bottomBorder = "└─" + colWidths.map(w => "─".repeat(w)).join("─┴─") + "─┘";
	
	const formattedRows = stringifiedRows.map(r => 
		"│ " + keys.map((k, i) => r[k].padEnd(colWidths[i])).join(" │ ") + " │"
	);

	return [topBorder, headerLine, midBorder, ...formattedRows, bottomBorder].join("\n");
}

const containsJapanese = (text: string) =>
	/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f]/.test(text);

async function translateWithGoogle(text: string, from: string, to: string): Promise<string> {
	if (!text.trim()) return "";
	try {
		const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`;
		const res = await fetch(url);
		if (res.ok) {
			const data = (await res.json()) as any;
			if (data && data[0]) {
				return data[0].map((x: any) => x[0]).join("");
			}
		}
	} catch (e) {
		console.error("Google Translation API Error:", e);
	}
	return text;
}

// Helper to find latest SQLite database
function getSqlitePath(): string | null {
	const dirs = [
		path.resolve(process.cwd(), "apps/azalee/data/backups"),
		path.resolve(process.cwd(), "data/backups"),
		"/home/ubuntu/rg/apps/azalee/data/backups",
	];

	for (const dir of dirs) {
		try {
			if (!existsSync(dir)) continue;
			const files = readdirSync(dir);
			const sqliteFiles = files
				.filter((f) => f.startsWith("supabase-") && f.endsWith(".sqlite"))
				.sort((a, b) => b.localeCompare(a));

			if (sqliteFiles.length > 0) {
				return path.join(dir, sqliteFiles[0]);
			}
		} catch {
			// ignore
		}
	}
	return null;
}

// Helper to resolve inputs from parameter OR standard input if piped
async function getOrReadInput(arg: string | undefined): Promise<string> {
	if (arg !== undefined && arg !== null && arg.trim() !== "") {
		return arg;
	}
	if (!process.stdin.isTTY) {
		return await Bun.stdin.text();
	}
	return "";
}

// Helper to get skill name from ID
function getSkillName(svc: any, skillId: string): string {
	if (!skillId) return "N/A";
	const s = svc.skills.get(skillId) || svc.skills.passiveGet(skillId) || svc.skills.auraGet(skillId);
	return s ? (s.displayName || s.name_FR || s.name_EN || s.name_JA || skillId) : skillId;
}

const PERSONALITY_NAMES: Record<number, string> = {
	0: "Inconnu",
	1: "Doux",
	2: "Cool",
	3: "Passionné",
	4: "Timide",
	5: "Mature",
	6: "Joyeux",
	7: "Sérieux",
	8: "Sauvage",
	9: "Mystérieux",
	10: "Élégant",
	11: "Espiègle",
};

// Helper to render character profiler card
function renderCharaProfile(chara: any, svc: any): string {
	const lines: string[] = [];
	const nameFr = chara.names?.fr || "N/A";
	const nameEn = chara.names?.en || "N/A";
	const nameJa = chara.names?.ja || "N/A";
	const roma = chara.romanized?.full || "N/A";
	const genderStr = chara.gender === 1 ? "Féminin" : "Masculin";
	const controllableStr = chara.isControllable ? "Oui" : "Non";
	
	const personality = chara.personalityType !== undefined 
		? (PERSONALITY_NAMES[chara.personalityType] || `Type ${chara.personalityType}`)
		: "Inconnu";
		
	const firstPerson = chara.firstPerson?.ja || chara.firstPerson?.fr || "N/A";
	const secondPerson = chara.secondPersonMale?.ja || chara.secondPersonMale?.fr || "N/A";
	
	lines.push(`┌──────────────────────────────────────────────────────────────────────────────┐`);
	lines.push(`│ ${colors.bold}${colors.green}${nameFr.padEnd(40)}${colors.reset} │ ${colors.cyan}ID: ${chara.charaId.padEnd(28)}${colors.reset} │`);
	lines.push(`│ ${colors.yellow}Anglais: ${nameEn.padEnd(31)}${colors.reset} │ ${colors.yellow}Japonais: ${nameJa.padEnd(29)}${colors.reset} │`);
	lines.push(`│ ${colors.yellow}Romanisé: ${roma.padEnd(30)}${colors.reset} │ ${colors.yellow}Genre: ${genderStr.padEnd(32)}${colors.reset} │`);
	lines.push(`├──────────────────────────────────────────────────────────────────────────────┤`);
	lines.push(`│ ${colors.bold}Affiliation :${colors.reset} ${(chara.teamName || "Aucune").padEnd(61)} │`);
	lines.push(`│ ${colors.bold}Contrôlable :${colors.reset} ${controllableStr.padEnd(14)} │ ${colors.bold}Personnalité :${colors.reset} ${personality.padEnd(30)} │`);
	lines.push(`│ ${colors.bold}Je :${colors.reset} ${firstPerson.padEnd(22)} │ ${colors.bold}Tu (Masc) :${colors.reset} ${secondPerson.padEnd(33)} │`);
	lines.push(`├──────────────────────────────────────────────────────────────────────────────┤`);
	
	if (chara.descriptions?.fr || chara.descriptions?.en) {
		const desc = chara.descriptions.fr || chara.descriptions.en;
		lines.push(`│ ${colors.bold}Description :${colors.reset}${" ".repeat(63)} │`);
		const words = desc.split(" ");
		let currentLine = "│   ";
		for (const word of words) {
			if ((currentLine + word).length > 74) {
				lines.push(currentLine.padEnd(79) + "│");
				currentLine = "│   " + word + " ";
			} else {
				currentLine += word + " ";
			}
		}
		if (currentLine !== "│   ") {
			lines.push(currentLine.padEnd(79) + "│");
		}
		lines.push(`├──────────────────────────────────────────────────────────────────────────────┤`);
	}

	if (chara.variants && chara.variants.length > 0) {
		lines.push(`│ ${colors.bold}${colors.magenta}Variantes de cartes (${chara.variants.length}) :${colors.reset}${" ".repeat(47)} │`);
		for (const [idx, v] of chara.variants.entries()) {
			const el = v.element || "N/A";
			const pos = v.position || "N/A";
			const rar = v.rarity || "N/A";
			
			lines.push(`│   [${idx + 1}] Element: ${el.padEnd(10)} | Position: ${pos.padEnd(4)} | Rareté: ${rar.padEnd(14)}        │`);
			if (v.stats?.lv99) {
				const s = v.stats.lv99;
				lines.push(`│       ${colors.cyan}Kick: ${s.kick.toString().padEnd(4)} Dribble: ${s.control.toString().padEnd(4)} Block: ${s.pressure.toString().padEnd(4)} Catch: ${s.technique.toString().padEnd(4)} Speed: ${s.agility.toString().padEnd(4)}${colors.reset} │`);
			}
			if (v.skills && v.skills.length > 0) {
				const skillNames = v.skills.map((sk: any) => {
					const name = getSkillName(svc, sk.skillId);
					return `${name} (Lv.${sk.learnLevel})`;
				}).join(", ");
				lines.push(`│       ${colors.blue}Super Moves:${colors.reset} ${skillNames.substring(0, 58)}${skillNames.length > 58 ? "..." : ""} │`);
			}
		}
	}
	
	lines.push(`└──────────────────────────────────────────────────────────────────────────────┘`);
	return lines.join("\n");
}

let isReplMode = false;
let pendingSelection: {
	type: "chara" | "skill" | "item" | "team";
	matches: any[];
} | null = null;
let activeRl: any = null;

function renderSkillProfile(skill: any, svc: any): string {
	const lines: string[] = [];
	const displayName = skill.displayName || skill.name_FR || skill.name_EN || "N/A";
	const typeStr = (skill.skillType || "Technique").toUpperCase();
	const idStr = skill.skillIDStr || skill.auraId || skill.passiveId || "N/A";
	
	lines.push(`┌──────────────────────────────────────────────────────────────────────────────┐`);
	lines.push(`│ [${colors.bold}${colors.green}${typeStr}${colors.reset}] ${colors.bold}${displayName.padEnd(50)}${colors.reset} │ ${colors.cyan}ID: ${idStr.padEnd(10)}${colors.reset} │`);
	
	if (skill.desc_FR || skill.description_FR || skill.desc_EN) {
		const desc = skill.desc_FR || skill.description_FR || skill.desc_EN;
		lines.push(`├──────────────────────────────────────────────────────────────────────────────┤`);
		lines.push(`│ ${colors.bold}Description :${colors.reset}${" ".repeat(63)} │`);
		const words = desc.split(" ");
		let currentLine = "│   ";
		for (const word of words) {
			if ((currentLine + word).length > 74) {
				lines.push(currentLine.padEnd(79) + "│");
				currentLine = "│   " + word + " ";
			} else {
				currentLine += word + " ";
			}
		}
		if (currentLine !== "│   ") {
			lines.push(currentLine.padEnd(79) + "│");
		}
	}
	
	if (skill.power_max !== undefined) {
		lines.push(`├──────────────────────────────────────────────────────────────────────────────┤`);
		const power = skill.power_max;
		const cost = skill.cost || 0;
		const element = skill.elementName?.fr || "N/A";
		const category = skill.categoryName?.fr || "N/A";
		lines.push(`│ Puissance Max : ${power.toString().padEnd(10)} | Coût : ${cost.toString().padEnd(8)} | Élément : ${element.padEnd(10)} | Cat : ${category.padEnd(8)} │`);
	}
	lines.push(`└──────────────────────────────────────────────────────────────────────────────┘`);
	return lines.join("\n");
}

const ITEM_CATEGORY_DISPLAY_NAMES: Record<string, string> = {
	consume: "Consommable",
	shoes: "Chaussures",
	misanga: "Bracelet",
	accessory: "Accessoire",
	special: "Spécial",
	formation: "Formation",
	special_tactics: "Tactique spéciale",
	super_tactics: "Super tactique",
	special_skill: "Compétence spéciale",
	title: "Titre",
	fashion: "Mode",
	costume: "Costume",
	emblem: "Emblème",
	unique: "Unique",
	craft_obj: "Matériau",
	animal: "Animal",
	kizuna_link: "Lien Kizuna",
	name_plate: "Plaque",
	performance: "Performance",
	important: "Objet clé",
};

function renderItemProfile(item: any): string {
	const lines: string[] = [];
	const nameFr = item.names?.fr || item.name || "N/A";
	const nameEn = item.names?.en || "N/A";
	const nameJa = item.names?.ja || "N/A";
	const code = item.internalCode || "N/A";
	const cat = ITEM_CATEGORY_DISPLAY_NAMES[item.category] || item.category || "N/A";
	const priceStr = item.price ? `${item.price} Ptz` : "N/A";

	lines.push(`┌──────────────────────────────────────────────────────────────────────────────┐`);
	lines.push(`│ ${colors.bold}${colors.green}${nameFr.padEnd(40)}${colors.reset} │ ${colors.cyan}ID: ${item.itemId.padEnd(28)}${colors.reset} │`);
	lines.push(`│ ${colors.yellow}Anglais: ${nameEn.padEnd(31)}${colors.reset} │ ${colors.yellow}Japonais: ${nameJa.padEnd(29)}${colors.reset} │`);
	lines.push(`│ ${colors.yellow}Code: ${code.padEnd(34)}${colors.reset} │ ${colors.yellow}Catégorie: ${cat.padEnd(28)}${colors.reset} │`);
	lines.push(`├──────────────────────────────────────────────────────────────────────────────┤`);
	lines.push(`│ Prix d'achat: ${priceStr.padEnd(64)} │`);

	if (item.stats) {
		lines.push(`│ ${colors.bold}Statistiques octroyées :${colors.reset}${" ".repeat(53)} │`);
		lines.push(`│   Stat 1: ${String(item.stats.stat1).padEnd(10)} | Stat 2: ${String(item.stats.stat2).padEnd(44)} │`);
	}

	if (item.shops && (item.shops.fr?.length > 0 || item.shops.en?.length > 0)) {
		const shops = item.shops.fr || item.shops.en;
		lines.push(`│ Disponibilité : ${shops.join(", ").substring(0, 58).padEnd(60)} │`);
	}

	if (item.descriptions?.fr || item.descriptions?.en) {
		const desc = item.descriptions.fr || item.descriptions.en;
		lines.push(`├──────────────────────────────────────────────────────────────────────────────┤`);
		lines.push(`│ ${colors.bold}Description :${colors.reset}${" ".repeat(63)} │`);
		const words = desc.split(" ");
		let currentLine = "│   ";
		for (const word of words) {
			if ((currentLine + word).length > 74) {
				lines.push(currentLine.padEnd(79) + "│");
				currentLine = "│   " + word + " ";
			} else {
				currentLine += word + " ";
			}
		}
		if (currentLine !== "│   ") {
			lines.push(currentLine.padEnd(79) + "│");
		}
	}

	lines.push(`└──────────────────────────────────────────────────────────────────────────────┘`);
	return lines.join("\n");
}

function renderTeamProfile(team: any): string {
	const lines: string[] = [];
	const nameFr = team.name_FR || team.displayName || team.name || "N/A";
	const nameEn = team.name_EN || "N/A";
	const nameJa = team.name_JA || "N/A";
	const id = team.teamId || "N/A";
	const code = team.teamIdStr || "N/A";

	lines.push(`┌──────────────────────────────────────────────────────────────────────────────┐`);
	lines.push(`│ ${colors.bold}${colors.green}${nameFr.padEnd(40)}${colors.reset} │ ${colors.cyan}ID: ${id.padEnd(28)}${colors.reset} │`);
	lines.push(`│ ${colors.yellow}Anglais: ${nameEn.padEnd(31)}${colors.reset} │ ${colors.yellow}Japonais: ${nameJa.padEnd(29)}${colors.reset} │`);
	lines.push(`│ ${colors.yellow}Code: ${code.padEnd(34)}${colors.reset} │${" ".repeat(30)} │`);
	lines.push(`├──────────────────────────────────────────────────────────────────────────────┤`);

	if (team.uniforms && team.uniforms.length > 0) {
		lines.push(`│ ${colors.bold}Kits / Uniformes (${team.uniforms.length}) :${colors.reset}${" ".repeat(53)} │`);
		for (const [idx, u] of team.uniforms.slice(0, 5).entries()) {
			const kitId = u.uniformId || "N/A";
			const modelName = u.modelName || "N/A";
			lines.push(`│   [${idx + 1}] ID Uniforme: ${String(kitId).padEnd(10)} | Modèle: ${modelName.padEnd(34)} │`);
		}
		if (team.uniforms.length > 5) {
			lines.push(`│   ... et ${team.uniforms.length - 5} autres kits.                                              │`);
		}
	}

	if (team.seasons && team.seasons.length > 0) {
		lines.push(`│ Saisons / Événements: ${team.seasons.join(", ").substring(0, 56).padEnd(58)} │`);
	}

	lines.push(`└──────────────────────────────────────────────────────────────────────────────┘`);
	return lines.join("\n");
}

function parseReplArgs(line: string): string[] {
	const args: string[] = [];
	let current = "";
	let inQuotes = false;
	let quoteChar = "";

	for (let i = 0; i < line.length; i++) {
		const char = line[i];
		if (inQuotes) {
			if (char === quoteChar) {
				inQuotes = false;
			} else {
				current += char;
			}
		} else {
			if (char === '"' || char === "'") {
				inQuotes = true;
				quoteChar = char;
			} else if (/\s/.test(char)) {
				if (current) {
					args.push(current);
					current = "";
				}
			} else {
				current += char;
			}
		}
	}
	if (current) {
		args.push(current);
	}
	return args;
}


// Reusable translation helper
async function translateTextHelper(inputText: string): Promise<string> {
	if (!inputText.trim()) return "";
	const isJa = containsJapanese(inputText);
	const from = isJa ? "ja" : "en";

	const glossaryPath = path.join(process.cwd(), "data", "glossary.json");
	const jpToFrMap = new Map<string, string>();
	const enToFrMap = new Map<string, string>();

	const glossaryFile = Bun.file(glossaryPath);
	if (await glossaryFile.exists()) {
		try {
			const glossary = await glossaryFile.json();
			const categories = [
				"characters",
				"techniques",
				"auras",
				"passives",
				"teams",
				"items",
				"terms",
			];
			for (const cat of categories) {
				const list = glossary[cat] || [];
				for (const entry of list) {
					const frVal = entry.fr || entry.name_FR;
					if (!frVal) continue;

					if (entry.ja && entry.ja.trim()) {
						const cleanJa = cleanJapanese(entry.ja);
						if (cleanJa.length > 1) {
							jpToFrMap.set(cleanJa, frVal);
						}
					}
					if (entry.en && entry.en.trim() && entry.en.toLowerCase() !== frVal.toLowerCase()) {
						enToFrMap.set(entry.en.trim(), frVal);
					}
				}
			}
		} catch (e) {
			// ignore
		}
	}

	const jpReplacements = Array.from(jpToFrMap.entries()).sort(
		(a, b) => b[0].length - a[0].length
	);
	const enReplacements = Array.from(enToFrMap.entries()).sort(
		(a, b) => b[0].length - a[0].length
	);

	const replacements = (isJa ? jpReplacements : enReplacements).map(([term, frVal]) => ({
		term,
		lowerTerm: term.toLowerCase(),
		frVal,
	}));

	let processedText = inputText;
	const placeholderMap = new Map<string, string>();
	let placeholderIndex = 0;

	const regexCache = new Map<string, RegExp>();
	const globalRegexCache = new Map<string, RegExp>();
	const getRegex = (t: string) => {
		let r = regexCache.get(t);
		if (!r) {
			r = new RegExp("\\b" + escapeRegExp(t) + "\\b", "i");
			regexCache.set(t, r);
		}
		return r;
	};
	const getGlobalRegex = (t: string) => {
		let r = globalRegexCache.get(t);
		if (!r) {
			r = new RegExp("\\b" + escapeRegExp(t) + "\\b", "gi");
			globalRegexCache.set(t, r);
		}
		return r;
	};

	for (const { term, lowerTerm, frVal } of replacements) {
		let matches = false;
		if (isJa) {
			matches = processedText.includes(term);
		} else {
			if (processedText.toLowerCase().includes(lowerTerm)) {
				const regex = getRegex(term);
				matches = regex.test(processedText);
			}
		}

		if (matches) {
			const placeholder = ` [[T${placeholderIndex}]] `;
			placeholderMap.set(placeholder.trim(), frVal);

			if (isJa) {
				processedText = processedText.replaceAll(term, placeholder);
			} else {
				const regex = getGlobalRegex(term);
				processedText = processedText.replace(regex, placeholder);
			}
			placeholderIndex++;
		}
	}

	let translated = await translateWithGoogle(processedText, from, "fr");

	for (const [placeholder, frVal] of placeholderMap.entries()) {
		const cleanPlaceholder = placeholder
			.replace("[[", "")
			.replace("]]", "")
			.trim()
			.toLowerCase();
		const num = cleanPlaceholder.replace("t", "");

		const dblRegex = new RegExp("\\[\\s*\\[\\s*[tT]\\s*" + num + "\\s*\\]\\s*\\]", "g");
		translated = translated.replace(dblRegex, frVal);

		const sglRegex = new RegExp("\\[\\s*[tT]\\s*" + num + "\\s*\\]", "g");
		translated = translated.replace(sglRegex, frVal);

		const rawRegex = new RegExp("\\b[tT]\\s*" + num + "\\b", "g");
		translated = translated.replace(rawRegex, frVal);
	}

	for (const [placeholder, frVal] of placeholderMap.entries()) {
		if (translated.includes(placeholder)) {
			translated = translated.replaceAll(placeholder, frVal);
		}
		const rawPlaceholder = placeholder.trim();
		if (translated.includes(rawPlaceholder)) {
			translated = translated.replaceAll(rawPlaceholder, frVal);
		}
	}

	translated = translated.replace(/\s+/g, " ").trim();
	return translated;
}

// Inline status diagnostic
async function runStatusDiagnosticInline() {
	const dbPath = getSqlitePath();
	let sqliteStatus = {
		healthy: false,
		path: dbPath || "non trouvé",
		fileSize: "N/A",
		tables: 0,
		characterCount: 0,
		error: undefined as string | undefined,
	};

	if (dbPath) {
		try {
			const { Database: DBConstructor } = require("bun:sqlite");
			const db = new DBConstructor(dbPath, { readonly: true });
			const stat = require("node:fs").statSync(dbPath);
			sqliteStatus.fileSize = (stat.size / (1024 * 1024)).toFixed(2) + " MB";

			const tablesResult = db.query(
				"SELECT count(*) as count FROM sqlite_master WHERE type='table'"
			).get() as { count: number };
			sqliteStatus.tables = tablesResult.count;

			try {
				const charResult = db.query("SELECT count(*) as count FROM inagle_characters").get() as {
					count: number;
				};
				sqliteStatus.characterCount = charResult.count;
			} catch {}

			sqliteStatus.healthy = true;
			db.close();
		} catch (e: any) {
			sqliteStatus.error = e.message;
		}
	}

	let redisStatus = {
		healthy: false,
		latency: "N/A",
		error: undefined as string | undefined,
	};
	try {
		const redis = getRedisClient();
		const start = performance.now();
		await redis.get("status:ping");
		const end = performance.now();
		redisStatus.healthy = true;
		redisStatus.latency = (end - start).toFixed(2) + "ms";
	} catch (e: any) {
		redisStatus.error = e.message;
	}

	console.log(`${colors.cyan}=== Diagnostic de santé Azalée ===${colors.reset}\n`);

	console.log(`${colors.bold}${colors.blue}[SQLite]${colors.reset}`);
	if (sqliteStatus.healthy) {
		console.log(`  Statut     : ${colors.green}Disponible${colors.reset}`);
		console.log(`  Base       : ${sqliteStatus.path}`);
		console.log(`  Taille     : ${sqliteStatus.fileSize}`);
		console.log(`  Tables     : ${sqliteStatus.tables}`);
		console.log(`  Personnages: ${sqliteStatus.characterCount}`);
	} else {
		console.log(`  Statut     : ${colors.red}Hors-ligne / Erreur${colors.reset}`);
		if (sqliteStatus.error) {
			console.log(`  Erreur     : ${sqliteStatus.error}`);
		}
	}

	console.log(`\n${colors.bold}${colors.blue}[Redis]${colors.reset}`);
	if (redisStatus.healthy) {
		console.log(`  Statut     : ${colors.green}Disponible${colors.reset}`);
		console.log(`  Latence    : ${redisStatus.latency}`);
	} else {
		console.log(`  Statut     : ${colors.red}Hors-ligne / Erreur${colors.reset}`);
		if (redisStatus.error) {
			console.log(`  Erreur     : ${redisStatus.error}`);
		}
	}
}

// ─── COMMANDS ────────────────────────────────────────────────────────

// 1. translate
program
	.command("translate [text]")
	.description("Traduit du texte en français en appliquant le glossaire consolidé")
	.option("-j, --json", "Format de sortie en JSON brute")
	.action(async (text: string | undefined, options: { json?: boolean }) => {
		suppressLogs(!!options.json);
		try {
			const inputText = await getOrReadInput(text);
			if (!inputText.trim()) {
				restoreLogs(!!options.json);
				if (options.json) {
					console.log(JSON.stringify({ error: "Aucun texte à traduire" }));
				} else {
					console.error(`${colors.red}Erreur : Aucun texte fourni.${colors.reset}`);
				}
				return;
			}

			const isJa = containsJapanese(inputText);
			if (!options.json) {
				console.log(
					`${colors.cyan}Langue source détectée : ${isJa ? "Japonais" : "Anglais"}${colors.reset}`
				);
			}

			const translated = await translateTextHelper(inputText);

			if (options.json) {
				restoreLogs(true);
				console.log(
					JSON.stringify({
						original: inputText,
						detectedLanguage: isJa ? "ja" : "en",
						translated: translated,
					}, null, 2)
				);
			} else {
				console.log(`\n${colors.bold}${colors.green}Texte traduit :${colors.reset}`);
				console.log(translated);
			}
		} catch (e: any) {
			restoreLogs(!!options.json);
			if (options.json) {
				console.log(JSON.stringify({ error: e.message }));
			} else {
				console.error(`${colors.red}Erreur de traduction : ${e.message}${colors.reset}`);
			}
		}
	});

// 2. search
program
	.command("search [query]")
	.description("Fuzzy search ultra-rapide sur l'ensemble des entités du jeu (Inagle)")
	.option("-j, --json", "Format de sortie en JSON brute")
	.action(async (query: string | undefined, options: { json?: boolean }) => {
		suppressLogs(!!options.json);
		try {
			const inputQuery = await getOrReadInput(query);
			if (!inputQuery.trim()) {
				restoreLogs(!!options.json);
				if (options.json) {
					console.log(JSON.stringify({ error: "Requête de recherche vide" }));
				} else {
					console.error(`${colors.red}Erreur: Requête de recherche vide.${colors.reset}`);
				}
				return;
			}

			const svc = await createInagleService();
			const results = svc.search.global(inputQuery, { limit: 15 });

			if (options.json) {
				restoreLogs(true);
				console.log(JSON.stringify(results, null, 2));
				return;
			}

			console.log(`${colors.cyan}Recherche Inagle pour : "${inputQuery}"...${colors.reset}`);
			if (results.length === 0) {
				console.log(`${colors.yellow}Aucun résultat trouvé.${colors.reset}`);
				return;
			}

			console.log(`\n${colors.bold}${colors.blue}Résultats de la recherche :${colors.reset}`);
			console.log("─".repeat(80));
			for (const r of results) {
				const typeLabel = r.type.toUpperCase().padEnd(10);
				const nameLabel = `${colors.bold}${r.name}${colors.reset}`.padEnd(45);
				const idLabel = `${colors.yellow}(ID/Code: ${r.id})${colors.reset}`;
				console.log(`[${colors.green}${typeLabel}${colors.reset}] ${nameLabel} ${idLabel}`);
			}
			console.log("─".repeat(80));
		} catch (e: any) {
			restoreLogs(!!options.json);
			if (options.json) {
				console.log(JSON.stringify({ error: e.message }));
			} else {
				console.error(`${colors.red}Erreur lors de la recherche : ${e.message}${colors.reset}`);
			}
		}
	});

// 3. db query
program
	.command("db [sql]")
	.description("Exécute une requête SQL (sur PostgreSQL par défaut, ou sur SQLite avec --sqlite)")
	.option("-s, --sqlite", "Exécute sur la base SQLite de sauvegarde locale")
	.option("-j, --json", "Format de sortie en JSON brute")
	.action(async (sql: string | undefined, options: { sqlite?: boolean; json?: boolean }) => {
		suppressLogs(!!options.json);
		try {
			const inputSql = await getOrReadInput(sql);
			if (!inputSql.trim()) {
				restoreLogs(!!options.json);
				if (options.json) {
					console.log(JSON.stringify({ error: "Requête SQL vide" }));
				} else {
					console.error(`${colors.red}Erreur: Requête SQL vide.${colors.reset}`);
				}
				return;
			}

			if (options.sqlite) {
				const dbPath = getSqlitePath();
				if (!dbPath) {
					restoreLogs(!!options.json);
					if (options.json) {
						console.log(JSON.stringify({ error: "Aucune base de données SQLite localisée" }));
					} else {
						console.error(
							`${colors.red}Erreur: Aucune base de données SQLite localisée.${colors.reset}`
						);
					}
					return;
				}

				if (!options.json) {
					console.log(`${colors.cyan}SQLite DB utilisé : ${dbPath}${colors.reset}`);
				}
				const { Database: DBConstructor } = require("bun:sqlite");

				const db = new DBConstructor(dbPath, { readonly: true });
				const results = db.query(inputSql).all();

				restoreLogs(!!options.json);
				if (options.json) {
					console.log(JSON.stringify(results, null, 2));
				} else {
					console.log(`\n${colors.green}Résultats SQLite (${results.length} lignes) :${colors.reset}`);
					console.log(renderAsciiTable(results));
				}
				db.close();
			} else {
				// PostgreSQL (default)
				const dbUrl = process.env.DATABASE_URL;
				if (!dbUrl) {
					restoreLogs(!!options.json);
					if (options.json) {
						console.log(JSON.stringify({ error: "DATABASE_URL non définie dans l'environnement" }));
					} else {
						console.error(
							`${colors.red}Erreur: DATABASE_URL non définie dans l'environnement.${colors.reset}`
						);
					}
					return;
				}

				if (!options.json) {
					console.log(`${colors.cyan}PostgreSQL DB utilisé : ${dbUrl}${colors.reset}`);
				}
				const pg = require("pg");
				const client = new pg.Client({ connectionString: dbUrl });
				await client.connect();
				const res = await client.query(inputSql);
				await client.end();

				restoreLogs(!!options.json);
				if (options.json) {
					console.log(JSON.stringify(res.rows, null, 2));
				} else {
					console.log(`\n${colors.green}Résultats PostgreSQL (${res.rowCount} lignes) :${colors.reset}`);
					console.log(renderAsciiTable(res.rows));
				}
			}
		} catch (e: any) {
			restoreLogs(!!options.json);
			if (options.json) {
				console.log(JSON.stringify({ error: e.message }));
			} else {
				console.error(`${colors.red}Erreur SQL : ${e.message}${colors.reset}`);
			}
		}
	});

// 4. redis cache
program
	.command("redis <cmd> <key> [val]")
	.description("Interagit avec le cache Redis (get, set, del)")
	.option("-j, --json", "Format de sortie en JSON brute")
	.action(async (cmd: string, key: string, val: string | undefined, options: { json?: boolean }) => {
		suppressLogs(!!options.json);
		try {


			if (cmd === "get") {
				const res = await cache.get(key);
				if (options.json) {
					restoreLogs(true);
					console.log(JSON.stringify({ key, value: res }));
				} else {
					console.log(`${colors.green}Résultat Redis (${key}) :${colors.reset}`);
					console.log(JSON.stringify(res, null, 2));
				}
			} else if (cmd === "set") {
				let inputVal = val;
				if (!inputVal && !process.stdin.isTTY) {
					inputVal = await Bun.stdin.text();
				}
				if (!inputVal) {
					restoreLogs(!!options.json);
					if (options.json) {
						console.log(JSON.stringify({ error: "Valeur requise pour set" }));
					} else {
						console.error(`${colors.red}Erreur : Valeur requise pour set.${colors.reset}`);
					}
					process.exit(1);
				}
				let parsedVal: any = inputVal;
				try {
					parsedVal = JSON.parse(inputVal);
				} catch {
					// keep as string
				}
				await cache.set(key, parsedVal);
				if (options.json) {
					restoreLogs(true);
					console.log(JSON.stringify({ success: true, key }));
				} else {
					console.log(`${colors.green}Clé Redis ${key} mise à jour avec succès.${colors.reset}`);
				}
			} else if (cmd === "del") {
				await cache.del(key);
				if (options.json) {
					restoreLogs(true);
					console.log(JSON.stringify({ success: true, key }));
				} else {
					console.log(`${colors.green}Clé Redis ${key} supprimée avec succès.${colors.reset}`);
				}
			} else {
				restoreLogs(!!options.json);
				if (options.json) {
					console.log(JSON.stringify({ error: `Commande inconnue: ${cmd}` }));
				} else {
					console.error(`${colors.red}Commande inconnue. Utilisez: get, set ou del${colors.reset}`);
				}
			}
		} catch (e: any) {
			restoreLogs(!!options.json);
			if (options.json) {
				console.log(JSON.stringify({ error: e.message }));
			} else {
				console.error(`${colors.red}Erreur Redis : ${e.message}${colors.reset}`);
			}
		} finally {
			if (!isReplMode) process.exit(0);
		}
	});

// 5. glossary rebuild
program
	.command("glossary-rebuild")
	.description("Regroupe et renforce le glossaire (inagle, text binaries, fr.json)")
	.option("-j, --json", "Format de sortie en JSON brute")
	.action(async (options: { json?: boolean }) => {
		suppressLogs(!!options.json);
		if (!options.json) {
			console.log(
				`${colors.cyan}Lancement de la reconstruction complète du glossaire...${colors.reset}`
			);
		}

		try {
			const { main: rebuildGlossary } = require("../scripts/build-glossary.ts");
			const counts = await rebuildGlossary();

			restoreLogs(!!options.json);
			if (options.json) {
				console.log(JSON.stringify({ success: true, counts }));
			}
		} catch (e: any) {
			restoreLogs(!!options.json);
			if (options.json) {
				console.log(JSON.stringify({ error: e.message }));
			} else {
				console.error(`${colors.red}Erreur de reconstruction : ${e.message}${colors.reset}`);
			}
		}
	});

// 6. audit
program
	.command("audit")
	.description("Audit et diagnostics sur l'intégrité des traductions et de la base de données")
	.option("-j, --json", "Format de sortie en JSON brute")
	.action(async (options: { json?: boolean }) => {
		suppressLogs(!!options.json);
		try {
			const svc = await createInagleService();
			const chars = svc.characters.all();
			const skills = svc.skills.all();

			const missingName = chars.filter((c) => !c.names?.fr && !c.names?.en);
			const missingImg = chars.filter((c) => !c.image_url && !c.zukan_hash);
			const missingStats = chars.filter((c) => !c.stats || Object.keys(c.stats).length === 0);
			const missingSkillName = skills.filter((s) => !s.name_FR && !s.name_EN);

			if (options.json) {
				restoreLogs(true);
				console.log(
					JSON.stringify(
						{
							characters: {
								total: chars.length,
								missingNameFrEn: missingName.length,
								missingImage: missingImg.length,
								missingStats: missingStats.length,
							},
							skills: {
								total: skills.length,
								missingNameFrEn: missingSkillName.length,
							},
						},
						null,
						2
					)
				);
				return;
			}

			console.log(`${colors.cyan}Démarrage de l'audit de base de données...${colors.reset}`);
			console.log(`\n${colors.bold}${colors.blue}Diagnostics Characters :${colors.reset}`);
			console.log(`- Total Characters : ${chars.length}`);
			console.log(
				`- Sans nom FR/EN   : ${missingName.length === 0 ? colors.green + "0 (Excellent)" : colors.red + missingName.length} ${colors.reset}`
			);
			console.log(
				`- Sans image       : ${missingImg.length === 0 ? colors.green + "0 (Excellent)" : colors.yellow + missingImg.length} ${colors.reset}`
			);
			console.log(
				`- Sans stats       : ${missingStats.length === 0 ? colors.green + "0 (Excellent)" : colors.red + missingStats.length} ${colors.reset}`
			);

			console.log(`\n${colors.bold}${colors.blue}Diagnostics Skills/Techniques :${colors.reset}`);
			console.log(`- Total Skills     : ${skills.length}`);
			console.log(
				`- Sans nom FR/EN   : ${missingSkillName.length === 0 ? colors.green + "0 (Excellent)" : colors.red + missingSkillName.length} ${colors.reset}`
			);

			console.log(`\n${colors.bold}${colors.green}Audit complété avec succès !${colors.reset}`);
		} catch (e: any) {
			restoreLogs(!!options.json);
			if (options.json) {
				console.log(JSON.stringify({ error: e.message }));
			} else {
				console.error(`${colors.red}Erreur lors de l'audit : ${e.message}${colors.reset}`);
			}
		}
	});

// 7. rag query
program
	.command("rag [query]")
	.description("Interroge la base de connaissances sémantique (RAG) sur Inazuma Eleven")
	.option("-j, --json", "Format de sortie en JSON brute")
	.option("-l, --limit <limit>", "Nombre maximum de résultats", "4")
	.action(async (query: string | undefined, options: { json?: boolean; limit: string }) => {
		suppressLogs(!!options.json);
		try {
			const inputQuery = await getOrReadInput(query);
			if (!inputQuery.trim()) {
				restoreLogs(!!options.json);
				if (options.json) {
					console.log(JSON.stringify({ error: "Requête sémantique vide" }));
				} else {
					console.error(`${colors.red}Erreur: Requête sémantique vide.${colors.reset}`);
				}
				return;
			}

			if (!options.json) {
				console.log(`${colors.cyan}Recherche RAG pour : "${inputQuery}"...${colors.reset}`);
			}

			const limitVal = parseInt(options.limit, 10) || 4;
			const results = await queryRag(inputQuery, limitVal);

			restoreLogs(!!options.json);

			if (options.json) {
				console.log(JSON.stringify(results, null, 2));
			} else {
				console.log(`\n${colors.bold}${colors.green}Résultats du RAG :${colors.reset}`);
				console.log("─".repeat(80));
				if (results.length === 0) {
					console.log(`${colors.yellow}Aucun résultat pertinent trouvé.${colors.reset}`);
				}
				for (const r of results) {
					console.log(
						`[${colors.cyan}Score: ${(r.score * 100).toFixed(1)}%${colors.reset}] ${colors.bold}${r.title}${colors.reset} (${r.type})`
					);
					console.log(`${colors.blue}Source: ${r.url || "N/A"}${colors.reset}`);
					console.log(r.text.substring(0, 300) + (r.text.length > 300 ? "..." : ""));
					console.log("─".repeat(80));
				}
			}
		} catch (e: any) {
			restoreLogs(!!options.json);
			if (options.json) {
				console.log(JSON.stringify({ error: e.message }));
			} else {
				console.error(`${colors.red}Erreur RAG : ${e.message}${colors.reset}`);
			}
		} finally {
			if (!isReplMode) process.exit(0);
		}
	});

// 8. status check
program
	.command("status")
	.description("Affiche le statut de santé des services locaux (SQLite, Redis, système)")
	.option("-j, --json", "Format de sortie en JSON brute")
	.action(async (options: { json?: boolean }) => {
		suppressLogs(!!options.json);
		try {
			const dbPath = getSqlitePath();
			let sqliteStatus = {
				healthy: false,
				path: dbPath || "non trouvé",
				fileSize: "N/A",
				tables: 0,
				characterCount: 0,
				error: undefined as string | undefined,
			};

			if (dbPath) {
				try {
					const { Database: DBConstructor } = require("bun:sqlite");
					const db = new DBConstructor(dbPath, { readonly: true });
					const stat = require("node:fs").statSync(dbPath);
					sqliteStatus.fileSize = (stat.size / (1024 * 1024)).toFixed(2) + " MB";

					const tablesResult = db.query(
						"SELECT count(*) as count FROM sqlite_master WHERE type='table'"
					).get() as { count: number };
					sqliteStatus.tables = tablesResult.count;

					try {
						const charResult = db.query("SELECT count(*) as count FROM inagle_characters").get() as {
							count: number;
						};
						sqliteStatus.characterCount = charResult.count;
					} catch {}

					sqliteStatus.healthy = true;
					db.close();
				} catch (e: any) {
					sqliteStatus.error = e.message;
				}
			}

			let redisStatus = {
				healthy: false,
				latency: "N/A",
				error: undefined as string | undefined,
			};
			try {
				const redis = getRedisClient();
				const start = performance.now();
				await redis.get("status:ping");
				const end = performance.now();
				redisStatus.healthy = true;
				redisStatus.latency = (end - start).toFixed(2) + "ms";
			} catch (e: any) {
				redisStatus.error = e.message;
			}

			let gitStatus = {
				branch: "unknown",
				commit: "unknown",
				clean: false,
			};
			try {
				const { spawnSync } = require("node:child_process");
				gitStatus.branch =
					spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
						encoding: "utf-8",
					}).stdout?.trim() || "unknown";
				gitStatus.commit =
					spawnSync("git", ["rev-parse", "--short", "HEAD"], {
						encoding: "utf-8",
					}).stdout?.trim() || "unknown";
				const statusOutput = spawnSync("git", ["status", "--porcelain"], {
					encoding: "utf-8",
				}).stdout?.trim();
				gitStatus.clean = statusOutput === "";
			} catch {}

			const os = require("node:os");
			const sysMemTotal = (os.totalmem() / (1024 * 1024 * 1024)).toFixed(2) + " GB";
			const sysMemFree = (os.freemem() / (1024 * 1024 * 1024)).toFixed(2) + " GB";
			const uptime = process.uptime().toFixed(1) + "s";

			const memory = process.memoryUsage();
			const processHeapUsed = (memory.heapUsed / (1024 * 1024)).toFixed(2) + " MB";
			const processRss = (memory.rss / (1024 * 1024)).toFixed(2) + " MB";

			const report = {
				sqlite: sqliteStatus,
				redis: redisStatus,
				git: gitStatus,
				process: {
					uptime,
					memory: {
						heapUsed: processHeapUsed,
						rss: processRss,
					},
				},
				system: {
					totalMemory: sysMemTotal,
					freeMemory: sysMemFree,
					platform: os.platform(),
					arch: os.arch(),
				},
			};

			restoreLogs(!!options.json);

			if (options.json) {
				console.log(JSON.stringify(report, null, 2));
			} else {
				console.log(`${colors.cyan}=== Diagnostic de santé Azalée ===${colors.reset}\n`);

				console.log(`${colors.bold}${colors.blue}[SQLite]${colors.reset}`);
				if (sqliteStatus.healthy) {
					console.log(`  Statut     : ${colors.green}Disponible${colors.reset}`);
					console.log(`  Base       : ${sqliteStatus.path}`);
					console.log(`  Taille     : ${sqliteStatus.fileSize}`);
					console.log(`  Tables     : ${sqliteStatus.tables}`);
					console.log(`  Personnages: ${sqliteStatus.characterCount}`);
				} else {
					console.log(`  Statut     : ${colors.red}Hors-ligne / Erreur${colors.reset}`);
					if (sqliteStatus.error) {
						console.log(`  Erreur     : ${sqliteStatus.error}`);
					}
				}

				console.log(`\n${colors.bold}${colors.blue}[Redis]${colors.reset}`);
				if (redisStatus.healthy) {
					console.log(`  Statut     : ${colors.green}Disponible${colors.reset}`);
					console.log(`  Latence    : ${redisStatus.latency}`);
				} else {
					console.log(`  Statut     : ${colors.red}Hors-ligne / Erreur${colors.reset}`);
					if (redisStatus.error) {
						console.log(`  Erreur     : ${redisStatus.error}`);
					}
				}

				console.log(`\n${colors.bold}${colors.blue}[Git / Version]${colors.reset}`);
				console.log(`  Branche    : ${gitStatus.branch}`);
				console.log(`  Commit     : ${gitStatus.commit}`);
				console.log(
					`  Propre     : ${gitStatus.clean ? colors.green + "Oui" : colors.yellow + "Modifications locales en cours"}${colors.reset}`
				);

				console.log(`\n${colors.bold}${colors.blue}[Processus & Système]${colors.reset}`);
				console.log(`  Uptime CLI : ${report.process.uptime}`);
				console.log(`  Heap Utilisé: ${report.process.memory.heapUsed}`);
				console.log(`  RSS Process: ${report.process.memory.rss}`);
				console.log(
					`  OS Mémoire : ${report.system.freeMemory} libres / ${report.system.totalMemory} total`
				);
				console.log(`  Plateforme : ${report.system.platform} (${report.system.arch})`);
			}
		} catch (e: any) {
			restoreLogs(!!options.json);
			if (options.json) {
				console.log(JSON.stringify({ error: e.message }));
			} else {
				console.error(
					`${colors.red}Erreur lors du diagnostic de statut : ${e.message}${colors.reset}`
				);
			}
		} finally {
			if (!isReplMode) process.exit(0);
		}
	});

// 9. wave command
program
	.command("wave")
	.description("Lance une vague d'enrichissement, d'analyse et de traitement de données (zukan, glossary, asset xref)")
	.option("-c, --cycle", "Lance le runner de cycle complet (avec sync characters, compilation Next.js et restart du service)")
	.option("-l, --loop", "Lance la boucle continue de vagues toutes les 30 secondes")
	.action(async (options: { cycle?: boolean; loop?: boolean }) => {
		const { spawn } = require("bun");
		const scriptPath = options.cycle 
			? path.resolve(process.cwd(), "scripts/inagle/pipeline/run-wave-cycle.sh")
			: path.resolve(process.cwd(), "scripts/inagle/pipeline/wave-processing.ts");

		if (options.loop) {
			console.log(`${colors.cyan}Lancement de la boucle infinie de vagues de traitement toutes les 30 secondes...${colors.reset}`);
			console.log(`${colors.yellow}Appuyez sur Ctrl+C pour arrêter.${colors.reset}\n`);
			
			while (true) {
				console.log(`\n🌊 [${new Date().toISOString()}] Début de la vague de traitement...`);
				const proc = spawn([options.cycle ? scriptPath : "bun", options.cycle ? "" : scriptPath].filter(Boolean), {
					stdout: "inherit",
					stderr: "inherit",
				});
				await proc.exited;
				console.log(`💤 En attente de 30 secondes avant la prochaine vague...`);
				await new Promise(resolve => setTimeout(resolve, 30000));
			}
		} else {
			console.log(`${colors.cyan}Lancement de la vague de traitement...${colors.reset}`);
			const proc = spawn([options.cycle ? scriptPath : "bun", options.cycle ? "" : scriptPath].filter(Boolean), {
				stdout: "inherit",
				stderr: "inherit",
			});
			const code = await proc.exited;
			if (!isReplMode) process.exit(code);
		}
	});

// 10. repair command
program
	.command("repair")
	.description("Diagnostique et répare la base de données locale (RLS, privilèges)")
	.action(async () => {
		console.log(`${colors.cyan}Diagnostics et réparation de la base de données...${colors.reset}`);
		const { Client } = require("pg");
		const dbUrl = process.env.DATABASE_URL;
		if (!dbUrl) {
			console.error(`${colors.red}Erreur: DATABASE_URL non définie dans l'environnement.${colors.reset}`);
			return;
		}

		console.log(`Connexion à la base via : ${dbUrl}`);
		try {
			const client = new Client({ connectionString: dbUrl });
			await client.connect();
			
			const { rows: tables } = await client.query(
				`SELECT table_name FROM information_schema.tables 
				 WHERE table_schema = 'public' AND table_name LIKE 'inagle_%'`
			);
			
			console.log(`  Trouvé ${tables.length} tables Inagle. Désactivation RLS et attribution des droits...`);
			
			for (const t of tables) {
				const tableName = t.table_name;
				try {
					await client.query(`ALTER TABLE "${tableName}" DISABLE ROW LEVEL SECURITY;`);
					await client.query(`GRANT ALL PRIVILEGES ON TABLE "${tableName}" TO ubuntu;`);
					console.log(`  ✓ Table "${tableName}" réparée.`);
				} catch (e: any) {
					console.log(`  ⚠ Impossible de réparer "${tableName}" directement: ${e.message}. Tentative via sudo...`);
					const { execSync } = require("node:child_process");
					execSync(`sudo -u postgres psql -d rose_griffon -c 'ALTER TABLE "${tableName}" DISABLE ROW LEVEL SECURITY; GRANT ALL PRIVILEGES ON TABLE "${tableName}" TO ubuntu;'`);
					console.log(`  ✓ Table "${tableName}" réparée via sudo postgres.`);
				}
			}
			
			try {
				await client.query(`ALTER TABLE patch_notes DISABLE ROW LEVEL SECURITY;`);
				await client.query(`GRANT ALL PRIVILEGES ON TABLE patch_notes TO ubuntu;`);
				console.log(`  ✓ Table "patch_notes" réparée.`);
			} catch (e: any) {
				const { execSync } = require("node:child_process");
				execSync(`sudo -u postgres psql -d rose_griffon -c 'ALTER TABLE patch_notes DISABLE ROW LEVEL SECURITY; GRANT ALL PRIVILEGES ON TABLE patch_notes TO ubuntu;'`);
				console.log(`  ✓ Table "patch_notes" réparée via sudo postgres.`);
			}

			await client.end();
			console.log(`\n${colors.bold}${colors.green}Base de données locale réparée avec succès !${colors.reset}`);
		} catch (e: any) {
			console.error(`${colors.red}Erreur de connexion / privilèges : ${e.message}${colors.reset}`);
		}
	});

// 11. sync command
program
	.command("sync")
	.description("Synchronise les fichiers locaux de données avec la base PostgreSQL locale")
	.option("-p, --push", "Pousse les données Inagle locales vers PostgreSQL (inagle push)")
	.option("-j, --json", "Synchronise les corrections SQL vers characters.json (sync-db-to-json)")
	.action(async (options: { push?: boolean; json?: boolean }) => {
		const { spawn } = require("bun");
		if (options.push) {
			console.log(`${colors.cyan}Exécution de inagle push pour synchroniser les configs de données...${colors.reset}`);
			const proc = spawn(["bun", "packages/inagle/src/cli-push.ts"], {
				stdout: "inherit",
				stderr: "inherit",
			});
			const code = await proc.exited;
			if (!isReplMode) process.exit(code);
		} else if (options.json) {
			console.log(`${colors.cyan}Synchronisation de la base locale vers le fichier characters.json...${colors.reset}`);
			const proc = spawn(["bun", "scripts/inagle/pipeline/sync-db-to-json.ts"], {
				stdout: "inherit",
				stderr: "inherit",
			});
			const code = await proc.exited;
			if (!isReplMode) process.exit(code);
		} else {
			console.log(`${colors.yellow}Veuillez spécifier une option: --push ou --json.${colors.reset}`);
		}
	});

// 12. chara command
program
	.command("chara [query]")
	.description("Affiche les détails d'un joueur d'Inazuma Eleven (profil, stats, techniques, variants)")
	.option("-j, --json", "Format de sortie en JSON brute")
	.action(async (query: string | undefined, options: { json?: boolean }) => {
		suppressLogs(!!options.json);
		try {
			const inputQuery = await getOrReadInput(query);
			if (!inputQuery.trim()) {
				restoreLogs(!!options.json);
				if (options.json) {
					console.log(JSON.stringify({ error: "Aucun joueur spécifié" }));
				} else {
					console.error(`${colors.red}Erreur: Spécifiez un nom ou un ID de joueur (ex: Mark).${colors.reset}`);
				}
				return;
			}

			const svc = await createInagleService();
			const chars = svc.characters.baseCharacters();

			const matches = chars.filter((c: any) => {
				const q = inputQuery.toLowerCase().trim();
				if (c.charaId.toLowerCase() === q || c.internalCode?.toLowerCase() === q) {
					return true;
				}
				const nameFr = c.names?.fr?.toLowerCase() || "";
				const nameEn = c.names?.en?.toLowerCase() || "";
				const nameJa = c.names?.ja?.toLowerCase() || "";
				const slug = c.slug?.toLowerCase() || "";
				return nameFr.includes(q) || nameEn.includes(q) || nameJa.includes(q) || slug.includes(q);
			});

			restoreLogs(!!options.json);

			if (matches.length === 0) {
				if (options.json) {
					console.log(JSON.stringify([], null, 2));
				} else {
					console.log(`${colors.yellow}Aucun joueur trouvé pour : "${inputQuery}"${colors.reset}`);
				}
				return;
			}

			if (matches.length > 1) {
				if (options.json) {
					console.log(JSON.stringify(matches.map((m: any) => ({ id: m.charaId, name: m.names.fr || m.names.en || m.names.ja })), null, 2));
				} else {
					if (activeRl) {
						console.log(`${colors.yellow}Plusieurs joueurs correspondent à votre recherche :${colors.reset}`);
						for (const [idx, m] of matches.entries()) {
							console.log(`  [${colors.bold}${idx + 1}${colors.reset}] ${colors.bold}${m.names.fr || m.names.en}${colors.reset} (ID: ${m.charaId} | Code: ${m.internalCode})`);
						}
						pendingSelection = { type: "chara", matches };
						activeRl.setPrompt(`${colors.bold}${colors.yellow}Choisissez [1-${matches.length}] ou tapez une commande > ${colors.reset}`);
						activeRl.prompt();
					} else {
						console.log(`${colors.yellow}Plusieurs joueurs correspondent à votre recherche :${colors.reset}`);
						for (const m of matches) {
							console.log(`  - ${colors.bold}${m.names.fr || m.names.en}${colors.reset} (ID: ${m.charaId} | Code: ${m.internalCode})`);
						}
					}
				}
				return;
			}

			if (options.json) {
				console.log(JSON.stringify(matches[0], null, 2));
			} else {
				console.log(renderCharaProfile(matches[0], svc));
			}
		} catch (e: any) {
			restoreLogs(!!options.json);
			if (options.json) {
				console.log(JSON.stringify({ error: e.message }));
			} else {
				console.error(`${colors.red}Erreur chara : ${e.message}${colors.reset}`);
			}
		}
	});

// 13. dialogue command
program
	.command("dialogue [query]")
	.description("Recherche dans les dialogues narratifs et de chronique du jeu")
	.option("-s, --speaker <speaker>", "Filtre par locuteur/personnage")
	.option("-j, --json", "Format de sortie en JSON brute")
	.option("-l, --limit <limit>", "Nombre de résultats max", "10")
	.action(async (query: string | undefined, options: { speaker?: string; json?: boolean; limit: string }) => {
		suppressLogs(!!options.json);
		try {
			const inputQuery = await getOrReadInput(query);
			const speakerQuery = options.speaker;
			const limitVal = parseInt(options.limit, 10) || 10;
			
			const dbPath = "/home/ubuntu/data/all-gamedata/story_text_database.json";
			if (!existsSync(dbPath)) {
				restoreLogs(!!options.json);
				if (options.json) {
					console.log(JSON.stringify({ error: "Story text database not found" }));
				} else {
					console.error(`${colors.red}Erreur: Base de dialogues introuvable. Exécutez 'azalee sync --push' d'abord.${colors.reset}`);
				}
				return;
			}
			
			const data = JSON.parse(readFileSync(dbPath, "utf-8"));
			const events = data.events || [];
			const matches: any[] = [];
			
			const textQ = inputQuery.toLowerCase().trim();
			const speakerQ = speakerQuery?.toLowerCase().trim();
			
			outerLoop:
			for (const ev of events) {
				const eventId = ev.eventId;
				for (const d of ev.dialogues) {
					let matchesText = true;
					let matchesSpeaker = true;
					
					if (textQ) {
						const textFr = d.text?.fr?.toLowerCase() || "";
						const textEn = d.text?.en?.toLowerCase() || "";
						const textJa = d.text?.ja?.toLowerCase() || "";
						matchesText = textFr.includes(textQ) || textEn.includes(textQ) || textJa.includes(textQ);
					}
					
					if (speakerQ) {
						const spNameFr = d.speaker?.names?.fr?.toLowerCase() || "";
						const spNameEn = d.speaker?.names?.en?.toLowerCase() || "";
						const spNameJa = d.speaker?.names?.ja?.toLowerCase() || "";
						matchesSpeaker = spNameFr.includes(speakerQ) || spNameEn.includes(speakerQ) || spNameJa.includes(speakerQ) || d.speaker?.charaId?.toLowerCase() === speakerQ;
					}
					
					if (matchesText && matchesSpeaker) {
						matches.push({
							eventId,
							dialogueId: d.dialogueId,
							speaker: d.speaker?.names?.fr || d.speaker?.names?.en || d.speaker?.names?.ja || d.speaker?.charaId,
							text: d.text
						});
						if (matches.length >= limitVal) break outerLoop;
					}
				}
			}
			
			restoreLogs(!!options.json);
			if (options.json) {
				console.log(JSON.stringify(matches, null, 2));
			} else {
				console.log(`${colors.cyan}Recherche de dialogues pour : "${textQ}"${speakerQ ? ` (par ${speakerQ})` : ""}...${colors.reset}\n`);
				if (matches.length === 0) {
					console.log(`${colors.yellow}Aucun dialogue trouvé.${colors.reset}`);
					return;
				}
				
				for (const m of matches) {
					console.log(`[${colors.bold}${colors.green}${m.speaker}${colors.reset}] (${colors.yellow}${m.eventId}${colors.reset} | ${colors.yellow}${m.dialogueId}${colors.reset})`);
					if (m.text?.fr) console.log(`  FR: ${m.text.fr}`);
					if (m.text?.en) console.log(`  EN: ${m.text.en}`);
					if (m.text?.ja) console.log(`  JA: ${m.text.ja}`);
					console.log("─".repeat(80));
				}
			}
		} catch (e: any) {
			restoreLogs(!!options.json);
			if (options.json) {
				console.log(JSON.stringify({ error: e.message }));
			} else {
				console.error(`${colors.red}Erreur dialogue : ${e.message}${colors.reset}`);
			}
		}
	});

// 14. skill command
program
	.command("skill [query]")
	.description("Affiche les détails d'une technique / compétence / passive")
	.option("-j, --json", "Format de sortie en JSON brute")
	.action(async (query: string | undefined, options: { json?: boolean }) => {
		suppressLogs(!!options.json);
		try {
			const inputQuery = await getOrReadInput(query);
			if (!inputQuery.trim()) {
				restoreLogs(!!options.json);
				if (options.json) {
					console.log(JSON.stringify({ error: "Aucun mot-clé spécifié" }));
				} else {
					console.error(`${colors.red}Erreur: Spécifiez un nom ou un ID de move (ex: Fire Tornado).${colors.reset}`);
				}
				return;
			}
			
			const svc = await createInagleService();
			
			// Try by ID directly first
			let skill = svc.skills.get(inputQuery) || svc.skills.passiveGet(inputQuery) || svc.skills.auraGet(inputQuery);
			
			// If not found by ID, search by name
			if (!skill) {
				const mainMatches = svc.skills.search(inputQuery, { limit: 5 });
				const auraMatches = svc.skills.auraSearch(inputQuery).slice(0, 5);
				
				const matches = [
					...mainMatches.map((s: any) => ({ ...s, skillType: "main" as const })),
					...auraMatches.map((a: any) => ({ ...a, skillType: "aura" as const, displayName: a.displayName || a.name_FR || a.name_EN }))
				];
				
				if (matches.length === 0) {
					restoreLogs(!!options.json);
					if (options.json) {
						console.log(JSON.stringify([], null, 2));
					} else {
						console.log(`${colors.yellow}Aucune technique trouvée pour: "${inputQuery}"${colors.reset}`);
					}
					return;
				}
				
				if (matches.length > 1) {
					restoreLogs(!!options.json);
					if (options.json) {
						console.log(JSON.stringify(matches, null, 2));
					} else {
						if (activeRl) {
							console.log(`${colors.yellow}Plusieurs techniques correspondent :${colors.reset}`);
							for (const [idx, m] of matches.entries()) {
								const typeStr = m.skillType.toUpperCase();
								console.log(`  [${colors.bold}${idx + 1}${colors.reset}] [${colors.bold}${colors.green}${typeStr}${colors.reset}] ${colors.bold}${m.displayName || m.name_FR}${colors.reset} (ID: ${m.skillIDStr || m.auraId || m.passiveId || "N/A"})`);
							}
							pendingSelection = { type: "skill", matches };
							activeRl.setPrompt(`${colors.bold}${colors.yellow}Choisissez [1-${matches.length}] ou tapez une commande > ${colors.reset}`);
							activeRl.prompt();
						} else {
							console.log(`${colors.yellow}Plusieurs techniques correspondent :${colors.reset}`);
							for (const m of matches) {
								const typeStr = m.skillType.toUpperCase();
								console.log(`  - [${colors.bold}${colors.green}${typeStr}${colors.reset}] ${colors.bold}${m.displayName || m.name_FR}${colors.reset} (ID: ${m.skillIDStr || m.auraId || m.passiveId || "N/A"})`);
							}
						}
					}
					return;
				}
				
				skill = matches[0] as any;
			}
			
			restoreLogs(!!options.json);
			if (options.json) {
				console.log(JSON.stringify(skill, null, 2));
			} else {
				console.log(renderSkillProfile(skill, svc));
			}
		} catch (e: any) {
			restoreLogs(!!options.json);
			if (options.json) {
				console.log(JSON.stringify({ error: e.message }));
			} else {
				console.error(`${colors.red}Erreur skill : ${e.message}${colors.reset}`);
			}
		}
	});

// 15. item command
program
	.command("item [query]")
	.description("Affiche les détails d'un objet (consommable, équipement, cosmétique)")
	.option("-j, --json", "Format de sortie en JSON brute")
	.action(async (query: string | undefined, options: { json?: boolean }) => {
		suppressLogs(!!options.json);
		try {
			const inputQuery = await getOrReadInput(query);
			if (!inputQuery.trim()) {
				restoreLogs(!!options.json);
				if (options.json) {
					console.log(JSON.stringify({ error: "Aucun objet spécifié" }));
				} else {
					console.error(`${colors.red}Erreur: Spécifiez un nom ou un ID d'objet (ex: Bottes).${colors.reset}`);
				}
				return;
			}

			const svc = await createInagleService();
			
			// Try by ID directly first
			let item = svc.items.getItem(inputQuery);
			
			// If not found, search by name
			if (!item) {
				const matches = svc.items.searchItems(inputQuery, { limit: 15 });
				
				if (matches.length === 0) {
					restoreLogs(!!options.json);
					if (options.json) {
						console.log(JSON.stringify([], null, 2));
					} else {
						console.log(`${colors.yellow}Aucun objet trouvé pour : "${inputQuery}"${colors.reset}`);
					}
					return;
				}
				
				if (matches.length > 1) {
					restoreLogs(!!options.json);
					if (options.json) {
						console.log(JSON.stringify(matches.map(m => ({ id: m.itemId, name: m.names?.fr || m.name })), null, 2));
					} else {
						if (activeRl) {
							console.log(`${colors.yellow}Plusieurs objets correspondent à votre recherche :${colors.reset}`);
							for (const [idx, m] of matches.entries()) {
								console.log(`  [${colors.bold}${idx + 1}${colors.reset}] ${colors.bold}${m.names?.fr || m.name}${colors.reset} (ID: ${m.itemId} | Code: ${m.internalCode})`);
							}
							pendingSelection = { type: "item", matches };
							activeRl.setPrompt(`${colors.bold}${colors.yellow}Choisissez [1-${matches.length}] ou tapez une commande > ${colors.reset}`);
							activeRl.prompt();
						} else {
							console.log(`${colors.yellow}Plusieurs objets correspondent à votre recherche :${colors.reset}`);
							for (const m of matches) {
								console.log(`  - ${colors.bold}${m.names?.fr || m.name}${colors.reset} (ID: ${m.itemId} | Code: ${m.internalCode})`);
							}
						}
					}
					return;
				}
				item = matches[0];
			}

			restoreLogs(!!options.json);
			if (options.json) {
				console.log(JSON.stringify(item, null, 2));
			} else {
				console.log(renderItemProfile(item));
			}
		} catch (e: any) {
			restoreLogs(!!options.json);
			if (options.json) {
				console.log(JSON.stringify({ error: e.message }));
			} else {
				console.error(`${colors.red}Erreur item : ${e.message}${colors.reset}`);
			}
		}
	});

// 16. team command
program
	.command("team [query]")
	.description("Affiche les détails d'une équipe (nom, uniformes, saisons)")
	.option("-j, --json", "Format de sortie en JSON brute")
	.action(async (query: string | undefined, options: { json?: boolean }) => {
		suppressLogs(!!options.json);
		try {
			const inputQuery = await getOrReadInput(query);
			if (!inputQuery.trim()) {
				restoreLogs(!!options.json);
				if (options.json) {
					console.log(JSON.stringify({ error: "Aucune équipe spécifiée" }));
				} else {
					console.error(`${colors.red}Erreur: Spécifiez un nom ou un ID d'équipe (ex: Raimon).${colors.reset}`);
				}
				return;
			}

			const svc = await createInagleService();
			
			// Try by ID directly first
			let team = svc.teams.getTeam(inputQuery);
			
			// If not found, search by name
			if (!team) {
				const matches = svc.teams.searchTeams(inputQuery);
				
				if (matches.length === 0) {
					restoreLogs(!!options.json);
					if (options.json) {
						console.log(JSON.stringify([], null, 2));
					} else {
						console.log(`${colors.yellow}Aucune équipe trouvée pour : "${inputQuery}"${colors.reset}`);
					}
					return;
				}
				
				if (matches.length > 1) {
					restoreLogs(!!options.json);
					if (options.json) {
						console.log(JSON.stringify(matches.map(m => ({ id: m.teamId, name: m.name })), null, 2));
					} else {
						if (activeRl) {
							console.log(`${colors.yellow}Plusieurs équipes correspondent à votre recherche :${colors.reset}`);
							for (const [idx, m] of matches.entries()) {
								console.log(`  [${colors.bold}${idx + 1}${colors.reset}] ${colors.bold}${m.name}${colors.reset} (ID: ${m.teamId})`);
							}
							pendingSelection = { type: "team", matches };
							activeRl.setPrompt(`${colors.bold}${colors.yellow}Choisissez [1-${matches.length}] ou tapez une commande > ${colors.reset}`);
							activeRl.prompt();
						} else {
							console.log(`${colors.yellow}Plusieurs équipes correspondent à votre recherche :${colors.reset}`);
							for (const m of matches) {
								console.log(`  - ${colors.bold}${m.name}${colors.reset} (ID: ${m.teamId})`);
							}
						}
					}
					return;
				}
				team = matches[0];
			}

			restoreLogs(!!options.json);
			if (options.json) {
				console.log(JSON.stringify(team, null, 2));
			} else {
				console.log(renderTeamProfile(team));
			}
		} catch (e: any) {
			restoreLogs(!!options.json);
			if (options.json) {
				console.log(JSON.stringify({ error: e.message }));
			} else {
				console.error(`${colors.red}Erreur team : ${e.message}${colors.reset}`);
			}
		}
	});

// 17. shell command
program
	.command("shell")
	.aliases(["repl"])
	.description("Démarre le terminal interactif Azalée (mode REPL)")
	.action(async () => {
		console.clear();
		console.log(`
${colors.bold}${colors.magenta}🌸=======================================================🌸
    Bienvenue dans le shell interactif AZALÉE CLI !
    Version 1.1.0 (Bun Runtime)
=======================================================🌸${colors.reset}
Entrez une commande pour interagir avec le projet (ou 'help').
Tapez '${colors.bold}exit${colors.reset}' ou '${colors.bold}quit${colors.reset}' pour quitter.
`);

		const readline = require("node:readline");
		
		let svc: any = null;
		let characterCache: string[] = [];
		let skillCache: string[] = [];
		let itemCache: string[] = [];
		let teamCache: string[] = [];

		try {
			svc = await createInagleService();
			characterCache = svc.characters.baseCharacters().map((c: any) => c.names?.fr || c.names?.en || c.charaId).filter(Boolean);
			skillCache = svc.skills.all().map((s: any) => s.displayName || s.name_FR || s.name_EN || s.skillIDStr).filter(Boolean);
			itemCache = svc.items.allItems().map((i: any) => i.names?.fr || i.names?.en || i.itemId).filter(Boolean);
			teamCache = svc.teams.allTeams().map((t: any) => t.name || t.displayName || t.teamId).filter(Boolean);
		} catch (e) {
			// ignore fallback
		}

		const commands = ['help', 'chara', 'search', 'translate', 'dialogue', 'skill', 'item', 'team', 'db', 'status', 'audit', 'wave', 'sync', 'repair', 'redis', 'glossary-rebuild', 'exit', 'quit'];
		
		function completer(line: string) {
			const trimmed = line.trim();
			if (!trimmed) {
				return [commands, line];
			}
			const parts = trimmed.split(/\s+/);
			const cmd = parts[0].toLowerCase();
			if (parts.length === 1) {
				const hits = commands.filter((c) => c.startsWith(cmd));
				return [hits.length ? hits : commands, line];
			}
			const query = parts.slice(1).join(" ").toLowerCase();
			if (cmd === 'chara' || cmd === 'c') {
				const hits = characterCache.filter(name => name.toLowerCase().startsWith(query));
				return [hits.map(name => `${cmd} "${name}"`), line];
			}
			if (cmd === 'skill' || cmd === 'k') {
				const hits = skillCache.filter(name => name.toLowerCase().startsWith(query));
				return [hits.map(name => `${cmd} "${name}"`), line];
			}
			if (cmd === 'item' || cmd === 'i') {
				const hits = itemCache.filter(name => name.toLowerCase().startsWith(query));
				return [hits.map(name => `${cmd} "${name}"`), line];
			}
			if (cmd === 'team' || cmd === 't') {
				const hits = teamCache.filter(name => name.toLowerCase().startsWith(query));
				return [hits.map(name => `${cmd} "${name}"`), line];
			}
			return [[], line];
		}

		const historyPath = path.resolve(process.cwd(), ".azalee_history");
		let history: string[] = [];
		if (existsSync(historyPath)) {
			try {
				history = readFileSync(historyPath, "utf-8").split("\n").filter(Boolean);
			} catch {}
		}

		const rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
			prompt: `${colors.bold}${colors.green}azalee 🌸 > ${colors.reset}`,
			completer: completer,
		});

		if (history.length > 0) {
			rl.history = history.reverse();
		}
		
		activeRl = rl;
		rl.prompt();

		rl.on("line", async (line: string) => {
			const input = line.trim();
			if (!input) {
				rl.prompt();
				return;
			}

			// Save to history file
			try {
				const fs = require("node:fs");
				fs.appendFileSync(historyPath, input + "\n");
			} catch {}

			// Check pending selection
			if (pendingSelection) {
				const index = parseInt(input, 10) - 1;
				if (!isNaN(index) && index >= 0 && index < pendingSelection.matches.length) {
					const match = pendingSelection.matches[index];
					rl.pause();
					try {
						if (!svc) svc = await createInagleService();
						if (pendingSelection.type === "chara") {
							console.log(renderCharaProfile(match, svc));
						} else if (pendingSelection.type === "skill") {
							console.log(renderSkillProfile(match, svc));
						} else if (pendingSelection.type === "item") {
							console.log(renderItemProfile(match));
						} else if (pendingSelection.type === "team") {
							console.log(renderTeamProfile(match));
						}
					} catch (e: any) {
						console.error(`${colors.red}Erreur d'affichage : ${e.message}${colors.reset}`);
					}
					pendingSelection = null;
					rl.setPrompt(`${colors.bold}${colors.green}azalee 🌸 > ${colors.reset}`);
					rl.resume();
					rl.prompt();
					return;
				} else {
					if (/^\d+$/.test(input)) {
						console.log(`${colors.yellow}Sélection invalide (index hors limites). Sélection annulée.${colors.reset}`);
						pendingSelection = null;
						rl.setPrompt(`${colors.bold}${colors.green}azalee 🌸 > ${colors.reset}`);
						rl.prompt();
						return;
					} else {
						console.log(`${colors.yellow}Sélection annulée.${colors.reset}`);
						pendingSelection = null;
						rl.setPrompt(`${colors.bold}${colors.green}azalee 🌸 > ${colors.reset}`);
						// Fall through to run input as a command immediately
					}
				}
			}

			const parts = parseReplArgs(input);
			const cmd = parts[0].toLowerCase();

			if (cmd === "exit" || cmd === "quit" || cmd === "q") {
				console.log(`\nAu revoir ! 🌸`);
				process.exit(0);
			}

			if (cmd === "help" || cmd === "h") {
				console.log(`
Commandes disponibles :
  ${colors.bold}help${colors.reset}, ${colors.bold}h${colors.reset}          Affiche cette aide
  ${colors.bold}chara${colors.reset} <query>     Détails d'un personnage (nom, stats, techniques)
  ${colors.bold}search${colors.reset} <query>    Recherche globale d'entités (joueurs, items, techniques)
  ${colors.bold}translate${colors.reset} <text>   Traduit du texte via glossaire consolidé
  ${colors.bold}dialogue${colors.reset} <query>   Recherche dans les répliques et dialogues narratifs
  ${colors.bold}skill${colors.reset} <query>      Détails d'une technique / compétence / passive
  ${colors.bold}item${colors.reset} <query>       Détails d'un objet (consommable, équipement, etc.)
  ${colors.bold}team${colors.reset} <query>       Détails d'une équipe (kits, saisons, etc.)
  ${colors.bold}db${colors.reset} <sql>          Exécute une requête SQL PostgreSQL
  ${colors.bold}status${colors.reset}            Diagnostic de santé système et services
  ${colors.bold}audit${colors.reset}             Audit de cohérence de la base
  ${colors.bold}wave${colors.reset} [--cycle]    Lance une vague de traitement de données
  ${colors.bold}sync${colors.reset} [--push]     Synchronise les données locales vers PostgreSQL
  ${colors.bold}repair${colors.reset}            Répare les permissions et privilèges PostgreSQL
  ${colors.bold}exit${colors.reset}, ${colors.bold}quit${colors.reset}        Quitte le shell
`);
				rl.prompt();
				return;
			}

			// Pause readline during async command execution
			rl.pause();

			try {
				program.exitOverride();
				isReplMode = true;
				
				// Prepend dummy argv elements for commander
				const argv = ["bun", "azalee", ...parts];
				await program.parseAsync(argv);
			} catch (err: any) {
				if (err.code === "commander.helpDisplayed" || err.code === "commander.help") {
					// Handled
				} else if (err.code === "commander.unknownCommand") {
					console.log(`${colors.red}Commande inconnue: '${cmd}'. Tapez 'help' pour voir la liste.${colors.reset}`);
				} else {
					console.error(`${colors.red}Erreur d'exécution: ${err.message}${colors.reset}`);
				}
			} finally {
				isReplMode = false;
				rl.resume();
				rl.prompt();
			}
		});
	});

program.parse();

