/**
 * @file map-220-img-sources.ts
 * @description Mappe chaque dossier 220_img du bucket Supabase "menu" vers ses sources de donnees.
 *
 * Sources scannees :
 *   1. gamedata/**\/*.cfg.bin.json  — refs directes dans les configs du jeu
 *   2. all-gamedata/*.json          — entites pre-traitees (skills, gallery, quests...)
 *   3. lua_scripts/analysis/all-strings.json — strings Lua decompilees
 *   4. lua_scripts/analysis/nie-c-summary.json — strings extraites du binaire Ghidra
 *
 * Run: bun src/scripts/map-220-img-sources.ts
 */

import { join, relative } from "node:path";
import { DATA_ROOT } from "@rose-griffon/inagle/core/paths.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BucketFolder {
	files: number;
	size_mb?: number;
	avg_kb?: number;
	folders?: Record<string, BucketFolder>;
}

interface BucketData {
	generated_at: string;
	bucket: string;
	total_files: number;
	total_size_mb: number;
	folders: {
		"220_img": {
			description: string;
			total_files: number;
			total_size_mb: number;
			folders: Record<string, BucketFolder>;
		};
	};
}

interface GamedataMatch {
	file: string;
	field: string;
	value: string;
	count: number;
}

interface AllGamedataMatch {
	file: string;
	field: string;
	sample: string;
}

interface LuaMatch {
	script: string;
	strings: string[];
}

interface NieCMatch {
	pattern: string;
	context: string;
}

interface FolderMatches {
	gamedata: GamedataMatch[];
	allGamedata: AllGamedataMatch[];
	lua: LuaMatch[];
	nieC: NieCMatch[];
}

interface FolderResult {
	folder: string;
	files: number;
	sizeMb: number;
	subfolders: string[];
	matches: FolderMatches;
	coverage: "full" | "partial" | "none" | "dynamic";
	notes: string[];
}

interface DynamicPattern {
	pattern: string;
	source: string;
	context: string;
}

interface OutputJson {
	generatedAt: string;
	totalFolders: number;
	totalFiles: number;
	totalSizeMb: number;
	coverageSummary: {
		full: number;
		partial: number;
		none: number;
		dynamic: number;
	};
	dynamicPatterns: DynamicPattern[];
	folders: FolderResult[];
	unmappedFolders: string[];
}

// ---------------------------------------------------------------------------
// Chemins
// ---------------------------------------------------------------------------

const BUCKET_JSON = join(DATA_ROOT, "../../supabase-storage-buckets.json");
const GAMEDATA_DIR = join(DATA_ROOT, "common/gamedata");
const ALL_GAMEDATA_DIR = join(DATA_ROOT, "all-gamedata");
const LUA_STRINGS_FILE = join(DATA_ROOT, "lua_scripts/analysis/all-strings.json");
const NIE_C_FILE = join(DATA_ROOT, "lua_scripts/analysis/nie-c-summary.json");
const OUTPUT_FILE = join(DATA_ROOT, "220-img-mapping.json");

// Regex pour detecter les patterns dynamiques (%s, %d, <LG>, <PF>)
const DYNAMIC_PATTERN_RE = /%[sdu]|<LG>|<PF>|<skillID>/;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extrait les noms de dossiers 220_img presents dans une chaine. */
function extract220Folders(str: string, knownFolders: Set<string>): string[] {
	const found: string[] = [];
	for (const folder of knownFolders) {
		// Exiger que le nom de dossier apparaisse apres "220_img/" ou dans un contexte de chemin
		if (str.includes(`220_img/${folder}`) || str.includes(`220_img\\${folder}`)) {
			found.push(folder);
		}
	}
	return found;
}

/** Verifie si une string est une ref de chemin vers 220_img (filtre les faux positifs). */
function isPathRef(str: string): boolean {
	return (
		str.includes("220_img/") ||
		str.includes("220_img\\") ||
		str.includes("220_img/<") ||
		str.includes("220_img/%")
	);
}

/** Extrait le contexte (nom du dossier 220_img) d'une string de chemin. */
function extractFolderFromPath(str: string, knownFolders: Set<string>): string[] {
	return extract220Folders(str, knownFolders);
}

// ---------------------------------------------------------------------------
// Source 1 : Gamedata JSON
// ---------------------------------------------------------------------------

interface GamedataIndex {
	// dossier 220_img -> liste de matches
	[folder: string]: GamedataMatch[];
}

