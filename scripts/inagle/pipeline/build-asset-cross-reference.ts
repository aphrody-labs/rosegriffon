/**
 * @file build-asset-cross-reference.ts
 * @description Construit une reference croisee complete de tous les assets (200_icon et 220_img)
 * avec leurs sources depuis les entries, configs et scripts Lua.
 *
 * Pour chaque asset reference, produit :
 *   - assetPath  : chemin relatif depuis la racine menu (ex: "200_icon/10_icon_chr/c000001")
 *   - bucket     : "200_icon" ou "220_img"
 *   - folder     : dossier de premier niveau
 *   - sources    : liste des entrees qui referencent cet asset
 *   - isTemplate : true si le chemin contient des placeholders (<charaID>, <skillID>, etc.)
 *
 * Run: bun src/scripts/build-asset-cross-reference.ts
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { DATA_ROOT } from "@rosegriffon/inagle/core/paths.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AssetSource {
	entryFile: string;
	entryId?: string;
	field: string;
	value: string;
}

interface AssetEntry {
	assetPath: string;
	bucket: "200_icon" | "220_img" | "other";
	folder: string;
	subfolder: string | null;
	isTemplate: boolean;
	sources: AssetSource[];
}

interface CrossReferenceOutput {
	generatedAt: string;
	totalAssets: number;
	totalSources: number;
	bucketSummary: {
		"200_icon": number;
		"220_img": number;
		other: number;
	};
	folderSummary: Record<string, number>;
	assets: AssetEntry[];
}

// ---------------------------------------------------------------------------
// Chemins
// ---------------------------------------------------------------------------

const __dirname = import.meta.dir;
const ENTRIES_DIR = join(__dirname, "../../../packages/inagle/src/entries");
const ALL_GAMEDATA_DIR = join(DATA_ROOT, "all-gamedata");
const LUA_STRINGS_FILE = join(DATA_ROOT, "lua_scripts/analysis/all-strings.json");
const OUTPUT_FILE = join(DATA_ROOT, "asset-cross-reference.json");

// Champs susceptibles de contenir des chemins assets
const IMAGE_FIELDS = [
	"image",
	"imagePath",
	"imgPath",
	"thumbPath",
	"thumbnailPath",
	"icon",
	"img",
	"path",
	"texture",
	"basePath",
	"faceSmall",
	"faceLarge",
	"miniChr",
	"winIcon",
	"coachSmall",
	"coachLarge",
	"auraFsSmall",
	"auraFsLarge",
	"auraArmedSmall",
	"auraArmedLarge",
	"auraMixiSmall",
	"auraMixiLarge",
	"auraSoulSmall",
	"auraSoulLarge",
	"soulEffect",
];

// Regex pour detecter les placeholders (chemins templates)
const TEMPLATE_RE = /<[^>]+>|%[sdu]/;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function classifyAsset(path: string): {
	bucket: "200_icon" | "220_img" | "other";
	folder: string;
	subfolder: string | null;
} {
	// Normaliser : retirer prefixes "#/menu/", "menu/", etc.
	const normalized = path
		.replace(/^#\/menu\//, "")
		.replace(/^menu\//, "")
		.replace(/^\/menu\//, "");

	const parts = normalized.split("/");

	if (normalized.startsWith("200_icon/")) {
		return {
			bucket: "200_icon",
			folder: parts[1] ?? "",
			subfolder: parts.length >= 4 ? parts[2] : null,
		};
	}
	if (normalized.startsWith("220_img/")) {
		return {
			bucket: "220_img",
			folder: parts[1] ?? "",
			subfolder: parts.length >= 4 ? parts[2] : null,
		};
	}
	return {
		bucket: "other",
		folder: parts[0] ?? "",
		subfolder: parts.length >= 3 ? parts[1] : null,
	};
}

/** Extrait les chemins assets depuis un objet JSON (recursivement). */
function extractAssetPaths(
	obj: unknown,
	field: string,
	depth = 0
): Array<{ field: string; value: string }> {
	if (depth > 10) return [];
	const results: Array<{ field: string; value: string }> = [];

	if (typeof obj === "string") {
		if (
			obj.includes("200_icon/") ||
			obj.includes("220_img/") ||
			obj.includes("#/menu/") ||
			obj.includes("menu/")
		) {
			results.push({ field, value: obj });
		}
		return results;
	}

	if (Array.isArray(obj)) {
		for (const item of obj) {
			results.push(...extractAssetPaths(item, field, depth + 1));
		}
		return results;
	}

	if (obj && typeof obj === "object") {
		for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
			results.push(...extractAssetPaths(val, key, depth + 1));
		}
	}

	return results;
}

