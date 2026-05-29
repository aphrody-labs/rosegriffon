/**
 * @file generate-media-entries.ts
 * @description Genere media_assets.json depuis asset-cross-reference.json.
 * Enrichit chaque asset brut avec son contexte metier (categorie, sources, templates).
 *
 * Run: bun src/scripts/generate-media-entries.ts
 */

import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DATA_ROOT } from "@rosegriffon/inagle/core/paths.ts";

const CROSS_REF_PATH = resolve(DATA_ROOT, "asset-cross-reference.json");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AssetSource {
  entryFile: string;
  entryId?: string;
  field: string;
  value: string;
}

interface CrossRefAsset {
  assetPath: string;
  bucket: "200_icon" | "220_img" | "other";
  folder: string;
  subfolder: string | null;
  isTemplate: boolean;
  sources: AssetSource[];
}

interface CrossRefData {
  generatedAt: string;
  totalAssets: number;
  totalSources: number;
  bucketSummary: {
    "200_icon": number;
    "220_img": number;
    other: number;
  };
  folderSummary: Record<string, number>;
  assets: CrossRefAsset[];
}

interface MediaAssetEntry {
  id: string;
  folder: string;
  category: string;
  path: string;
  bucket: "200_icon" | "220_img" | "other";
  isTemplate: boolean;
  sources: AssetSource[];
  context: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Chemins
// ---------------------------------------------------------------------------

const __dirname = import.meta.dir;
const ENTRIES_DIR = join(__dirname, "../entries");
const OUT_PATH = join(ENTRIES_DIR, "media_assets.json");

// ---------------------------------------------------------------------------
// Classification metier
// ---------------------------------------------------------------------------

/** Mappe un dossier 200_icon/220_img vers une categorie metier lisible. */
function classifyCategory(bucket: string, folder: string): string {
  // 200_icon categories
  const ICON_CATEGORIES: Record<string, string> = {
    "10_icon_chr": "character_icon",
    "11_icon_chr_team": "character_team_icon",
    "15_icon_chr_element": "element_icon",
    "16_icon_minichr": "mini_character",
    "20_icon_skill": "skill_icon",
    "21_icon_skill_element": "skill_element_icon",
    "25_icon_nameplate": "nameplate",
    "25_icon_win06_chr": "win_icon",
    "30_icon_item": "item_icon",
    "35_icon_field": "field_icon",
    "40_icon_costume": "costume_icon",
    "45_icon_avatar": "avatar_icon",
    "50_icon_quest": "quest_icon",
    "55_icon_trophy": "trophy_icon",
    "60_icon_gacha": "gacha_icon",
    "65_icon_capsule": "capsule_icon",
    "70_icon_stamp": "stamp_icon",
    "75_icon_frame": "frame_icon",
    "80_icon_background": "background_icon",
    "85_icon_formation": "formation_icon",
    "90_icon_misc": "misc_icon",
    "95_icon_ui": "ui_icon",
  };

  // 220_img categories
  const IMG_CATEGORIES: Record<string, string> = {
    theater_img: "theater_scene",
    stadium: "stadium_image",
    stamp_img: "chat_emote",
    activity_photo: "activity_photo",
    performance_img: "performance_image",
    chapter_title: "chapter_title",
    soul_effect: "soul_effect",
    gallery_img: "gallery_image",
    event_img: "event_image",
    capsule_img: "capsule_image",
    gacha_img: "gacha_image",
    item_img: "item_image",
    skill_img: "skill_image",
    tutorial_img: "tutorial_image",
    loading_img: "loading_image",
    background_img: "background_image",
    ui_img: "ui_image",
  };

  if (bucket === "200_icon") {
    return ICON_CATEGORIES[folder] ?? "icon";
  }
  if (bucket === "220_img") {
    return IMG_CATEGORIES[folder] ?? "image";
  }
  return "asset";
}

/** Genere un contexte humain depuis les sources. */
function buildContext(asset: CrossRefAsset): string {
  if (asset.sources.length === 0) {
    if (asset.isTemplate) return "template_path";
    return "unreferenced";
  }

  const files = [...new Set(asset.sources.map((s) => s.entryFile))];
  if (files.length === 1) {
    return files[0].replace(/^(entries|all-gamedata)\//, "").replace(/\.json$/, "");
  }
  if (files.length <= 3) {
    return files
      .map((f) => f.replace(/^(entries|all-gamedata)\//, "").replace(/\.json$/, ""))
      .join(", ");
  }
  return `${files.length} sources`;
}

/** Derive un id stable depuis le chemin (wyhash). */
function pathToId(path: string): string {
  const h = Bun.hash(path);
  return `0x${h.toString(16).toUpperCase().padStart(16, "0")}`;
}

// ---------------------------------------------------------------------------
// Transformations specifiques par categorie
// ---------------------------------------------------------------------------

/** Enrichissements supplementaires selon le type d'asset. */
function enrichAsset(entry: MediaAssetEntry, raw: CrossRefAsset): MediaAssetEntry {
  // Marquer les chemins avec placeholders comme templates
  if (raw.isTemplate) {
    entry.isTemplate = true;
  }

  // Detecter les variantes localisees (sous-dossier "fr", "en", etc.)
  const localeSuffixes = ["/fr/", "/en/", "/ja/", "/fr", "/en", "/ja"];
  if (localeSuffixes.some((s) => entry.path.includes(s))) {
    entry.context = `${entry.context} (localised)`;
  }

  return entry;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== generate-media-entries.ts ===");
  console.time("total");

  // Verifier que le cross-reference existe
  const crossRefExists = await Bun.file(CROSS_REF_PATH).exists();
  if (!crossRefExists) {
    console.error(
      `[ERREUR] asset-cross-reference.json introuvable: ${CROSS_REF_PATH}\n` +
        "  Executer d'abord: bun src/scripts/build-asset-cross-reference.ts",
    );
    process.exit(1);
  }

  console.log(`Lecture de: ${CROSS_REF_PATH}`);
  const crossRef = (await Bun.file(CROSS_REF_PATH).json()) as CrossRefData;

  console.log(`Assets charges: ${crossRef.totalAssets}`);
  console.log(`Sources totales: ${crossRef.totalSources}`);

  const now = new Date().toISOString();
  const mediaEntries: MediaAssetEntry[] = [];

  for (const raw of crossRef.assets) {
    // Ignorer les paths vides ou invalides
    if (!raw.assetPath || raw.assetPath.trim() === "") continue;

    const category = classifyCategory(raw.bucket, raw.folder);
    const context = buildContext(raw);

    const entry: MediaAssetEntry = {
      id: pathToId(raw.assetPath),
      folder: raw.folder,
      category,
      path: raw.assetPath,
      bucket: raw.bucket,
      isTemplate: raw.isTemplate,
      sources: raw.sources,
      context,
      updated_at: now,
    };

    mediaEntries.push(enrichAsset(entry, raw));
  }

  // Trier : templates en dernier, puis par categorie, puis par path
  mediaEntries.sort((a, b) => {
    if (a.isTemplate !== b.isTemplate) return a.isTemplate ? 1 : -1;
    const catCmp = a.category.localeCompare(b.category);
    if (catCmp !== 0) return catCmp;
    return a.path.localeCompare(b.path);
  });

  // Statistiques
  const byCategory: Record<string, number> = {};
  const byBucket: Record<string, number> = {};
  let templateCount = 0;

  for (const entry of mediaEntries) {
    byCategory[entry.category] = (byCategory[entry.category] ?? 0) + 1;
    byBucket[entry.bucket] = (byBucket[entry.bucket] ?? 0) + 1;
    if (entry.isTemplate) templateCount++;
  }

  // Ecrire le fichier de sortie (ligne ~423 de la logique principale)
  const bytes = await Bun.write(OUT_PATH, JSON.stringify(mediaEntries, null, 2));

  console.timeEnd("total");
  console.log(`\nFichier ecrit: ${OUT_PATH} (${(bytes / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`Total entrees   : ${mediaEntries.length}`);
  console.log(`  dont templates: ${templateCount}`);
  console.log(`\nPar bucket:`);
  for (const [bucket, count] of Object.entries(byBucket).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${bucket.padEnd(12)} ${count}`);
  }
  console.log(`\nPar categorie (top 15):`);
  const topCategories = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 15);
  for (const [cat, count] of topCategories) {
    console.log(`  ${cat.padEnd(25)} ${count}`);
  }
  if (Object.keys(byCategory).length > 15) {
    console.log(`  ... et ${Object.keys(byCategory).length - 15} autres categories`);
  }
}

main().catch((e) => {
  console.error("[FATAL]", e);
  process.exit(1);
});