async function scanGamedata(knownFolders: Set<string>): Promise<GamedataIndex> {
	console.time("  gamedata");
	const index: GamedataIndex = {};

	const glob = new Bun.Glob("**/*.cfg.bin.json");
	const files: string[] = [];

	for await (const rel of glob.scan({ cwd: GAMEDATA_DIR })) {
		files.push(rel);
	}

	// Traitement en parallele par batch de 20 pour eviter trop de handles ouverts
	const BATCH = 20;
	for (let i = 0; i < files.length; i += BATCH) {
		const batch = files.slice(i, i + BATCH);
		await Promise.all(
			batch.map(async (rel) => {
				const fullPath = join(GAMEDATA_DIR, rel);
				const isHuge = rel.includes("event_bustup_talk_data_config_");

				try {
					// Pour les gros fichiers bustup_talk, utiliser regex sur texte brut
					const text = await Bun.file(fullPath).text();

					// Regex qui capture les valeurs string contenant 220_img
					// Pattern: "fieldName": "valeur_avec_220_img"  ou  valeur isolee avec 220_img
					const matchRe = /"([^"]*220_img[^"]*)"/g;
					let m: RegExpExecArray | null;

					// Accumulation par dossier pour ce fichier
					const fileCountByFolder: Record<string, { count: number; samples: Set<string> }> = {};

					// biome-ignore lint/suspicious/noAssignInExpressions: regex exec loop
					while ((m = matchRe.exec(text)) !== null) {
						const val = m[1];
						if (!isPathRef(val)) continue;

						const folders = extractFolderFromPath(val, knownFolders);
						for (const folder of folders) {
							if (!fileCountByFolder[folder]) {
								fileCountByFolder[folder] = { count: 0, samples: new Set() };
							}
							fileCountByFolder[folder].count++;
							if (fileCountByFolder[folder].samples.size < 3) {
								fileCountByFolder[folder].samples.add(val);
							}
						}
					}

					// Ajouter au index global
					const shortPath = relative(GAMEDATA_DIR, fullPath);
					for (const [folder, data] of Object.entries(fileCountByFolder)) {
						if (!index[folder]) index[folder] = [];
						// Determiner le "champ" en cherchant le contexte JSON autour de la valeur
						// On utilise la premiere sample pour approximer le nom du champ
						const sample = [...data.samples][0] ?? "";
						let field = "value";
						if (isHuge) {
							// Regex leger pour extraire le champ JSON parent
							const ctxRe = /"(\w+)"\s*:\s*"[^"]*220_img[^"]*"/;
							const ctxMatch = ctxRe.exec(text.slice(0, 2000) + text.slice(-500));
							if (ctxMatch) field = ctxMatch[1];
						} else {
							// Parser JSON proprement pour les petits fichiers
							try {
								const json = JSON.parse(text);
								field = findFieldInJson(json, folder) ?? "value";
							} catch {
								// garder "value"
							}
						}

						index[folder].push({
							file: shortPath,
							field,
							value: sample,
							count: data.count,
						});
					}
				} catch (_e) {
					// Fichier illisible ou JSON invalide — ignorer
				}
			})
		);
	}

	console.timeEnd("  gamedata");
	return index;
}

/** Cherche le premier champ JSON dont la valeur contient un dossier 220_img donne. */
function findFieldInJson(obj: unknown, folder: string, depth = 0): string | null {
	if (depth > 8) return null;
	if (typeof obj === "string" && obj.includes(`220_img/${folder}`)) return "_value_";
	if (Array.isArray(obj)) {
		for (const item of obj) {
			const r = findFieldInJson(item, folder, depth + 1);
			if (r) return r;
		}
		return null;
	}
	if (obj && typeof obj === "object") {
		for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
			if (typeof val === "string" && val.includes(`220_img/${folder}`)) return key;
			const r = findFieldInJson(val, folder, depth + 1);
			if (r) return key;
		}
	}
	return null;
}

// ---------------------------------------------------------------------------
// Source 2 : All-gamedata JSON
// ---------------------------------------------------------------------------

interface AllGamedataIndex {
	[folder: string]: AllGamedataMatch[];
}

// Champs connus contenant des refs images
const _IMAGE_FIELDS = ["image", "imgPath", "thumbPath", "icon", "img", "path", "texture"];

