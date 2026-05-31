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
import { isKana, toKatakana, toHiragana, toRomaji } from "wanakana";
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

// Helper to get full skill details
function getSkillDetails(svc: any, skillId: string) {
	const s = svc.skills.get(skillId) || svc.skills.passiveGet(skillId) || svc.skills.auraGet(skillId);
	if (!s) return { id: skillId, name: skillId };
	return {
		id: skillId,
		name: s.displayName || s.name_FR || s.name_EN || s.name_JA || skillId,
		power: s.power_max ?? s.power ?? undefined,
		cost: s.cost ?? s.tp ?? undefined,
		element: s.elementName?.fr || s.elementName?.en || undefined,
		category: s.categoryName?.fr || s.categoryName?.en || undefined,
	};
}

// Helper to get interpolated stats
function getInterpolatedStats(variant: any, level: number) {
	const stats = variant.stats?.lv99 || { kick: 0, control: 0, technique: 0, pressure: 0, physical: 0, agility: 0, intelligence: 0 };
	const statsLv1 = variant.stats?.lv1;
	const statsLv30 = variant.stats?.lv30;
	const statsLv50 = variant.stats?.lv50;

	if (level === 99) return stats;
	if (level === 1 && statsLv1) return statsLv1;

	const hasCompleteData = statsLv1 && statsLv30 && statsLv50;
	if (!hasCompleteData) {
		const startStats = statsLv1 || stats;
		const endStats = stats;
		const t = (level - 1) / 98;
		const lerp = (start: number, end: number) => Math.floor(start + (end - start) * t);
		
		return {
			kick: lerp(startStats.kick, endStats.kick),
			control: lerp(startStats.control, endStats.control),
			technique: lerp(startStats.technique, endStats.technique),
			pressure: lerp(startStats.pressure, endStats.pressure),
			physical: lerp(startStats.physical, endStats.physical),
			agility: lerp(startStats.agility, endStats.agility),
			intelligence: lerp(startStats.intelligence, endStats.intelligence),
		};
	}

	const getInterpolatedStat = (key: string) => {
		const s1 = statsLv1[key] || 0;
		const s30 = statsLv30[key] || 0;
		const s50 = statsLv50[key] || 0;
		const s99 = stats[key] || 0;

		if (level <= 30) {
			return Math.floor(s1 + (s30 - s1) * ((level - 1) / 29));
		}
		if (level <= 50) {
			return Math.floor(s30 + (s50 - s30) * ((level - 30) / 20));
		}
		return Math.floor(s50 + (s99 - s50) * ((level - 50) / 49));
	};

	return {
		kick: getInterpolatedStat("kick"),
		control: getInterpolatedStat("control"),
		technique: getInterpolatedStat("technique"),
		pressure: getInterpolatedStat("pressure"),
		physical: getInterpolatedStat("physical"),
		agility: getInterpolatedStat("agility"),
		intelligence: getInterpolatedStat("intelligence"),
	};
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

function wanakanaToRomaji(name: string): string | null {
	if (!name) return null;
	const hasKana = [...name].some((ch) => isKana(ch));
	if (!hasKana) return null;
	const parts = name.split(/[・\s]+/).filter(Boolean);
	return parts
		.map((p) => {
			const r = toRomaji(p);
			return r.charAt(0).toUpperCase() + r.slice(1);
		})
		.join(" ");
}

async function searchDatabaseTranslate(query: string): Promise<any[]> {
	const sanitized = query.replaceAll(/[%_,().*\\]/g, "").trim();
	if (!sanitized) return [];

	const q = `%${sanitized}%`;

	const hira = toHiragana(sanitized.toLowerCase());
	const kata = toKatakana(sanitized.toLowerCase());
	const isValidHira = hira.length > 0 && [...hira].every((c) => isKana(c) || c === "ー");
	const isValidKata = kata.length > 0 && [...kata].every((c) => isKana(c) || c === "ー");

	// Try PostgreSQL first
	const dbUrl = process.env.DATABASE_URL;
	if (dbUrl) {
		try {
			const pg = require("pg");
			const client = new pg.Client({ connectionString: dbUrl });
			await client.connect();

			const results: any[] = [];

			// Characters
			let charSql = `
				SELECT slug as id, 'character' as type, 'Personnage' as "typeLabel", 
				       name_fr, name_en, name_ja, name_roma, ('/chara/' || slug) as url
				FROM inagle_characters
				WHERE name_fr ILIKE $1 OR name_en ILIKE $1 OR name_ja ILIKE $1 OR name_roma ILIKE $1
				  AND internal_code NOT LIKE '%_5000'
				ORDER BY name_fr ASC LIMIT 10
			`;
			let charParams: any[] = [q];
			if (isValidHira && hira !== sanitized.toLowerCase()) {
				charSql = charSql.replace("OR name_roma ILIKE $1", `OR name_roma ILIKE $1 OR name_ja ILIKE $2`);
				charParams.push(`%${hira}%`);
			}
			if (isValidKata && kata !== sanitized.toLowerCase()) {
				const paramIndex = charParams.length + 1;
				charSql = charSql.replace("OR name_ja ILIKE $2", `OR name_ja ILIKE $2 OR name_ja ILIKE $${paramIndex}`);
				charParams.push(`%${kata}%`);
			}

			const charRes = await client.query(charSql, charParams);
			results.push(...charRes.rows);

			// Skills
			const skillRes = await client.query(`
				SELECT id::text, 'skill' as type, 'Technique' as "typeLabel", 
				       name_fr, name_en, name_ja, NULL as name_roma, ('/skill/' || id) as url
				FROM inagle_skills
				WHERE name_fr ILIKE $1 OR name_en ILIKE $1 OR name_ja ILIKE $1
				ORDER BY name_fr ASC LIMIT 10
			`, [q]);
			results.push(...skillRes.rows);

			// Teams
			const teamRes = await client.query(`
				SELECT id::text, 'team' as type, 'Équipe' as "typeLabel", 
				       name_fr, name_en, name_ja, NULL as name_roma, ('/team/' || id) as url
				FROM inagle_teams
				WHERE name_fr ILIKE $1 OR name_en ILIKE $1 OR name_ja ILIKE $1
				ORDER BY name_fr ASC LIMIT 10
			`, [q]);
			results.push(...teamRes.rows);

			// Items
			const itemRes = await client.query(`
				SELECT id::text, 'item' as type, 'Objet' as "typeLabel", 
				       name_fr, name_en, name_ja, NULL as name_roma, ('/item/' || id) as url
				FROM inagle_items
				WHERE category != 'special_tactics' AND (name_fr ILIKE $1 OR name_en ILIKE $1 OR name_ja ILIKE $1)
				ORDER BY name_fr ASC LIMIT 10
			`, [q]);
			results.push(...itemRes.rows);

			await client.end();
			return results;
		} catch {
			// Fail silently to try SQLite fallback
		}
	}

	// SQLite fallback
	const dbPath = getSqlitePath();
	if (dbPath) {
		try {
			const { Database: DBConstructor } = require("bun:sqlite");
			const db = new DBConstructor(dbPath, { readonly: true });
			const results: any[] = [];

			const queryRun = (sql: string, params: any[]) => {
				const stmt = db.prepare(sql);
				return stmt.all(...params);
			};

			// Characters
			let charSql = `
				SELECT id, 'character' as type, 'Personnage' as typeLabel,
				       name_fr, name_en, name_ja, slug,
				       ('/chara/' || slug) as url
				FROM inagle_characters
				WHERE name_fr LIKE ?1 OR name_en LIKE ?1 OR name_ja LIKE ?1
				  AND internal_code NOT LIKE '%_5000'
				ORDER BY name_fr ASC LIMIT 10
			`;
			let charParams: any[] = [q];
			if (isValidHira && hira !== sanitized.toLowerCase()) {
				charSql = charSql.replace("OR name_ja LIKE ?1", `OR name_ja LIKE ?1 OR name_ja LIKE ?2`);
				charParams.push(`%${hira}%`);
			}
			if (isValidKata && kata !== sanitized.toLowerCase()) {
				const paramIndex = charParams.length + 1;
				charSql = charSql.replace("OR name_ja LIKE ?2", `OR name_ja LIKE ?2 OR name_ja LIKE ?${paramIndex}`);
				charParams.push(`%${kata}%`);
			}

			const chars = queryRun(charSql, charParams);
			for (const c of chars) {
				results.push({
					id: c.id,
					type: c.type,
					typeLabel: c.typeLabel,
					name_fr: c.name_fr,
					name_en: c.name_en,
					name_ja: c.name_ja,
					name_roma: c.name_ja ? wanakanaToRomaji(c.name_ja) : null,
					url: c.url
				});
			}

			// Skills
			let skillSql = `
				SELECT id, 'skill' as type, 'Technique' as typeLabel,
				       name_fr, name_en, name_ja, ('/skill/' || id) as url
				FROM inagle_skills
				WHERE name_fr LIKE ?1 OR name_en LIKE ?1 OR name_ja LIKE ?1
				ORDER BY name_fr ASC LIMIT 10
			`;
			const skills = queryRun(skillSql, [q]);
			for (const s of skills) {
				results.push({
					id: s.id,
					type: s.type,
					typeLabel: s.typeLabel,
					name_fr: s.name_fr,
					name_en: s.name_en,
					name_ja: s.name_ja,
					name_roma: s.name_ja ? wanakanaToRomaji(s.name_ja) : null,
					url: s.url
				});
			}

			// Teams
			let teamSql = `
				SELECT id, 'team' as type, 'Équipe' as typeLabel,
				       name_fr, name_en, name_ja, ('/team/' || id) as url
				FROM inagle_teams
				WHERE name_fr LIKE ?1 OR name_en LIKE ?1 OR name_ja LIKE ?1
				ORDER BY name_fr ASC LIMIT 10
			`;
			const teams = queryRun(teamSql, [q]);
			for (const t of teams) {
				results.push({
					id: t.id,
					type: t.type,
					typeLabel: t.typeLabel,
					name_fr: t.name_fr,
					name_en: t.name_en,
					name_ja: t.name_ja,
					name_roma: t.name_ja ? wanakanaToRomaji(t.name_ja) : null,
					url: t.url
				});
			}

			// Items
			let itemSql = `
				SELECT id, 'item' as type, 'Objet' as typeLabel,
				       name_fr, name_en, name_ja, ('/item/' || id) as url
				FROM inagle_items
				WHERE category != 'special_tactics' AND (name_fr LIKE ?1 OR name_en LIKE ?1 OR name_ja LIKE ?1)
				ORDER BY name_fr ASC LIMIT 10
			`;
			const items = queryRun(itemSql, [q]);
			for (const i of items) {
				results.push({
					id: i.id,
					type: i.type,
					typeLabel: i.typeLabel,
					name_fr: i.name_fr,
					name_en: i.name_en,
					name_ja: i.name_ja,
					name_roma: i.name_ja ? wanakanaToRomaji(i.name_ja) : null,
					url: i.url
				});
			}

			db.close();
			return results;
		} catch {
			// Ignore sqlite errors
		}
	}

	return [];
}

async function searchGlossaryTranslate(query: string): Promise<any[]> {
	const glossaryPath = path.join(process.cwd(), "data", "glossary.json");
	const glossaryFile = Bun.file(glossaryPath);
	if (!(await glossaryFile.exists())) return [];

	try {
		const glossary = await glossaryFile.json();
		const sanitized = query.replaceAll(/[%_,().*\\]/g, "").trim().toLowerCase();
		if (!sanitized) return [];

		const hiraCandidate = toHiragana(sanitized).toLowerCase();
		const kataCandidate = toKatakana(sanitized).toLowerCase();

		const isValidHira = hiraCandidate.length > 0 && [...hiraCandidate].every((c) => isKana(c) || c === "ー");
		const isValidKata = kataCandidate.length > 0 && [...kataCandidate].every((c) => isKana(c) || c === "ー");

		const results: any[] = [];

		const searchCategory = (catName: string, type: string, typeLabel: string, urlPrefix: string) => {
			const list = glossary[catName] || [];
			for (const entry of list) {
				let matched = false;
				const enLower = (entry.en || "").toLowerCase();
				const frLower = (entry.fr || "").toLowerCase();
				const jaLower = (entry.ja || "").toLowerCase();

				if (enLower.includes(sanitized) || frLower.includes(sanitized) || jaLower.includes(sanitized)) {
					matched = true;
				} else if (isValidHira && jaLower.includes(hiraCandidate)) {
					matched = true;
				} else if (isValidKata && jaLower.includes(kataCandidate)) {
					matched = true;
				} else if (entry.ja) {
					const roma = wanakanaToRomaji(entry.ja);
					if (roma && roma.toLowerCase().includes(sanitized)) {
						matched = true;
					}
				}

				if (matched) {
					const id = entry.code || entry.en || entry.ja || Math.random().toString();
					let finalType = type;
					let finalTypeLabel = typeLabel;
					let finalUrl = `${urlPrefix}/${id}`;

					if (type === "aura") {
						const isSoul = entry.subType === "soul" || (entry.subType && entry.subType.toLowerCase().includes("soul"));
						finalType = isSoul ? "soul" : "keshin";
						finalTypeLabel = isSoul ? "Totem" : "Esprit Guerrier";
						finalUrl = isSoul ? `/aura/totems/${id}` : `/aura/esprits-guerriers/${id}`;
					}

					results.push({
						id,
						type: finalType,
						typeLabel: finalTypeLabel,
						name_fr: entry.fr || entry.en || null,
						name_en: entry.en || null,
						name_ja: entry.ja || null,
						name_roma: entry.ja ? wanakanaToRomaji(entry.ja) : null,
						url: finalUrl,
					});
				}
			}
		};

		searchCategory("characters", "character", "Personnage", "/chara");
		searchCategory("techniques", "skill", "Technique", "/skill");
		searchCategory("auras", "aura", "Aura", "/aura");
		searchCategory("passives", "skill", "Technique", "/skill");
		searchCategory("teams", "team", "Équipe", "/team");
		searchCategory("items", "item", "Objet", "/item");
		searchCategory("terms", "term", "Terme", "#");

		return results;
	} catch {
		return [];
	}
}

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
					`${colors.cyan}Langue source détectée : ${isJa ? "Japonais" : "Anglais/Français"}${colors.reset}`
				);
			}

			// Run unified database & glossary search for matches
			const [dbResults, glossaryResults] = await Promise.all([
				searchDatabaseTranslate(inputText),
				searchGlossaryTranslate(inputText)
			]);

			const seen = new Set<string>();
			const merged: any[] = [];

			if (dbResults) {
				for (const r of dbResults) {
					const key = `${r.type}-${r.id}`.toLowerCase();
					if (!seen.has(key)) {
						seen.add(key);
						merged.push(r);
					}
				}
			}

			if (glossaryResults) {
				for (const r of glossaryResults) {
					const key = `${r.type}-${r.id}`.toLowerCase();
					const nameKey = `${r.type}-${r.name_fr || r.name_en}`.toLowerCase();
					if (!seen.has(key) && !seen.has(nameKey)) {
						seen.add(key);
						seen.add(nameKey);
						merged.push(r);
					}
				}
			}

			// Sort by relevance: exact match > prefix > contains
			const queryLower = inputText.toLowerCase();
			merged.sort((a, b) => {
				const scoreOf = (r: any) => {
					for (const name of [r.name_fr, r.name_en, r.name_ja, r.name_roma]) {
						if (!name) continue;
						const n = name.toLowerCase();
						if (n === queryLower) return 3;
						if (n.startsWith(queryLower)) return 2;
					}
					return 1;
				};
				return scoreOf(b) - scoreOf(a);
			});

			const translatedBlock = await translateTextHelper(inputText);

			if (options.json) {
				restoreLogs(true);
				console.log(
					JSON.stringify({
						original: inputText,
						detectedLanguage: isJa ? "ja" : "en",
						translatedText: translatedBlock,
						matches: merged.slice(0, 15)
					}, null, 2)
				);
			} else {
				if (merged.length > 0) {
					console.log(`\n${colors.bold}${colors.blue}Entités trouvées dans la base & le glossaire :${colors.reset}`);
					const rows = merged.slice(0, 15).map((r) => ({
						Type: r.typeLabel,
						"Nom FR": r.name_fr || "—",
						"Nom EN": r.name_en || "—",
						"Nom JA": r.name_ja || "—",
						Romaji: r.name_roma || "—"
					}));
					console.log(renderAsciiTable(rows));
				}
				
				console.log(`\n${colors.bold}${colors.green}Traduction brute du texte :${colors.reset}`);
				console.log(translatedBlock);
			}
			process.exit(0);
		} catch (e: any) {
			restoreLogs(!!options.json);
			if (options.json) {
				console.log(JSON.stringify({ error: e.message }));
			} else {
				console.error(`${colors.red}Erreur de traduction : ${e.message}${colors.reset}`);
			}
			process.exit(1);
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
			const missingImg = chars.filter((c) => !c.icons?.face && !c.image_url && !c.zukan_hash && !c.zukanHash && !c.image);
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

// 11b. compare command
program
	.command("compare <chara1> <chara2>")
	.description("Compare deux joueurs côte à côte (stats interpolées et moveset)")
	.option("-l, --level <level>", "Niveau à comparer (1-99)", "99")
	.option("-j, --json", "Format de sortie en JSON brut")
	.action(async (chara1: string, chara2: string, options: { level: string; json?: boolean }) => {
		suppressLogs(!!options.json);
		try {
			const level = parseInt(options.level, 10);
			if (isNaN(level) || level < 1 || level > 99) {
				restoreLogs(!!options.json);
				if (options.json) {
					console.log(JSON.stringify({ error: "Le niveau doit être compris entre 1 et 99." }));
				} else {
					console.error(`${colors.red}Erreur: Le niveau doit être compris entre 1 et 99.${colors.reset}`);
				}
				return;
			}

			const svc = await createInagleService();
			const chars = svc.characters.baseCharacters();

			const findMatch = (query: string) => {
				const q = query.toLowerCase().trim();
				// exact check
				let exactMatches = chars.filter((c: any) => 
					c.charaId.toLowerCase() === q || 
					c.internalCode?.toLowerCase() === q ||
					c.slug?.toLowerCase() === q ||
					c.names?.fr?.toLowerCase() === q ||
					c.names?.en?.toLowerCase() === q
				);
				if (exactMatches.length > 0) return exactMatches;

				// substring check
				let matches = chars.filter((c: any) => {
					const nameFr = c.names?.fr?.toLowerCase() || "";
					const nameEn = c.names?.en?.toLowerCase() || "";
					const nameJa = c.names?.ja?.toLowerCase() || "";
					const slug = c.slug?.toLowerCase() || "";
					return nameFr.includes(q) || nameEn.includes(q) || nameJa.includes(q) || slug.includes(q);
				});
				return matches;
			};

			const matches1 = findMatch(chara1);
			const matches2 = findMatch(chara2);

			if (matches1.length === 0 || matches2.length === 0) {
				restoreLogs(!!options.json);
				const errorMsg = matches1.length === 0 && matches2.length === 0
					? `Aucun joueur trouvé pour "${chara1}" et "${chara2}".`
					: matches1.length === 0
						? `Aucun joueur trouvé pour "${chara1}".`
						: `Aucun joueur trouvé pour "${chara2}".`;
				if (options.json) {
					console.log(JSON.stringify({ error: errorMsg }));
				} else {
					console.error(`${colors.red}Erreur: ${errorMsg}${colors.reset}`);
				}
				return;
			}

			// If multiple matches, take the first
			const c1 = matches1[0];
			const c2 = matches2[0];

			const v1 = c1.variants?.[0];
			const v2 = c2.variants?.[0];

			if (!v1 || !v2) {
				restoreLogs(!!options.json);
				const errorMsg = "Données de variante introuvables pour l'un des joueurs.";
				if (options.json) {
					console.log(JSON.stringify({ error: errorMsg }));
				} else {
					console.error(`${colors.red}Erreur: ${errorMsg}${colors.reset}`);
				}
				return;
			}

			const stats1 = getInterpolatedStats(v1, level);
			const stats2 = getInterpolatedStats(v2, level);

			const resolveMoves = (variant: any, baseChara: any) => {
				const PHANTOM_SKILL_IDS = new Set(["0xDBEDB6B8"]);
				const rawSkills = variant.skills || [];
				let skillList = rawSkills.filter((sk: any) => sk.skillId && !PHANTOM_SKILL_IDS.has(sk.skillId));
				
				// Sibling inheritance fallback
				if (skillList.length === 0 && baseChara.variants) {
					for (const sibling of baseChara.variants) {
						if (sibling.skills && sibling.skills.length > 0) {
							const sibSkills = sibling.skills.filter((sk: any) => sk.skillId && !PHANTOM_SKILL_IDS.has(sk.skillId));
							if (sibSkills.length > 0) {
								skillList = sibSkills;
								break;
							}
						}
					}
				}

				return skillList.map((sk: any) => {
					const details = getSkillDetails(svc, sk.skillId);
					return {
						learnLevel: sk.learnLevel,
						...details
					};
				});
			};

			const skills1 = resolveMoves(v1, c1);
			const skills2 = resolveMoves(v2, c2);

			if (options.json) {
				restoreLogs(true);
				console.log(JSON.stringify({
					level,
					chara1: {
						id: c1.charaId,
						name: c1.names.fr || c1.names.en || c1.names.ja,
						position: v1.position,
						element: v1.element,
						rarity: v1.rarity,
						stats: stats1,
						skills: skills1
					},
					chara2: {
						id: c2.charaId,
						name: c2.names.fr || c2.names.en || c2.names.ja,
						position: v2.position,
						element: v2.element,
						rarity: v2.rarity,
						stats: stats2,
						skills: skills2
					}
				}, null, 2));
				return;
			}

			// ASCII Table rendering
			restoreLogs(true);
			const colWidthL = 35;
			const colWidthM = 16;
			const colWidthR = 35;

			const padCenter = (text: string, width: number): string => {
				const pad = width - text.length;
				if (pad <= 0) return text.substring(0, width);
				const left = Math.floor(pad / 2);
				const right = pad - left;
				return " ".repeat(left) + text + " ".repeat(right);
			};

			const formatRow = (leftText: string, midText: string, rightText: string, leftColor = "", midColor = "", rightColor = "") => {
				const rawLeft = leftText.substring(0, colWidthL);
				const rawMid = midText.substring(0, colWidthM);
				const rawRight = rightText.substring(0, colWidthR);
				
				const padL = rawLeft.padEnd(colWidthL);
				const padM = padCenter(rawMid, colWidthM);
				const padR = rawRight.padStart(colWidthR);

				const coloredL = leftColor ? `${leftColor}${padL}${colors.reset}` : padL;
				const coloredM = midColor ? `${midColor}${padM}${colors.reset}` : padM;
				const coloredR = rightColor ? `${rightColor}${padR}${colors.reset}` : padR;

				return `│ ${coloredL} │ ${coloredM} │ ${coloredR} │`;
			};

			const borderTop = `┌─${"─".repeat(colWidthL)}─┬─${"─".repeat(colWidthM)}─┬─${"─".repeat(colWidthR)}─┐`;
			const borderDivider = `├─${"─".repeat(colWidthL)}─┼─${"─".repeat(colWidthM)}─┼─${"─".repeat(colWidthR)}─┤`;
			const borderBottom = `└─${"─".repeat(colWidthL)}─┴─${"─".repeat(colWidthM)}─┴─${"─".repeat(colWidthR)}─┘`;

			console.log(`\n${colors.cyan}=== COMPARAISON DE JOUEURS (Niveau ${level}) ===${colors.reset}`);
			console.log(borderTop);

			const name1 = c1.names.fr || c1.names.en || c1.names.ja;
			const name2 = c2.names.fr || c2.names.en || c2.names.ja;

			console.log(formatRow(name1, "VS", name2, colors.bold + colors.green, colors.bold + colors.magenta, colors.bold + colors.green));
			console.log(borderDivider);
			
			console.log(formatRow(v1.position, "Position", v2.position));
			console.log(formatRow(v1.element, "Élément", v2.element));
			console.log(formatRow(v1.rarity, "Rareté", v2.rarity));
			console.log(borderDivider);

			const statKeys: Array<{ key: "kick" | "control" | "technique" | "pressure" | "physical" | "agility" | "intelligence"; label: string }> = [
				{ key: "kick", label: "Frappe" },
				{ key: "control", label: "Contrôle" },
				{ key: "technique", label: "Technique" },
				{ key: "pressure", label: "Pression" },
				{ key: "physical", label: "Physique" },
				{ key: "agility", label: "Agilité" },
				{ key: "intelligence", label: "Intelligence" }
			];

			let total1 = 0;
			let total2 = 0;

			for (const { key, label } of statKeys) {
				const val1 = stats1[key];
				const val2 = stats2[key];
				total1 += val1;
				total2 += val2;

				let cL = "";
				let cR = "";
				let showVal1 = String(val1);
				let showVal2 = String(val2);

				if (val1 > val2) {
					cL = colors.green + colors.bold;
					cR = colors.red;
					showVal1 += " (▲)";
				} else if (val2 > val1) {
					cL = colors.red;
					cR = colors.green + colors.bold;
					showVal2 = "(▲) " + showVal2;
				}

				console.log(formatRow(showVal1, label, showVal2, cL, colors.cyan, cR));
			}

			console.log(borderDivider);
			let totalCL = "";
			let totalCR = "";
			let showTotal1 = String(total1);
			let showTotal2 = String(total2);
			if (total1 > total2) {
				totalCL = colors.green + colors.bold;
				totalCR = colors.red;
				showTotal1 += " (▲)";
			} else if (total2 > total1) {
				totalCL = colors.red;
				totalCR = colors.green + colors.bold;
				showTotal2 = "(▲) " + showTotal2;
			}
			console.log(formatRow(showTotal1, "TOTAL", showTotal2, totalCL, colors.bold + colors.yellow, totalCR));
			console.log(borderDivider);

			const maxMoves = Math.max(skills1.length, skills2.length);
			console.log(formatRow("", "TECHNIQUES", "", "", colors.bold + colors.magenta));
			
			for (let i = 0; i < maxMoves; i++) {
				const sk1 = skills1[i];
				const sk2 = skills2[i];

				const text1 = sk1 ? `${sk1.name} (L. ${sk1.learnLevel}${sk1.power ? `, ${sk1.power}P` : ""})` : "";
				const text2 = sk2 ? `${sk2.name} (L. ${sk2.learnLevel}${sk2.power ? `, ${sk2.power}P` : ""})` : "";

				console.log(formatRow(text1, `Slot ${i + 1}`, text2));
			}
			console.log(borderBottom);

		} catch (e: any) {
			restoreLogs(!!options.json);
			if (options.json) {
				console.log(JSON.stringify({ error: e.message }));
			} else {
				console.error(`${colors.red}Erreur lors de la comparaison: ${e.message}${colors.reset}`);
			}
		} finally {
			if (!isReplMode) process.exit(0);
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

// 17. random-team command
program
	.command("random-team")
	.description("Génère une équipe aléatoire complète de 11 joueurs, coach et managers")
	.option("-f, --formation <formation>", "Configuration de la formation (ex: 4-4-2, 4-3-3, 3-5-2)", "4-4-2")
	.option("-e, --element <element>", "Filtrer de préférence par élément (Feu, Vent, Forêt, Montagne)")
	.option("-p, --playstyle <playstyle>", "Filtrer de préférence par style (Lien, Justice, Percée, Tension, Jeu violent, Contre)")
	.option("-j, --json", "Format de sortie en JSON brute")
	.action(async (options: { formation: string; element?: string; playstyle?: string; json?: boolean }) => {
		suppressLogs(!!options.json);
		try {
			const FORMATIONS = [
				{ def: 3, df: 4, fw: 2, layout: "4-4-2", mf: 4, name: "4-4-2", off: 3 },
				{ def: 2, df: 4, fw: 3, layout: "4-3-3", mf: 3, name: "4-3-3", off: 4 },
				{ def: 2, df: 3, fw: 3, layout: "3-4-3", mf: 4, name: "3-4-3", off: 4 },
				{ def: 3, df: 3, fw: 2, layout: "3-5-2", mf: 5, name: "3-5-2", off: 3 },
				{ def: 4, df: 4, fw: 1, layout: "4-5-1", mf: 5, name: "4-5-1", off: 2 },
				{ def: 3, df: 3, fw: 1, layout: "3-6-1", mf: 6, name: "3-6-1", off: 3 },
				{ def: 4, df: 5, fw: 1, layout: "5-4-1", mf: 4, name: "5-4-1", off: 2 },
				{ def: 1, df: 2, fw: 4, layout: "2-4-4", mf: 4, name: "2-4-4", off: 5 },
				{ def: 2, df: 2, fw: 3, layout: "2-5-3", mf: 5, name: "2-5-3", off: 4 },
				{ def: 4, df: 5, fw: 4, layout: "5-1-4", mf: 1, name: "5-1-4", off: 2 },
				{ def: 5, df: 3, fw: 4, layout: "3-3-4", mf: 3, name: "3-3-4", off: 1 },
				{ def: 3, df: 5, fw: 2, layout: "5-3-2", mf: 3, name: "5-3-2", off: 3 },
			];

			const dbPath = getSqlitePath();
			if (!dbPath) {
				restoreLogs(!!options.json);
				if (options.json) {
					console.log(JSON.stringify({ error: "Base de données SQLite introuvable" }));
				} else {
					console.error(`${colors.red}Erreur: Base de données SQLite introuvable.${colors.reset}`);
				}
				return;
			}

			const { Database: DBConstructor } = require("bun:sqlite");
			const db = new DBConstructor(dbPath, { readonly: true });

			const elementMap: Record<string, string> = {
				fire: "Feu",
				feu: "Feu",
				wind: "Vent",
				vent: "Vent",
				forest: "Forêt",
				forêt: "Forêt",
				foret: "Forêt",
				mountain: "Montagne",
				montagne: "Montagne",
				void: "Néant",
				néant: "Néant",
				neant: "Néant"
			};
			const elVal = options.element ? elementMap[options.element.toLowerCase()] : undefined;

			const psMap: Record<string, string> = {
				bond: "Bond",
				lien: "Bond",
				justice: "Justice",
				breach: "Breach",
				percée: "Breach",
				percee: "Breach",
				tension: "Tension",
				"rough play": "Rough Play",
				"roughplay": "Rough Play",
				"jeu violent": "Rough Play",
				counter: "Counter",
				contre: "Counter"
			};
			const psVal = options.playstyle ? psMap[options.playstyle.toLowerCase()] : undefined;

			const layout = options.formation || "4-4-2";
			const formation = FORMATIONS.find(f => f.name === layout || f.layout === layout) || FORMATIONS[0];

			function pickRandom(arr: any[], n: number): any[] {
				const copy = [...arr];
				const result: any[] = [];
				for (let i = 0; i < n && copy.length > 0; i++) {
					const idx = Math.floor(Math.random() * copy.length);
					result.push(copy.splice(idx, 1)[0]);
				}
				return result;
			}

			function fetchPool(position: string, requiredCount: number) {
				let query = `SELECT id, chara_id, internal_code, name_fr, name_en, element, position, stat_frappe, stat_controle, stat_technique, stat_pression, stat_physique, stat_agilite, stat_intelligence, sheet_data, zukan_hash FROM inagle_characters WHERE position = ? AND stat_frappe IS NOT NULL AND zukan_hash IS NOT NULL`;
				let params: string[] = [position];
				
				let filterQuery = query;
				let filterParams = [...params];
				
				if (elVal) {
					filterQuery += " AND element = ?";
					filterParams.push(elVal);
				}
				if (psVal) {
					filterQuery += " AND json_extract(sheet_data, '$.playstyle') = ?";
					filterParams.push(psVal);
				}
				
				let rows = db.prepare(filterQuery).all(...filterParams);
				
				if (rows.length < requiredCount && psVal) {
					let fbQuery = query;
					let fbParams = [...params];
					if (elVal) {
						fbQuery += " AND element = ?";
						fbParams.push(elVal);
					}
					rows = db.prepare(fbQuery).all(...fbParams);
				}
				
				if (rows.length < requiredCount) {
					rows = db.prepare(query).all(...params);
				}
				
				return rows;
			}

			const gk = pickRandom(fetchPool("Gardien", 1), 1);
			const df = pickRandom(fetchPool("Défenseur", formation.df), formation.df);
			const mf = pickRandom(fetchPool("Milieu", formation.mf), formation.mf);
			const fw = pickRandom(fetchPool("Attaquant", formation.fw), formation.fw);

			const coachesPool = db.prepare("SELECT id, name_localised, name_romaji, element, playstyle, buff, role FROM inagle_coordinators WHERE role = 'Coach' OR role = 'Manager'").all();
			const managersPool = db.prepare("SELECT id, name_localised, name_romaji, element, playstyle, buff, role FROM inagle_coordinators WHERE role = 'Coordinator'").all();
			
			const coach = pickRandom(coachesPool, 1)[0] || null;
			const managers = pickRandom(managersPool, 3);

			db.close();

			const allPlayers = [...gk, ...df, ...mf, ...fw];

			if (options.json) {
				restoreLogs(true);
				const teamJson = {
					formation: formation.layout,
					gk: gk.map(p => ({ id: p.id, name: p.name_fr || p.name_en, element: p.element })),
					df: df.map(p => ({ id: p.id, name: p.name_fr || p.name_en, element: p.element })),
					mf: mf.map(p => ({ id: p.id, name: p.name_fr || p.name_en, element: p.element })),
					fw: fw.map(p => ({ id: p.id, name: p.name_fr || p.name_en, element: p.element })),
					coach: coach ? { id: coach.id, name: coach.name_localised || coach.name_romaji, element: coach.element, playstyle: coach.playstyle, buff: coach.buff } : null,
					managers: managers.map(m => ({ id: m.id, name: m.name_localised || m.name_romaji, element: m.element, playstyle: m.playstyle, buff: m.buff }))
				};
				console.log(JSON.stringify(teamJson, null, 2));
				return;
			}

			restoreLogs(true);

			// Stats computation
			const statsTotal = { frappe: 0, controle: 0, technique: 0, pression: 0, physique: 0, agilite: 0, intelligence: 0 };
			const elementCounts: Record<string, number> = {};
			const playstyleCounts: Record<string, number> = {};

			for (const p of allPlayers) {
				let kick = p.stat_frappe || 0;
				let ctrl = p.stat_controle || 0;
				let tech = p.stat_technique || 0;
				let pres = p.stat_pression || 0;
				let phys = p.stat_physique || 0;
				let agil = p.stat_agilite || 0;
				let intel = p.stat_intelligence || 0;

				try {
					const sd = typeof p.sheet_data === "string" ? JSON.parse(p.sheet_data) : p.sheet_data;
					if (sd?.stats) {
						kick = sd.stats.kick || kick;
						ctrl = sd.stats.control || ctrl;
						tech = sd.stats.technique || tech;
						pres = sd.stats.pressure || pres;
						phys = sd.stats.physical || phys;
						agil = sd.stats.agility || agil;
						intel = sd.stats.intelligence || intel;
					}
				} catch {}

				statsTotal.frappe += kick;
				statsTotal.controle += ctrl;
				statsTotal.technique += tech;
				statsTotal.pression += pres;
				statsTotal.physique += phys;
				statsTotal.agilite += agil;
				statsTotal.intelligence += intel;

				const el = p.element || "Néant";
				elementCounts[el] = (elementCounts[el] || 0) + 1;

				let ps = "Aucun";
				try {
					const sd = typeof p.sheet_data === "string" ? JSON.parse(p.sheet_data) : p.sheet_data;
					ps = sd?.playstyle || "Aucun";
				} catch {}
				playstyleCounts[ps] = (playstyleCounts[ps] || 0) + 1;
			}

			const pCount = allPlayers.length || 1;
			const statsAvg = {
				frappe: Math.round(statsTotal.frappe / pCount),
				controle: Math.round(statsTotal.controle / pCount),
				technique: Math.round(statsTotal.technique / pCount),
				pression: Math.round(statsTotal.pression / pCount),
				physique: Math.round(statsTotal.physique / pCount),
				agilite: Math.round(statsTotal.agilite / pCount),
				intelligence: Math.round(statsTotal.intelligence / pCount)
			};

			const synergies: string[] = [];
			for (const [el, num] of Object.entries(elementCounts)) {
				if (num >= 3) {
					const boost = num >= 6 ? 15 : num >= 4 ? 10 : 5;
					synergies.push(`${el} x${num} (+${boost}% boost)`);
				}
			}

			// Format text alignment helpers
			function centerText(text: string, width: number): string {
				const padTotal = width - text.length;
				if (padTotal <= 0) return text.substring(0, width);
				const padLeft = Math.floor(padTotal / 2);
				const padRight = padTotal - padLeft;
				return " ".repeat(padLeft) + text + " ".repeat(padRight);
			}

			function shortenName(name: string, maxLen: number = 14): string {
				if (name.length <= maxLen) return name;
				const parts = name.split(" ");
				if (parts.length > 1) {
					const first = parts[0];
					const last = parts[parts.length - 1];
					const shortened = `${first} ${last[0]}.`;
					if (shortened.length <= maxLen) return shortened;
				}
				return name.substring(0, maxLen - 1) + "…";
			}

			function formatPlayerForPitch(player: any, positionCode: string, maxNameLen: number): { display: string; length: number } {
				const name = player.name_fr || player.name_en || player.id;
				const el = player.element || "Néant";
				const shortName = shortenName(name, maxNameLen);
				
				const elAbbrMap: Record<string, string> = {
					"Feu": "Fe",
					"Vent": "Ve",
					"Forêt": "Fo",
					"Montagne": "Mo",
					"Néant": "Ne"
				};
				const elAbbr = elAbbrMap[el] || "Ne";
				const raw = `${shortName} (${elAbbr})`;
				
				const colorMap: Record<string, string> = {
					GK: colors.yellow,
					DF: colors.blue,
					MF: colors.green,
					FW: colors.red
				};
				const pColor = colorMap[positionCode] || colors.reset;
				const elColor = el === "Feu" ? colors.red : el === "Vent" ? colors.cyan : el === "Forêt" ? colors.green : el === "Montagne" ? colors.yellow : colors.reset;
				
				const display = `${colors.bold}${pColor}${shortName}${colors.reset} (${elColor}${elAbbr}${colors.reset})`;
				return { display, length: raw.length };
			}

			function centerRowOfPlayers(players: any[], positionCode: string, totalWidth: number = 78): string {
				const n = players.length;
				if (n === 0) return "";
				const colWidth = Math.floor(totalWidth / n);
				const maxNameLen = Math.max(5, colWidth - 6);
				
				let rowText = "";
				for (const p of players) {
					const { display, length } = formatPlayerForPitch(p, positionCode, maxNameLen);
					const padTotal = colWidth - length;
					const padLeft = Math.floor(Math.max(0, padTotal) / 2);
					const padRight = Math.max(0, padTotal - padLeft);
					rowText += " ".repeat(padLeft) + display + " ".repeat(padRight);
				}
				const leftOver = totalWidth - (n * colWidth);
				if (leftOver > 0) {
					rowText += " ".repeat(leftOver);
				}
				return rowText;
			}

			const fwRowText = centerRowOfPlayers(fw, "FW", 78);
			const mfRowText = centerRowOfPlayers(mf, "MF", 78);
			const dfRowText = centerRowOfPlayers(df, "DF", 78);
			const gkRowText = centerRowOfPlayers(gk, "GK", 78);

			console.log(`\n${colors.green}╔${"═".repeat(78)}╗${colors.reset}`);
			const titleRaw = `TERRAIN DE JEU - VICTORY ROAD (${formation.name})`;
			const titleColored = `${colors.bold}${colors.yellow}TERRAIN DE JEU - VICTORY ROAD (${formation.name})${colors.reset}`;
			const padTotal = 78 - titleRaw.length;
			const padLeft = Math.floor(padTotal / 2);
			const padRight = padTotal - padLeft;
			const titleRowText = " ".repeat(padLeft) + titleColored + " ".repeat(padRight);

			console.log(`${colors.green}║${colors.reset}${titleRowText}${colors.green}║${colors.reset}`);
			console.log(`${colors.green}╠${"═".repeat(78)}╣${colors.reset}`);
			console.log(`${colors.green}║${colors.reset}${" ".repeat(78)}${colors.green}║${colors.reset}`);
			console.log(`${colors.green}║${colors.reset}${fwRowText}${colors.green}║${colors.reset}`);
			console.log(`${colors.green}║${colors.reset}${" ".repeat(78)}${colors.green}║${colors.reset}`);
			const lineSepRaw = "─".repeat(60);
			const lineSepPad = centerText(lineSepRaw, 78);
			console.log(`${colors.green}║${colors.reset}${lineSepPad}${colors.green}║${colors.reset}`);
			console.log(`${colors.green}║${colors.reset}${" ".repeat(78)}${colors.green}║${colors.reset}`);
			console.log(`${colors.green}║${colors.reset}${mfRowText}${colors.green}║${colors.reset}`);
			console.log(`${colors.green}║${colors.reset}${" ".repeat(78)}${colors.green}║${colors.reset}`);
			console.log(`${colors.green}║${colors.reset}${lineSepPad}${colors.green}║${colors.reset}`);
			console.log(`${colors.green}║${colors.reset}${" ".repeat(78)}${colors.green}║${colors.reset}`);
			console.log(`${colors.green}║${colors.reset}${dfRowText}${colors.green}║${colors.reset}`);
			console.log(`${colors.green}║${colors.reset}${" ".repeat(78)}${colors.green}║${colors.reset}`);
			console.log(`${colors.green}║${colors.reset}${lineSepPad}${colors.green}║${colors.reset}`);
			console.log(`${colors.green}║${colors.reset}${" ".repeat(78)}${colors.green}║${colors.reset}`);
			console.log(`${colors.green}║${colors.reset}${gkRowText}${colors.green}║${colors.reset}`);
			console.log(`${colors.green}║${colors.reset}${" ".repeat(78)}${colors.green}║${colors.reset}`);
			console.log(`${colors.green}╚${"═".repeat(78)}╝${colors.reset}`);

			console.log(`\n${colors.bold}${colors.cyan}⚙️  CARACTÉRISTIQUES DE L'ÉQUIPE :${colors.reset}`);
			console.log(`  · ${colors.bold}Formation :${colors.reset} ${formation.name} (${formation.layout})`);
			console.log(`  · ${colors.bold}Moyennes de stats (Lv 99) :${colors.reset}`);
			console.log(`      Frappe: ${colors.yellow}${statsAvg.frappe}${colors.reset} | Contrôle: ${colors.yellow}${statsAvg.controle}${colors.reset} | Technique: ${colors.yellow}${statsAvg.technique}${colors.reset}`);
			console.log(`      Physique: ${colors.yellow}${statsAvg.physique}${colors.reset} | Pression: ${colors.yellow}${statsAvg.pression}${colors.reset} | Agilité: ${colors.yellow}${statsAvg.agilite}${colors.reset} | Intel.: ${colors.yellow}${statsAvg.intelligence}${colors.reset}`);
			
			console.log(`  · ${colors.bold}Synergies d'éléments :${colors.reset} ${synergies.length > 0 ? synergies.map(s => `${colors.green}${s}${colors.reset}`).join(", ") : "Aucune synergie active (3+ du même élément)"}`);
			
			console.log(`\n${colors.bold}${colors.cyan}👔 STAFF TECHNIQUE :${colors.reset}`);
			if (coach) {
				console.log(`  · [${colors.yellow}COACH${colors.reset}] ${colors.bold}${coach.name_localised || coach.name_romaji}${colors.reset} (${coach.element} | ${coach.playstyle || 'N/A'})`);
				if (coach.buff) console.log(`      Buff: ${colors.green}${coach.buff}${colors.reset}`);
			} else {
				console.log(`  · [${colors.yellow}COACH${colors.reset}] Aucun`);
			}
			console.log(`  · [${colors.yellow}MANAGERS${colors.reset}]`);
			for (const m of managers) {
				console.log(`      - ${colors.bold}${m.name_localised || m.name_romaji}${colors.reset} (${m.element} | ${m.playstyle || 'N/A'})${m.buff ? ` -> Buff: ${colors.green}${m.buff}${colors.reset}` : ""}`);
			}
			console.log();
		} catch (e: any) {
			restoreLogs(!!options.json);
			if (options.json) {
				console.log(JSON.stringify({ error: e.message }));
			} else {
				console.error(`${colors.red}Erreur random-team : ${e.message}${colors.reset}`);
			}
		}
	});

// 17. team-builder command
program
	.command("team-builder <action> [args...]")
	.description("Gère et génère des compositions d'équipes (actions: list, show <id>, delete <id>, save <name> <encoded-team>, generate)")
	.option("-j, --json", "Format de sortie en JSON brute")
	.option("-f, --formation <formation>", "Spécifie la formation pour l'action 'generate' (ex: diamond442)")
	.action(async (action: string, args: string[], options: { json?: boolean; formation?: string }) => {
		suppressLogs(!!options.json);
		try {
			const dbUrl = process.env.DATABASE_URL;
			if (!dbUrl) {
				throw new Error("DATABASE_URL non définie dans l'environnement");
			}
			const pg = require("pg");
			const client = new pg.Client({ connectionString: dbUrl });
			
			const svc = await createInagleService();
			const characters = svc.characters.baseCharacters();
			
			// Simple coordinate database for synergy distance check
			const FORMATION_POSITIONS: Record<string, Array<{ index: number; top: number; left: number; role: string }>> = {
				diamond442: [
					{ index: 0, top: 1, left: 15, role: "FW" }, { index: 1, top: 1, left: 65, role: "FW" },
					{ index: 2, top: 9, left: 40, role: "MF" }, { index: 3, top: 17, left: 10, role: "MF" },
					{ index: 4, top: 17, left: 70, role: "MF" }, { index: 5, top: 22, left: 40, role: "MF" },
					{ index: 6, top: 31, left: 2, role: "DF" }, { index: 7, top: 35, left: 22, role: "DF" },
					{ index: 8, top: 35, left: 58, role: "DF" }, { index: 9, top: 31, left: 78, role: "DF" },
					{ index: 10, top: 43, left: 40, role: "GK" }
				],
				box442: [
					{ index: 0, top: 1, left: 22, role: "FW" }, { index: 1, top: 1, left: 58, role: "FW" },
					{ index: 2, top: 10, left: 2, role: "MF" }, { index: 3, top: 21, left: 22, role: "MF" },
					{ index: 4, top: 21, left: 58, role: "MF" }, { index: 5, top: 10, left: 78, role: "MF" },
					{ index: 6, top: 28, left: 2, role: "DF" }, { index: 7, top: 35, left: 22, role: "DF" },
					{ index: 8, top: 35, left: 58, role: "DF" }, { index: 9, top: 28, left: 78, role: "DF" },
					{ index: 10, top: 43, left: 40, role: "GK" }
				],
				freedom352: [
					{ index: 0, top: 1, left: 22, role: "FW" }, { index: 1, top: 1, left: 58, role: "FW" },
					{ index: 2, top: 6, left: 2, role: "MF" }, { index: 3, top: 17, left: 22, role: "MF" },
					{ index: 4, top: 10, left: 40, role: "MF" }, { index: 5, top: 17, left: 58, role: "MF" },
					{ index: 6, top: 6, left: 78, role: "MF" }, { index: 7, top: 33, left: 12, role: "DF" },
					{ index: 8, top: 29, left: 40, role: "DF" }, { index: 9, top: 33, left: 68, role: "DF" },
					{ index: 10, top: 43, left: 40, role: "GK" }
				],
				triangle433: [
					{ index: 0, top: 4, left: 2, role: "FW" }, { index: 1, top: 1, left: 40, role: "FW" },
					{ index: 2, top: 4, left: 78, role: "FW" }, { index: 3, top: 16, left: 40, role: "MF" },
					{ index: 4, top: 24, left: 15, role: "MF" }, { index: 5, top: 24, left: 65, role: "MF" },
					{ index: 6, top: 31, left: 2, role: "DF" }, { index: 7, top: 38, left: 22, role: "DF" },
					{ index: 8, top: 38, left: 58, role: "DF" }, { index: 9, top: 31, left: 78, role: "DF" },
					{ index: 10, top: 43, left: 40, role: "GK" }
				],
				delta433: [
					{ index: 0, top: 4, left: 2, role: "FW" }, { index: 1, top: 1, left: 40, role: "FW" },
					{ index: 2, top: 4, left: 78, role: "FW" }, { index: 3, top: 12, left: 15, role: "MF" },
					{ index: 4, top: 12, left: 65, role: "MF" }, { index: 5, top: 23, left: 40, role: "MF" },
					{ index: 6, top: 22, left: 2, role: "DF" }, { index: 7, top: 32, left: 22, role: "DF" },
					{ index: 8, top: 32, left: 58, role: "DF" }, { index: 9, top: 22, left: 78, role: "DF" },
					{ index: 10, top: 43, left: 40, role: "GK" }
				],
				balance451: [
					{ index: 0, top: 1, left: 40, role: "FW" }, { index: 1, top: 10, left: 2, role: "MF" },
					{ index: 2, top: 15, left: 40, role: "MF" }, { index: 3, top: 10, left: 78, role: "MF" },
					{ index: 4, top: 25, left: 22, role: "MF" }, { index: 5, top: 25, left: 58, role: "MF" },
					{ index: 6, top: 29, left: 2, role: "DF" }, { index: 7, top: 38, left: 22, py: 0, left: 22, role: "DF" },
					{ index: 8, top: 38, left: 58, role: "DF" }, { index: 9, top: 29, left: 78, role: "DF" },
					{ index: 10, top: 43, left: 40, role: "GK" }
				],
				hexa361: [
					{ index: 0, top: 1, left: 40, role: "FW" }, { index: 1, top: 7, left: 2, role: "MF" },
					{ index: 2, top: 11, left: 22, role: "MF" }, { index: 3, top: 11, left: 58, role: "MF" },
					{ index: 4, top: 7, left: 78, role: "MF" }, { index: 5, top: 25, left: 22, role: "MF" },
					{ index: 6, top: 25, left: 58, role: "MF" }, { index: 7, top: 39, left: 10, role: "DF" },
					{ index: 8, top: 29, left: 40, role: "DF" }, { index: 9, top: 39, left: 70, role: "DF" },
					{ index: 10, top: 43, left: 40, role: "GK" }
				],
				double541: [
					{ index: 0, top: 1, left: 40, role: "FW" }, { index: 1, top: 7, left: 2, role: "MF" },
					{ index: 2, top: 11, left: 22, role: "MF" }, { index: 3, top: 11, left: 58, role: "MF" },
					{ index: 4, top: 7, left: 78, role: "MF" }, { index: 5, top: 23, left: 2, role: "DF" },
					{ index: 6, top: 27, left: 22, role: "DF" }, { index: 7, top: 29, left: 40, role: "DF" },
					{ index: 8, top: 27, left: 58, role: "DF" }, { index: 9, top: 23, left: 78, role: "DF" },
					{ index: 10, top: 43, left: 40, role: "GK" }
				]
			};
			
			if (action === "list") {
				await client.connect();
				const res = await client.query("SELECT id, name, formation_id, updated_at FROM user_teams ORDER BY updated_at DESC");
				await client.end();
				
				restoreLogs(!!options.json);
				if (options.json) {
					console.log(JSON.stringify(res.rows, null, 2));
				} else {
					console.log(`\n${colors.bold}${colors.green}=== Compositions d'Équipes Sauvegardées ===${colors.reset}`);
					if (res.rows.length === 0) {
						console.log("Aucune équipe enregistrée.");
					} else {
						console.log(renderAsciiTable(res.rows));
					}
				}
			} else if (action === "show") {
				const teamId = args[0];
				if (!teamId) {
					throw new Error("ID de l'équipe manquant. Usage: azalee team-builder show <id>");
				}
				await client.connect();
				const res = await client.query("SELECT * FROM user_teams WHERE id = $1", [teamId]);
				await client.end();
				
				if (res.rows.length === 0) {
					throw new Error(`Aucune équipe trouvée avec l'ID: ${teamId}`);
				}
				const team = res.rows[0];
				const formationData = typeof team.formation_data === "string" ? JSON.parse(team.formation_data) : team.formation_data;
				
				// Resolve details of members
				const resolvedMembers = (formationData.members || []).map((m: any) => {
					const char = characters.find((c: any) => c.charaId === m.charaId);
					return {
						slot: m.slot,
						charaId: m.charaId,
						name: char ? (char.names?.fr || char.names?.en || m.name) : m.name,
						position: char ? (char.variants?.[0]?.position || m.position) : m.position,
						element: char ? (char.variants?.[0]?.element || m.element) : m.element,
						rarity: char ? (char.bestRarity || m.rarity) : m.rarity,
						stats: char?.variants?.[0]?.stats?.lv99 || m.stats
					};
				});
				
				// Calculate synergies
				const fieldMembers = resolvedMembers.filter((m: any) => m.slot.startsWith("field-"));
				const elements: Record<string, number> = { Fire: 0, Forest: 0, Mountain: 0, Wind: 0 };
				for (const m of fieldMembers) {
					if (elements[m.element] !== undefined) elements[m.element]++;
				}
				
				// Dominance & Harmony
				const dominance = Object.entries(elements)
					.filter(([_, count]) => count >= 4)
					.map(([el]) => el);
				const harmony = Object.values(elements).every(c => c > 0);
				
				// Links
				const links: Array<[string, string]> = [];
				const positions = FORMATION_POSITIONS[team.formation_id] || [];
				for (let i = 0; i < fieldMembers.length; i++) {
					const m1 = fieldMembers[i];
					const slotIdx1 = parseInt(m1.slot.replace("field-", ""), 10);
					const pos1 = positions.find((p: any) => p.index === slotIdx1);
					if (!pos1 || pos1.role === "GK") continue;
					
					for (let j = i + 1; j < fieldMembers.length; j++) {
						const m2 = fieldMembers[j];
						if (m1.element !== m2.element) continue;
						
						const slotIdx2 = parseInt(m2.slot.replace("field-", ""), 10);
						const pos2 = positions.find((p: any) => p.index === slotIdx2);
						if (!pos2 || pos2.role === "GK") continue;
						
						const dist = Math.sqrt(Math.pow(pos1.top - pos2.top, 2) + Math.pow(pos1.left - pos2.left, 2));
						if (dist < 25) {
							links.push([m1.name, m2.name]);
						}
					}
				}
				
				restoreLogs(!!options.json);
				if (options.json) {
					console.log(JSON.stringify({
						id: team.id,
						name: team.name,
						formation_id: team.formation_id,
						updated_at: team.updated_at,
						members: resolvedMembers,
						synergy: {
							elements,
							dominance,
							harmony,
							links: links.map(([n1, n2]) => `${n1} <-> ${n2}`)
						}
					}, null, 2));
				} else {
					console.log(`\n${colors.bold}${colors.green}=== Fiche d'Équipe : ${team.name} ===${colors.reset}`);
					console.log(`ID : ${colors.cyan}${team.id}${colors.reset}`);
					console.log(`Formation : ${colors.yellow}${team.formation_id}${colors.reset}`);
					console.log(`Mise à jour : ${team.updated_at}`);
					console.log(`\n${colors.bold}${colors.blue}Membres de l'équipe :${colors.reset}`);
					const tableRows = resolvedMembers.map((m: any) => ({
						Emplacement: m.slot,
						Joueur: m.name,
						Poste: m.position,
						Élément: m.element,
						Rareté: m.rarity
					}));
					console.log(renderAsciiTable(tableRows));
					
					console.log(`\n${colors.bold}${colors.cyan}Synergies Élémentaires :${colors.reset}`);
					for (const [el, count] of Object.entries(elements)) {
						console.log(`  - ${el} : ${count} joueur(s)`);
					}
					if (dominance.length > 0) {
						console.log(`  - ${colors.green}Dominance détectée${colors.reset} : ${dominance.join(", ")} (+5% puissance des techniques associés)`);
					}
					if (harmony) {
						console.log(`  - ${colors.green}Harmonie élémentaire active${colors.reset} (+3% stats globales)`);
					}
					if (links.length > 0) {
						console.log(`  - ${colors.green}Liens de proximité élémentaires (${links.length}) :${colors.reset}`);
						for (const [n1, n2] of links) {
							console.log(`    * ${n1} <-> ${n2}`);
						}
					}
				}
			} else if (action === "delete") {
				const teamId = args[0];
				if (!teamId) {
					throw new Error("ID de l'équipe manquant. Usage: azalee team-builder delete <id>");
				}
				await client.connect();
				const res = await client.query("DELETE FROM user_teams WHERE id = $1", [teamId]);
				await client.end();
				
				restoreLogs(!!options.json);
				if (options.json) {
					console.log(JSON.stringify({ success: true, deletedId: teamId }));
				} else {
					console.log(`\n${colors.green}Équipe ${teamId} supprimée avec succès.${colors.reset}`);
				}
			} else if (action === "save") {
				const name = args[0];
				const encodedTeam = args[1];
				if (!name || !encodedTeam) {
					throw new Error("Usage: azalee team-builder save <name> <encoded-team>");
				}
				
				// Decode team
				const decoded = Buffer.from(encodedTeam, "base64").toString("utf-8");
				const parts = decoded.split("|");
				const formationId = parts[0];
				
				const members: any[] = [];
				for (let i = 1; i < parts.length; i++) {
					const [slot, charaId] = parts[i].split(":");
					const char = characters.find((c: any) => c.charaId === charaId);
					if (char && slot) {
						const variant = char.variants?.[0];
						members.push({
							slot,
							charaId: char.charaId,
							name: char.names?.fr || char.names?.en || char.names?.ja,
							position: variant?.position || "MF",
							element: variant?.element || "Void",
							rarity: char.bestRarity || variant?.rarity || "Normal",
							imageUrl: `https://dxi4wb638ujep.cloudfront.net/1/${char.zukanHash || variant?.zukanHash}.png`,
							slug: char.slug || charaId,
							stats: variant?.stats?.lv99
						});
					}
				}
				
				const teamData = {
					formationId,
					members
				};
				
				const id = require("crypto").randomUUID();
				const userId = "00000000-0000-0000-0000-000000000000"; // default CLI user
				
				await client.connect();
				await client.query(
					`INSERT INTO user_teams(id, user_id, name, formation_id, formation_data, is_public, created_at, updated_at)
					 VALUES ($1, $2, $3, $4, $5, TRUE, NOW(), NOW())`,
					[id, userId, name, formationId, JSON.stringify(teamData)]
				);
				await client.end();
				
				restoreLogs(!!options.json);
				if (options.json) {
					console.log(JSON.stringify({ success: true, id, name }));
				} else {
					console.log(`\n${colors.green}Équipe "${name}" sauvegardée avec succès sous l'ID: ${id}.${colors.reset}`);
				}
			} else if (action === "generate") {
				// Coherent and elements-synergized team generator
				const formations = ["diamond442", "box442", "freedom352", "triangle433", "delta433", "balance451", "hexa361", "double541"];
				const chosenFormationId = options.formation || formations[Math.floor(Math.random() * formations.length)];
				
				// Elements
				const elementsList = ["Fire", "Forest", "Mountain", "Wind"];
				const chosenElement = elementsList[Math.floor(Math.random() * elementsList.length)];
				
				// Group characters by position
				const charsByPosition: Record<string, any[]> = { FW: [], MF: [], DF: [], GK: [] };
				for (const char of characters) {
					const variant = char.variants?.[0];
					if (variant && variant.position && charsByPosition[variant.position]) {
						charsByPosition[variant.position].push({
							charaId: char.charaId,
							name: char.names?.fr || char.names?.en,
							position: variant.position,
							element: variant.element,
							rarity: char.bestRarity || variant.rarity,
							slug: char.slug,
							zukanHash: char.zukanHash || variant.zukanHash,
							stats: variant.stats?.lv99
						});
					}
				}
				
				const positions = FORMATION_POSITIONS[chosenFormationId] || FORMATION_POSITIONS.diamond442;
				const selectedCharaIds = new Set<string>();
				const members: any[] = [];
				
				// Helper to select character of preferred element and role
				const selectChara = (role: string) => {
					const candidates = charsByPosition[role] || [];
					// prioritize chosenElement
					const elementCandidates = candidates.filter(c => c.element === chosenElement && !selectedCharaIds.has(c.charaId));
					const fallbackCandidates = candidates.filter(c => !selectedCharaIds.has(c.charaId));
					
					const pool = elementCandidates.length > 0 ? elementCandidates : fallbackCandidates;
					if (pool.length === 0) return null;
					const picked = pool[Math.floor(Math.random() * pool.length)];
					selectedCharaIds.add(picked.charaId);
					return picked;
				};
				
				// Generate field
				for (const pos of positions) {
					const picked = selectChara(pos.role);
					if (picked) {
						members.push({
							slot: `field-${pos.index}`,
							charaId: picked.charaId,
							name: picked.name,
							position: picked.position,
							element: picked.element,
							rarity: picked.rarity,
							imageUrl: `https://dxi4wb638ujep.cloudfront.net/1/${picked.zukanHash}.png`,
							slug: picked.slug,
							stats: picked.stats
						});
					}
				}
				
				// Generate 5 reserves
				for (let i = 0; i < 5; i++) {
					const allPos = ["FW", "MF", "DF", "GK"];
					const randomRole = allPos[Math.floor(Math.random() * allPos.length)];
					const picked = selectChara(randomRole);
					if (picked) {
						members.push({
							slot: `reserve-${i}`,
							charaId: picked.charaId,
							name: picked.name,
							position: picked.position,
							element: picked.element,
							rarity: picked.rarity,
							imageUrl: `https://dxi4wb638ujep.cloudfront.net/1/${picked.zukanHash}.png`,
							slug: picked.slug,
							stats: picked.stats
						});
					}
				}
				
				// Resolve staff
				await client.connect();
				const resCoordinators = await client.query("SELECT * FROM inagle_coordinators");
				await client.end();
				
				const coaches = resCoordinators.rows.filter((r: any) => r.role === "Manager" || r.role === "Coach");
				const managers = resCoordinators.rows.filter((r: any) => r.role === "Coordinator");

				const matchedCoach = coaches[Math.floor(Math.random() * coaches.length)];
				if (matchedCoach) {
					members.push({
						slot: "manager-0",
						charaId: `coord_${matchedCoach.id}`,
						name: matchedCoach.name_localised,
						position: "COACH",
						element: "Void",
						rarity: "Coach",
						imageUrl: `https://dxi4wb638ujep.cloudfront.net/1/k/c/b/cb88nfolkwe.png`,
						slug: `coord-${matchedCoach.id}`,
					});
				}
				
				const shuffledManagers = managers.sort(() => 0.5 - Math.random());
				for (let i = 0; i < Math.min(3, shuffledManagers.length); i++) {
					const m = shuffledManagers[i];
					members.push({
						slot: `support-${i}`,
						charaId: `coord_${m.id}`,
						name: m.name_localised,
						position: "COORD",
						element: "Void",
						rarity: "Coordinator",
						imageUrl: `https://dxi4wb638ujep.cloudfront.net/1/k/z/p/zpndk6oxjls.png`,
						slug: `coord-${m.id}`,
					});
				}
				
				// Encode
				const parts = [chosenFormationId];
				for (const m of members) {
					if (!m.slot.startsWith("manager-") && !m.slot.startsWith("support-")) {
						parts.push(`${m.slot}:${m.charaId}`);
					}
				}
				const encodedTeam = Buffer.from(parts.join("|")).toString("base64");
				
				restoreLogs(!!options.json);
				if (options.json) {
					console.log(JSON.stringify({
						formationId: chosenFormationId,
						elementTheme: chosenElement,
						encodedTeam,
						members
					}, null, 2));
				} else {
					console.log(`\n${colors.bold}${colors.green}=== Compo Générée (Thème : ${chosenElement}) ===${colors.reset}`);
					console.log(`Formation : ${chosenFormationId}`);
					console.log(`Chaîne d'encodage : ${colors.yellow}${encodedTeam}${colors.reset}`);
					console.log(`\n${colors.bold}${colors.blue}Joueurs terrain et remplaçants :${colors.reset}`);
					const tableRows = members.map((m: any) => ({
						Emplacement: m.slot,
						Joueur: m.name,
						Poste: m.position,
						Élément: m.element,
						Rareté: m.rarity
					}));
					console.log(renderAsciiTable(tableRows));
				}
			} else {
				throw new Error(`Action inconnue: ${action}. Utilisez list, show, delete, save ou generate.`);
			}
		} catch (e: any) {
			restoreLogs(!!options.json);
			if (options.json) {
				console.log(JSON.stringify({ error: e.message }));
			} else {
				console.error(`${colors.red}Erreur team-builder : ${e.message}${colors.reset}`);
			}
		} finally {
			if (!isReplMode) process.exit(0);
		}
	});

// 18. shell command
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

		const commands = ['help', 'chara', 'compare', 'search', 'translate', 'dialogue', 'skill', 'item', 'team', 'random-team', 'team-builder', 'db', 'status', 'audit', 'wave', 'sync', 'repair', 'redis', 'glossary-rebuild', 'exit', 'quit'];
		
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
  ${colors.bold}compare${colors.reset} <c1> <c2>  Compare deux personnages (stats, techniques, moveset)
  ${colors.bold}search${colors.reset} <query>    Recherche globale d'entités (joueurs, items, techniques)
  ${colors.bold}translate${colors.reset} <text>   Traduit du texte via glossaire consolidé
  ${colors.bold}dialogue${colors.reset} <query>   Recherche dans les répliques et dialogues narratifs
  ${colors.bold}skill${colors.reset} <query>      Détails d'une technique / compétence / passive
  ${colors.bold}item${colors.reset} <query>       Détails d'un objet (consommable, équipement, etc.)
  ${colors.bold}team${colors.reset} <query>       Détails d'une équipe (kits, saisons, etc.)
  ${colors.bold}random-team${colors.reset}       Génère une équipe aléatoire (options dispo)
  ${colors.bold}team-builder${colors.reset}      Gère et génère des équipes tactiques (options dispo)
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