// ---------------------------------------------------------------------------
// Source 1 : Entries JSON (src/entries/ et all-gamedata/)
// ---------------------------------------------------------------------------

async function scanEntries(assetMap: Map<string, AssetEntry>): Promise<void> {
	console.time("  entries");

	// Scanner src/entries/ en priorite
	const entriesSources = [
		{ dir: ENTRIES_DIR, label: "entries" },
		{ dir: ALL_GAMEDATA_DIR, label: "all-gamedata" },
	];

	for (const { dir, label } of entriesSources) {
		const dirExists = existsSync(dir);
		if (!dirExists) {
			console.warn(`  [WARN] ${dir} introuvable, skip`);
			continue;
		}

		const glob = new Bun.Glob("*.json");
		const files: string[] = [];
		for await (const rel of glob.scan({ cwd: dir, followSymlinks: true })) {
			files.push(rel);
		}

		await Promise.all(
			files.map(async (rel) => {
				const fullPath = join(dir, rel);
				try {
					const data = await Bun.file(fullPath).json();

					// Extraire les chemins assets de chaque entree
					const entries = Array.isArray(data) ? data : [data];

					for (const entry of entries) {
						const entryId = entry?.id ?? entry?.charaId ?? entry?.auraId ?? entry?.skillId;
						const paths = extractAssetPaths(entry, "");

						for (const { field, value } of paths) {
							// Normaliser le chemin pour la cle de map
							const normalizedPath = value
								.replace(/^#\/menu\//, "")
								.replace(/^menu\//, "")
								.replace(/^\/menu\//, "");

							if (!assetMap.has(normalizedPath)) {
								const { bucket, folder, subfolder } = classifyAsset(normalizedPath);
								assetMap.set(normalizedPath, {
									assetPath: normalizedPath,
									bucket,
									folder,
									subfolder,
									isTemplate: TEMPLATE_RE.test(normalizedPath),
									sources: [],
								});
							}

							const asset = assetMap.get(normalizedPath)!;
							// Eviter les doublons exact (meme fichier + meme valeur)
							const alreadyExists = asset.sources.some(
								(s) => s.entryFile === rel && s.value === value
							);
							if (!alreadyExists && asset.sources.length < 10) {
								asset.sources.push({
									entryFile: `${label}/${rel}`,
									entryId: entryId ? String(entryId) : undefined,
									field,
									value,
								});
							}
						}
					}
				} catch {
					// JSON invalide ou fichier illisible — ignorer
				}
			})
		);
	}

	console.timeEnd("  entries");
}

// ---------------------------------------------------------------------------
// Source 2 : Lua strings (all-strings.json)
// ---------------------------------------------------------------------------

async function scanLuaStrings(assetMap: Map<string, AssetEntry>): Promise<void> {
	console.time("  lua-strings");

	const exists = await Bun.file(LUA_STRINGS_FILE).exists();
	if (!exists) {
		console.warn("  [WARN] all-strings.json absent, skip");
		console.timeEnd("  lua-strings");
		return;
	}

	const data = (await Bun.file(LUA_STRINGS_FILE).json()) as Record<string, string[]>;

	for (const [scriptName, strings] of Object.entries(data)) {
		for (const str of strings) {
			if (
				!str.includes("200_icon/") &&
				!str.includes("220_img/") &&
				!str.includes("#/menu/") &&
				!str.includes("menu/")
			) {
				continue;
			}

			const normalizedPath = str
				.replace(/^#\/menu\//, "")
				.replace(/^menu\//, "")
				.replace(/^\/menu\//, "");

			if (!assetMap.has(normalizedPath)) {
				const { bucket, folder, subfolder } = classifyAsset(normalizedPath);
				assetMap.set(normalizedPath, {
					assetPath: normalizedPath,
					bucket,
					folder,
					subfolder,
					isTemplate: TEMPLATE_RE.test(normalizedPath),
					sources: [],
				});
			}

			const asset = assetMap.get(normalizedPath)!;
			const alreadyExists = asset.sources.some((s) => s.entryFile === `lua/${scriptName}`);
			if (!alreadyExists && asset.sources.length < 10) {
				asset.sources.push({
					entryFile: `lua/${scriptName}`,
					field: "string",
					value: str,
				});
			}
		}
	}

	console.timeEnd("  lua-strings");
}

// ---------------------------------------------------------------------------
// Source 3 : chara_menu_resource.json (templates)
// ---------------------------------------------------------------------------

async function scanCharaMenuResource(assetMap: Map<string, AssetEntry>): Promise<void> {
	const resourceFile = join(ENTRIES_DIR, "chara_menu_resource.json");
	const exists = await Bun.file(resourceFile).exists();
	if (!exists) return;

	try {
		const data = await Bun.file(resourceFile).json();
		const template = data?.template ?? {};

		for (const [field, value] of Object.entries(template as Record<string, string>)) {
			const normalizedPath = String(value)
				.replace(/^#\/menu\//, "")
				.replace(/^menu\//, "");

			if (!assetMap.has(normalizedPath)) {
				const { bucket, folder, subfolder } = classifyAsset(normalizedPath);
				assetMap.set(normalizedPath, {
					assetPath: normalizedPath,
					bucket,
					folder,
					subfolder,
					isTemplate: TEMPLATE_RE.test(normalizedPath),
					sources: [],
				});
			}

			const asset = assetMap.get(normalizedPath)!;
			asset.isTemplate = true; // Les templates chara_menu_resource sont toujours des templates
			if (!asset.sources.some((s) => s.entryFile === "entries/chara_menu_resource.json")) {
				asset.sources.push({
					entryFile: "entries/chara_menu_resource.json",
					field,
					value: String(value),
				});
			}
		}
	} catch {
		// ignorer
	}
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
	console.log("=== build-asset-cross-reference.ts ===");
	console.time("total");

	const assetMap = new Map<string, AssetEntry>();

	console.log("Scanning sources...");
	await scanEntries(assetMap);
	await scanLuaStrings(assetMap);
	await scanCharaMenuResource(assetMap);

	// Convertir en tableau et trier
	const assets = Array.from(assetMap.values()).sort((a, b) =>
		a.assetPath.localeCompare(b.assetPath)
	);

	// Statistiques
	const bucketSummary = { "200_icon": 0, "220_img": 0, other: 0 };
	const folderSummary: Record<string, number> = {};
	let totalSources = 0;

	for (const asset of assets) {
		bucketSummary[asset.bucket]++;
		const key = `${asset.bucket}/${asset.folder}`;
		folderSummary[key] = (folderSummary[key] ?? 0) + 1;
		totalSources += asset.sources.length;
	}

	const output: CrossReferenceOutput = {
		generatedAt: new Date().toISOString(),
		totalAssets: assets.length,
		totalSources,
		bucketSummary,
		folderSummary,
		assets,
	};

	const bytes = await Bun.write(OUTPUT_FILE, JSON.stringify(output, null, 2));

	console.timeEnd("total");
	console.log(`\nFichier ecrit: ${OUTPUT_FILE} (${(bytes / 1024 / 1024).toFixed(2)} MB)`);
	console.log(`Total assets    : ${assets.length}`);
	console.log(`Total sources   : ${totalSources}`);
	console.log(`  200_icon      : ${bucketSummary["200_icon"]}`);
	console.log(`  220_img       : ${bucketSummary["220_img"]}`);
	console.log(`  other         : ${bucketSummary.other}`);

	// Top 10 dossiers
	const topFolders = Object.entries(folderSummary)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 10);
	console.log("\nTop 10 dossiers:");
	for (const [folder, count] of topFolders) {
		console.log(`  ${folder.padEnd(40)} ${count}`);
	}
}

main().catch((e) => {
	console.error("[FATAL]", e);
	process.exit(1);
});