async function scanAllGamedata(knownFolders: Set<string>): Promise<AllGamedataIndex> {
	console.time("  all-gamedata");
	const index: AllGamedataIndex = {};

	const glob = new Bun.Glob("*.json");
	const files: string[] = [];
	// followSymlinks requis : les fichiers all-gamedata sont des liens symboliques vers src/entries/
	for await (const rel of glob.scan({ cwd: ALL_GAMEDATA_DIR, followSymlinks: true })) {
		files.push(rel);
	}

	await Promise.all(
		files.map(async (rel) => {
			const fullPath = join(ALL_GAMEDATA_DIR, rel);
			try {
				const text = await Bun.file(fullPath).text();
				const matchRe = /"([^"]*220_img[^"]*)"/g;
				let m: RegExpExecArray | null;

				const byFolder: Record<string, { field: string; samples: string[] }> = {};

				// biome-ignore lint/suspicious/noAssignInExpressions: regex exec loop
				while ((m = matchRe.exec(text)) !== null) {
					const val = m[1];
					if (!isPathRef(val)) continue;

					const folders = extractFolderFromPath(val, knownFolders);

					// Extraire le champ JSON qui precede cette valeur dans le texte
					const before = text.slice(Math.max(0, m.index - 80), m.index);
					const fieldMatch = /"(\w+)"\s*:\s*$/.exec(before.trimEnd());
					const field = fieldMatch ? fieldMatch[1] : "value";

					for (const folder of folders) {
						if (!byFolder[folder]) byFolder[folder] = { field, samples: [] };
						if (byFolder[folder].samples.length < 3) byFolder[folder].samples.push(val);
					}
				}

				for (const [folder, data] of Object.entries(byFolder)) {
					if (!index[folder]) index[folder] = [];
					index[folder].push({
						file: rel,
						field: data.field,
						sample: data.samples[0] ?? "",
					});
				}
			} catch {
				// ignorer
			}
		})
	);

	console.timeEnd("  all-gamedata");
	return index;
}

// ---------------------------------------------------------------------------
// Source 3 : Lua strings (all-strings.json)
// ---------------------------------------------------------------------------

interface LuaIndex {
	[folder: string]: LuaMatch[];
}

async function scanLuaStrings(knownFolders: Set<string>): Promise<LuaIndex> {
	console.time("  lua-strings");
	const index: LuaIndex = {};

	const exists = await Bun.file(LUA_STRINGS_FILE).exists();
	if (!exists) {
		console.warn("  [WARN] all-strings.json absent, skip");
		console.timeEnd("  lua-strings");
		return index;
	}

	const data = (await Bun.file(LUA_STRINGS_FILE).json()) as Record<string, string[]>;

	for (const [scriptName, strings] of Object.entries(data)) {
		const byFolder: Record<string, string[]> = {};

		for (const str of strings) {
			if (!isPathRef(str)) continue;
			const folders = extractFolderFromPath(str, knownFolders);
			for (const folder of folders) {
				if (!byFolder[folder]) byFolder[folder] = [];
				if (byFolder[folder].length < 5) byFolder[folder].push(str);
			}
		}

		for (const [folder, matchedStrings] of Object.entries(byFolder)) {
			if (!index[folder]) index[folder] = [];
			index[folder].push({ script: scriptName, strings: matchedStrings });
		}
	}

	console.timeEnd("  lua-strings");
	return index;
}

// ---------------------------------------------------------------------------
// Source 4 : nie-c-summary.json
// ---------------------------------------------------------------------------

interface NieCIndex {
	[folder: string]: NieCMatch[];
}

interface NieCEntry {
	string: string;
	usedIn?: string[];
}

interface NieCData {
	totalLines?: number;
	totalFunctions?: number;
	totalStrings?: number;
	rttClasses?: string[];
	strings?: NieCEntry[];
	// Format alternatif : tableau direct
	[key: string]: unknown;
}

