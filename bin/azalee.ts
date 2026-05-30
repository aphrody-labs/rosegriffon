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
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

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
			const from = isJa ? "ja" : "en";
			if (!options.json) {
				console.log(
					`${colors.cyan}Langue source détectée : ${isJa ? "Japonais" : "Anglais"}${colors.reset}`
				);
			}

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
					if (!options.json) {
						console.error("Glossary parse error:", e);
					}
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

			const { createInagleService } = require("../packages/inagle/src/service.ts");
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
			const { cache } = require("../packages/db/src/redis.ts");

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
			process.exit(0);
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
			const { createInagleService } = require("../packages/inagle/src/service.ts");
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
			const { queryRag } = require("../packages/cron/src/tasks/ie-crawl/rag.ts");
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
			process.exit(0);
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
				const { getRedisClient } = require("../packages/db/src/redis.ts");
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
			process.exit(0);
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
			process.exit(code);
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
			process.exit(code);
		} else if (options.json) {
			console.log(`${colors.cyan}Synchronisation de la base locale vers le fichier characters.json...${colors.reset}`);
			const proc = spawn(["bun", "scripts/inagle/pipeline/sync-db-to-json.ts"], {
				stdout: "inherit",
				stderr: "inherit",
			});
			const code = await proc.exited;
			process.exit(code);
		} else {
			console.log(`${colors.yellow}Veuillez spécifier une option: --push ou --json.${colors.reset}`);
		}
	});

program.parse();