async function scanNieC(knownFolders: Set<string>): Promise<{
	index: NieCIndex;
	dynamicPatterns: DynamicPattern[];
}> {
	console.time("  nie-c");
	const index: NieCIndex = {};
	const dynamicPatterns: DynamicPattern[] = [];

	const exists = await Bun.file(NIE_C_FILE).exists();
	if (!exists) {
		console.warn("  [WARN] nie-c-summary.json absent, skip");
		console.timeEnd("  nie-c");
		return { index, dynamicPatterns };
	}

	const _data = (await Bun.file(NIE_C_FILE).json()) as NieCData;

	// Les strings peuvent etre dans data.strings ou extraites manuellement via regex
	const text = await Bun.file(NIE_C_FILE).text();
	const matchRe = /"string"\s*:\s*"([^"]*220_img[^"]*)"/g;
	let m: RegExpExecArray | null;

	// biome-ignore lint/suspicious/noAssignInExpressions: regex exec loop
	while ((m = matchRe.exec(text)) !== null) {
		const val = m[1];
		if (!isPathRef(val)) continue;

		// Extraire le contexte (usedIn) depuis le JSON local
		const after = text.slice(m.index, m.index + 300);
		const usedInMatch = /"usedIn"\s*:\s*\[([^\]]*)\]/.exec(after);
		const context = usedInMatch
			? usedInMatch[1].replace(/"/g, "").replace(/\s+/g, " ").trim()
			: "binaire";

		const folders = extractFolderFromPath(val, knownFolders);

		// Detecter les patterns dynamiques
		if (DYNAMIC_PATTERN_RE.test(val)) {
			dynamicPatterns.push({
				pattern: val,
				source: "nie-c-summary.json",
				context,
			});
		}

		for (const folder of folders) {
			if (!index[folder]) index[folder] = [];
			// Eviter les doublons exacts
			if (!index[folder].some((e) => e.pattern === val)) {
				index[folder].push({ pattern: val, context });
			}
		}
	}

	// Egalement detecter les patterns generiques dans all-strings.json
	const luaText = (await Bun.file(LUA_STRINGS_FILE).exists())
		? await Bun.file(LUA_STRINGS_FILE).text()
		: "";

	const luaDynRe = /"(#\/menu\/220_img\/[^"]*(?:%[sdu]|<LG>|<PF>|<skillID>)[^"]*)"/g;
	// biome-ignore lint/suspicious/noAssignInExpressions: regex exec loop
	while ((m = luaDynRe.exec(luaText)) !== null) {
		const val = m[1];
		const folders = extractFolderFromPath(val, knownFolders);
		const context = "lua";

		if (!dynamicPatterns.some((p) => p.pattern === val)) {
			dynamicPatterns.push({ pattern: val, source: "all-strings.json", context });
		}

		for (const folder of folders) {
			if (!index[folder]) index[folder] = [];
			if (!index[folder].some((e) => e.pattern === val)) {
				index[folder].push({ pattern: val, context });
			}
		}
	}

	console.timeEnd("  nie-c");
	return { index, dynamicPatterns };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
	console.log("=== map-220-img-sources.ts ===");
	console.time("total");

	// 1. Charger le bucket JSON
	const bucketExists = await Bun.file(BUCKET_JSON).exists();
	if (!bucketExists) {
		// Essayer le chemin absolu depuis le repo
		const altPath = "/home/ubuntu/rg/supabase-storage-buckets.json";
		const altExists = await Bun.file(altPath).exists();
		if (!altExists) {
			console.error(
				`[ERREUR] supabase-storage-buckets.json introuvable.\n` +
					`  Essaye: ${BUCKET_JSON}\n  Essaye: ${altPath}`
			);
			process.exit(1);
		}
	}

	const bucketPath = bucketExists ? BUCKET_JSON : "/home/ubuntu/rg/supabase-storage-buckets.json";

	const bucket = (await Bun.file(bucketPath).json()) as BucketData;
	const img220 = bucket.folders["220_img"];
	const folderNames = Object.keys(img220.folders);
	const knownFolders = new Set(folderNames);

	console.log(`Dossiers 220_img trouves: ${folderNames.length}`);
	console.log(`Total fichiers: ${img220.total_files} | Taille: ${img220.total_size_mb} MB`);
	console.log("\nScanning sources en parallele...");

	// 2. Scanner toutes les sources en parallele
	const [gamedataIndex, allGamedataIndex, luaIndex, nieCResult] = await Promise.all([
		scanGamedata(knownFolders),
		scanAllGamedata(knownFolders),
		scanLuaStrings(knownFolders),
		scanNieC(knownFolders),
	]);

	const nieCIndex = nieCResult.index;
	const dynamicPatterns = nieCResult.dynamicPatterns;

	// 3. Construire les resultats par dossier
	const folders: FolderResult[] = [];
	const unmappedFolders: string[] = [];
	const coverageSummary = { full: 0, partial: 0, none: 0, dynamic: 0 };

	for (const folderName of folderNames) {
		const meta = img220.folders[folderName];
		const subfolders = meta.folders ? Object.keys(meta.folders) : [];

		const matches: FolderMatches = {
			gamedata: gamedataIndex[folderName] ?? [],
			allGamedata: allGamedataIndex[folderName] ?? [],
			lua: luaIndex[folderName] ?? [],
			nieC: nieCIndex[folderName] ?? [],
		};

		const notes: string[] = [];

		// Determiner la couverture
		const sourceCount =
			(matches.gamedata.length > 0 ? 1 : 0) +
			(matches.allGamedata.length > 0 ? 1 : 0) +
			(matches.lua.length > 0 ? 1 : 0) +
			(matches.nieC.length > 0 ? 1 : 0);

		// Verifier si couvert par patterns dynamiques
		const hasDynamic = dynamicPatterns.some(
			(p) => p.pattern.includes(`220_img/${folderName}`) || p.pattern.includes(`220_img/%s`) // pattern generique total
		);

		// Le pattern "#/menu/220_img/%s" couvre theoriquement tout
		const hasFullDynamic = dynamicPatterns.some(
			(p) => p.pattern === "#/menu/220_img/%s" || p.pattern === "menu/220_img/%s"
		);

		let coverage: "full" | "partial" | "none" | "dynamic";

		if (sourceCount >= 2) {
			coverage = "full";
			coverageSummary.full++;
		} else if (sourceCount === 1) {
			coverage = "partial";
			coverageSummary.partial++;
		} else if (hasDynamic || hasFullDynamic) {
			coverage = "dynamic";
			coverageSummary.dynamic++;
			if (hasFullDynamic) {
				notes.push("Couvert par le pattern generique '#/menu/220_img/%s' (nie.c)");
			}
		} else {
			coverage = "none";
			coverageSummary.none++;
			unmappedFolders.push(folderName);
		}

		// Notes supplementaires
		if (matches.gamedata.some((m) => m.file.includes("event_bustup_talk_data"))) {
			notes.push("Refs dans event_bustup_talk (gros fichiers, regex texte)");
		}
		if (subfolders.some((s) => s === "fr")) {
			notes.push("Contient des variantes localisees (fr/)");
		}
		if (meta.files > 500) {
			notes.push(`Dossier volumineux: ${meta.files} fichiers`);
		}

		folders.push({
			folder: folderName,
			files: meta.files,
			sizeMb: meta.size_mb ?? 0,
			subfolders,
			matches,
			coverage,
			notes,
		});
	}

	// Trier : full > partial > dynamic > none, puis par nombre de fichiers desc
	const COVERAGE_ORDER = { full: 0, partial: 1, dynamic: 2, none: 3 };
	folders.sort((a, b) => {
		const cmpCoverage = COVERAGE_ORDER[a.coverage] - COVERAGE_ORDER[b.coverage];
		if (cmpCoverage !== 0) return cmpCoverage;
		return b.files - a.files;
	});

	// 4. Construire le JSON final
	const output: OutputJson = {
		generatedAt: new Date().toISOString(),
		totalFolders: folderNames.length,
		totalFiles: img220.total_files,
		totalSizeMb: img220.total_size_mb,
		coverageSummary,
		dynamicPatterns,
		folders,
		unmappedFolders,
	};

	// 5. Ecrire le fichier
	const bytes = await Bun.write(OUTPUT_FILE, JSON.stringify(output, null, 2));

	console.timeEnd("total");
	console.log(`\nFichier ecrit: ${OUTPUT_FILE} (${(bytes / 1024).toFixed(1)} KB)`);
	console.log("\nCouverture:");
	console.log(`  full    : ${coverageSummary.full}/${folderNames.length}`);
	console.log(`  partial : ${coverageSummary.partial}/${folderNames.length}`);
	console.log(`  dynamic : ${coverageSummary.dynamic}/${folderNames.length}`);
	console.log(`  none    : ${coverageSummary.none}/${folderNames.length}`);

	if (unmappedFolders.length > 0) {
		console.log(`\nDossiers sans source identifiee (${unmappedFolders.length}):`);
		for (const f of unmappedFolders) console.log(`  - ${f}`);
	}

	if (dynamicPatterns.length > 0) {
		console.log(`\nPatterns dynamiques detectes (${dynamicPatterns.length}):`);
		for (const p of dynamicPatterns.slice(0, 10)) {
			console.log(`  [${p.source}] ${p.pattern}`);
		}
		if (dynamicPatterns.length > 10) {
			console.log(`  ... et ${dynamicPatterns.length - 10} autres`);
		}
	}
}

main().catch((e) => {
	console.error("[FATAL]", e);
	process.exit(1);
});
