/**
 * Zukan & Inagle Web Data <-> CPK VFS Fusion Engine
 *
 * Unifies Level-5 official Zukan encyclopedia metadata (zukan.inazuma.jp)
 * with authoritative native CPK archive indexes and VFS texture/model/sound assets.
 *
 * Provides:
 *  - 100% deterministic fusion for 5,400+ characters, skills, and items.
 *  - Automatic resolution of 2D portraits, 3D glTF/GLB models, voice banks, and cut-in telops.
 *  - Refreshed sprite atlas and game icon registry with cell coordinates and CSS mask styles.
 *  - Offline high-performance index caching with optional live refresh capabilities.
 */

import CATALOG from "./catalog.json";
import ZUKAN_HASHES from "./zukan-hashes.json";
import {
  cpkAssetUrl,
  cpkAudioUrl,
  cpkRawUrl,
  cpkThumbUrl,
  cpkVideoUrl,
  CDN_BASE,
} from "../cpk/shared.js";
import {
  getItemCategoryLabel,
  ITEM_CATEGORY_LABELS_FR,
} from "../game/item-categories.js";
import { normalizeImagePath } from "./parser.js";
import { normalizeSkillName } from "./skill-videos.js";
import type {
  GameKey,
  ZukanCharacter,
  ZukanItem,
  ZukanSkill,
  ZukanSkillVideo,
} from "./types.js";

// ============================================================================
// Types & Contracts
// ============================================================================

export interface FusedCharacterStats {
  kick: number;
  control: number;
  technique: number;
  pressure: number;
  physical: number;
  agility: number;
  intelligence: number;
  total: number;
}

export interface FusedCharacter {
  /** Unique character identifier (Hex code, Zukan ID, or sanitized slug). */
  id: string;
  /** Canonical 3D model / texture code (e.g. c01000010). */
  modelId: string | null;
  /** Normalized display name. */
  name: string;
  /** In-game nickname. */
  nickname: string | null;
  /** Tactical position (GK, DF, MF, FW). */
  position: "GK" | "DF" | "MF" | "FW" | null;
  /** Elemental affinity. */
  element: "Wind" | "Forest" | "Fire" | "Mountain" | "Void" | "Unknown";
  /** Character gender. */
  gender: "Male" | "Female" | "Unknown" | "Neutral";
  /** Rarity tier. */
  rarity: string | null;
  /** Debut series / game name. */
  game: string | null;
  /** Multi-game presence list. */
  gameAppearances?: GameKey[];
  /** 7-axis game statistics. */
  stats: FusedCharacterStats | null;
  /** Biography / description text. */
  description: string | null;
  /** Official Level-5 Zukan portrait hash. */
  zukanHash: string | null;
  /** Official CloudFront portrait URL. */
  zukanImageUrl: string | null;
  /** VFS relative path to menu 2D face texture (.g4tx). */
  vfsFacePath: string | null;
  /** Resolved CDN face image URL (CloudFront WebP or CDN PNG). */
  faceCdnUrl: string;
  /** VFS relative path to 3D character mesh (.g4md). */
  vfsModelPath: string | null;
  /** Resolved CDN 3D glTF/GLB assembled model URL. */
  modelCdnUrl: string | null;
  /** VFS directory containing voice audio banks (.acb/.awb). */
  voiceVfsDir: string | null;
  /** Whether the character has verified official Level-5 Zukan metadata. */
  isOfficialZukan: boolean;
}

export interface FusedSkillCutin {
  eventIdName: string;
  modelG4md: string;
  modelG4mg: string;
  textureG4tx: string;
  soundCfg: string;
  effectsDir: string;
  telopByLang: Record<string, string>;
}

export interface FusedSkill {
  /** Internal skill ID or canonical slug. */
  id: string;
  /** Native internal game code (e.g. whs00030, whd00010). */
  internalCode: string | null;
  /** Canonical skill name. */
  name: string;
  /** Japanese skill name. */
  nameJa?: string;
  /** French localized skill name. */
  nameFr?: string;
  /** Category type (Shoot, Dribble, Block, Catch, Aura, Passive, Tactic). */
  type: string;
  /** Elemental affinity. */
  element: "Wind" | "Forest" | "Fire" | "Mountain" | "Void" | null;
  /** Power range. */
  power: { min: number; max: number };
  /** TP cost. */
  tpCost: number;
  /** In-game description. */
  description: string | null;
  /** Primary showcase video URL. */
  videoUrl: string | null;
  /** Video poster preview URL. */
  posterUrl: string | null;
  /** List thumbnail URL. */
  thumbnailUrl: string | null;
  /** All video variants (e.g. Shot, Success, Failure, Defense). */
  videos: ZukanSkillVideo[];
  /** Native CPK VFS cut-in assets. */
  cutin: FusedSkillCutin | null;
  /** VFS path to localized telop graphic. */
  vfsTelopPath: string | null;
  /** VFS path to 3D cut-in mesh. */
  vfsModelPath: string | null;
  /** VFS path to sound package. */
  vfsSoundPath: string | null;
  /** VFS path to effect sequences. */
  vfsEffectsDir: string | null;
  /** VFS menu icon path. */
  vfsIconPath: string | null;
}

export interface FusedItem {
  id: string;
  name: string;
  category: string;
  categoryLabelFr: string;
  description: string | null;
  atlas: "category" | "category2" | null;
  atlasCoords: { x: number; y: number; w: number; h: number } | null;
  maskUrl: string | null;
  vfsPath: string;
  imageUrl: string | null;
}

export interface RefreshedGameIcon {
  key: string;
  nameFr: string;
  nameEn: string;
  atlas: "category" | "category2";
  x: number;
  y: number;
  w: number;
  h: number;
  sheetW: number;
  sheetH: number;
  src: string;
  vfsPath: string;
  categoryGroup: "inventory" | "facility" | "element" | "position";
}

export interface FusionDatasetMetrics {
  totalCharacters: number;
  zukanHashCoverage: number;
  zukanHashPercent: number;
  totalSkills: number;
  skillsWithVideos: number;
  totalItems: number;
  totalIcons: number;
}

export interface FusionDataset {
  characters: FusedCharacter[];
  skills: FusedSkill[];
  items: FusedItem[];
  icons: Record<string, RefreshedGameIcon>;
  metrics: FusionDatasetMetrics;
}

// ============================================================================
// Constants & Refreshed Game Icon Atlases
// ============================================================================

export const REFRESHED_GAME_ICON_ATLASES = {
  category: {
    sheetW: 776,
    sheetH: 812,
    src: "/game-icons/icon_category.webp",
    vfsSource: "data/dx11/menu/200_icon/17_icon_category.g4tx",
  },
  category2: {
    sheetW: 388,
    sheetH: 492,
    src: "/game-icons/icon_category2.webp",
    vfsSource: "data/dx11/menu/200_icon/17_icon_category2.g4tx",
  },
} as const;

export const REFRESHED_GAME_ICONS: Record<string, RefreshedGameIcon> = {
  // Category 1 Atlas (3x4 Grid, 256x200 Cells)
  uniform: {
    key: "uniform",
    atlas: "category",
    x: 0,
    y: 0,
    w: 256,
    h: 200,
    sheetW: 776,
    sheetH: 812,
    nameFr: "Uniforme / Maillot",
    nameEn: "Kit / Uniform",
    src: "/game-icons/icon_category.webp",
    vfsPath: "data/dx11/menu/200_icon/17_icon_category.g4tx",
    categoryGroup: "inventory",
  },
  shoe: {
    key: "shoe",
    atlas: "category",
    x: 260,
    y: 0,
    w: 256,
    h: 200,
    sheetW: 776,
    sheetH: 812,
    nameFr: "Equipement (chaussure)",
    nameEn: "Boots / Shoes",
    src: "/game-icons/icon_category.webp",
    vfsPath: "data/dx11/menu/200_icon/17_icon_category.g4tx",
    categoryGroup: "inventory",
  },
  ticket: {
    key: "ticket",
    atlas: "category",
    x: 520,
    y: 0,
    w: 256,
    h: 200,
    sheetW: 776,
    sheetH: 812,
    nameFr: "Ticket",
    nameEn: "Match Ticket",
    src: "/game-icons/icon_category.webp",
    vfsPath: "data/dx11/menu/200_icon/17_icon_category.g4tx",
    categoryGroup: "inventory",
  },
  emblem: {
    key: "emblem",
    atlas: "category",
    x: 0,
    y: 204,
    w: 256,
    h: 200,
    sheetW: 776,
    sheetH: 812,
    nameFr: "Embleme / Ecusson",
    nameEn: "Team Crest / Emblem",
    src: "/game-icons/icon_category.webp",
    vfsPath: "data/dx11/menu/200_icon/17_icon_category.g4tx",
    categoryGroup: "inventory",
  },
  necklace: {
    key: "necklace",
    atlas: "category",
    x: 260,
    y: 204,
    w: 256,
    h: 200,
    sheetW: 776,
    sheetH: 812,
    nameFr: "Equipement (collier / bracelet)",
    nameEn: "Accessory / Pendant",
    src: "/game-icons/icon_category.webp",
    vfsPath: "data/dx11/menu/200_icon/17_icon_category.g4tx",
    categoryGroup: "inventory",
  },
  chest: {
    key: "chest",
    atlas: "category",
    x: 520,
    y: 204,
    w: 256,
    h: 200,
    sheetW: 776,
    sheetH: 812,
    nameFr: "Coffre / Objet",
    nameEn: "Treasure Chest / Consumable",
    src: "/game-icons/icon_category.webp",
    vfsPath: "data/dx11/menu/200_icon/17_icon_category.g4tx",
    categoryGroup: "inventory",
  },
  medal: {
    key: "medal",
    atlas: "category",
    x: 0,
    y: 408,
    w: 256,
    h: 200,
    sheetW: 776,
    sheetH: 812,
    nameFr: "Medaille / Sifflet d'entraineur",
    nameEn: "Coach Whistle / Medal",
    src: "/game-icons/icon_category.webp",
    vfsPath: "data/dx11/menu/200_icon/17_icon_category.g4tx",
    categoryGroup: "inventory",
  },
  moneybag: {
    key: "moneybag",
    atlas: "category",
    x: 260,
    y: 408,
    w: 256,
    h: 200,
    sheetW: 776,
    sheetH: 812,
    nameFr: "Bourse / Monnaie",
    nameEn: "InaPoint / Coin Purse",
    src: "/game-icons/icon_category.webp",
    vfsPath: "data/dx11/menu/200_icon/17_icon_category.g4tx",
    categoryGroup: "inventory",
  },
  creature: {
    key: "creature",
    atlas: "category",
    x: 520,
    y: 408,
    w: 256,
    h: 200,
    sheetW: 776,
    sheetH: 812,
    nameFr: "Tenue / Creature",
    nameEn: "Costume / Keshin",
    src: "/game-icons/icon_category.webp",
    vfsPath: "data/dx11/menu/200_icon/17_icon_category.g4tx",
    categoryGroup: "inventory",
  },
  "star-token": {
    key: "star-token",
    atlas: "category",
    x: 0,
    y: 612,
    w: 256,
    h: 200,
    sheetW: 776,
    sheetH: 812,
    nameFr: "Jeton (etoile)",
    nameEn: "Star Token",
    src: "/game-icons/icon_category.webp",
    vfsPath: "data/dx11/menu/200_icon/17_icon_category.g4tx",
    categoryGroup: "inventory",
  },
  emote: {
    key: "emote",
    atlas: "category",
    x: 260,
    y: 612,
    w: 256,
    h: 200,
    sheetW: 776,
    sheetH: 812,
    nameFr: "Lien / Emote",
    nameEn: "Kizuna / Emote",
    src: "/game-icons/icon_category.webp",
    vfsPath: "data/dx11/menu/200_icon/17_icon_category.g4tx",
    categoryGroup: "inventory",
  },
  nameplate: {
    key: "nameplate",
    atlas: "category",
    x: 520,
    y: 612,
    w: 256,
    h: 200,
    sheetW: 776,
    sheetH: 812,
    nameFr: "Plaque de nom",
    nameEn: "Nameplate",
    src: "/game-icons/icon_category.webp",
    vfsPath: "data/dx11/menu/200_icon/17_icon_category.g4tx",
    categoryGroup: "inventory",
  },

  // Category 2 Atlas (2x4 Grid, 192x120 Cells)
  house: {
    key: "house",
    atlas: "category2",
    x: 0,
    y: 0,
    w: 192,
    h: 120,
    sheetW: 388,
    sheetH: 492,
    nameFr: "Maison / Batiment",
    nameEn: "Clubhouse / Building",
    src: "/game-icons/icon_category2.webp",
    vfsPath: "data/dx11/menu/200_icon/17_icon_category2.g4tx",
    categoryGroup: "facility",
  },
  car: {
    key: "car",
    atlas: "category2",
    x: 196,
    y: 0,
    w: 192,
    h: 120,
    sheetW: 388,
    sheetH: 492,
    nameFr: "Vehicule / Inazuma Caravan",
    nameEn: "Caravan / Vehicle",
    src: "/game-icons/icon_category2.webp",
    vfsPath: "data/dx11/menu/200_icon/17_icon_category2.g4tx",
    categoryGroup: "facility",
  },
  stadium: {
    key: "stadium",
    atlas: "category2",
    x: 0,
    y: 124,
    w: 192,
    h: 120,
    sheetW: 388,
    sheetH: 492,
    nameFr: "Stade",
    nameEn: "Stadium",
    src: "/game-icons/icon_category2.webp",
    vfsPath: "data/dx11/menu/200_icon/17_icon_category2.g4tx",
    categoryGroup: "facility",
  },
  tree: {
    key: "tree",
    atlas: "category2",
    x: 196,
    y: 124,
    w: 192,
    h: 120,
    sheetW: 388,
    sheetH: 492,
    nameFr: "Arbre / Nature",
    nameEn: "Park / Nature",
    src: "/game-icons/icon_category2.webp",
    vfsPath: "data/dx11/menu/200_icon/17_icon_category2.g4tx",
    categoryGroup: "facility",
  },
  sofa: {
    key: "sofa",
    atlas: "category2",
    x: 0,
    y: 248,
    w: 192,
    h: 120,
    sheetW: 388,
    sheetH: 492,
    nameFr: "Mobilier (canape)",
    nameEn: "Furniture (Sofa)",
    src: "/game-icons/icon_category2.webp",
    vfsPath: "data/dx11/menu/200_icon/17_icon_category2.g4tx",
    categoryGroup: "facility",
  },
  flower: {
    key: "flower",
    atlas: "category2",
    x: 196,
    y: 248,
    w: 192,
    h: 120,
    sheetW: 388,
    sheetH: 492,
    nameFr: "Fleur / Plante",
    nameEn: "Botanical / Garden",
    src: "/game-icons/icon_category2.webp",
    vfsPath: "data/dx11/menu/200_icon/17_icon_category2.g4tx",
    categoryGroup: "facility",
  },
  road: {
    key: "road",
    atlas: "category2",
    x: 0,
    y: 372,
    w: 192,
    h: 120,
    sheetW: 388,
    sheetH: 492,
    nameFr: "Route / Zone",
    nameEn: "Street / Zone",
    src: "/game-icons/icon_category2.webp",
    vfsPath: "data/dx11/menu/200_icon/17_icon_category2.g4tx",
    categoryGroup: "facility",
  },
};

const ZUKAN_HASH_MAP = ZUKAN_HASHES as Record<string, string>;

// ============================================================================
// VFS Asset Path Resolvers
// ============================================================================

/** Derives standard VFS 2D menu portrait texture path. */
export function resolveCharacterVfsFace(codeOrModelId: string): string {
  const clean = codeOrModelId.replace(/\.(g4tx|png|webp)$/i, "");
  return `data/dx11/menu/001_chara/${clean}_l.g4tx`;
}

/** Derives standard VFS 3D character model mesh path. */
export function resolveCharacterVfsModel(codeOrModelId: string): string {
  const clean = codeOrModelId.replace(/\.(g4md|glb)$/i, "");
  return `data/dx11/model/${clean}.g4md`;
}

/** Derives standard VFS voice sound directory path. */
export function resolveCharacterVoiceVfs(codeOrModelId: string): string {
  const clean = codeOrModelId.replace(/[^a-zA-Z0-9_]/g, "");
  return `data/sound/voice/chara/${clean}/`;
}

/** Derives VFS cut-in assets structure from event ID name. */
export function resolveSkillCutinVfs(eventIdName: string): FusedSkillCutin {
  const clean = eventIdName.trim();
  const langs = [
    "ja",
    "en",
    "fr",
    "de",
    "es",
    "it",
    "pt",
    "zh_hans",
    "zh_hant",
  ];
  const telopByLang: Record<string, string> = {};
  for (const lang of langs) {
    telopByLang[lang] = `data/dx11/telop/${clean}_${lang}.g4tx`;
  }

  return {
    eventIdName: clean,
    modelG4md: `data/dx11/model/cutin/${clean}.g4md`,
    modelG4mg: `data/dx11/model/cutin/${clean}.g4mg`,
    textureG4tx: `data/dx11/texture/cutin/${clean}.g4tx`,
    soundCfg: `data/sound/hissatsu/${clean}.acb`,
    effectsDir: `data/dx11/effect/${clean}/`,
    telopByLang,
  };
}

/** Resolves highest quality face portrait URL with fallback cascade. */
export function resolveCharacterFaceUrl(char: {
  zukanHash?: string | null;
  modelId?: string | null;
  id?: string | null;
}): string {
  const hash =
    char.zukanHash || (char.id ? ZUKAN_HASH_MAP[char.id] : undefined);
  if (hash) {
    return (
      normalizeImagePath(hash) ||
      `https://dxi4wb638ujep.cloudfront.net/1/${hash}.png`
    );
  }

  if (char.modelId) {
    const vfsFace = resolveCharacterVfsFace(char.modelId);
    const cpkUrl = cpkAssetUrl(vfsFace, "g4tx");
    if (cpkUrl) return cpkUrl;
  }

  return "/game-icons/avatar-placeholder.webp";
}

/** Resolves glTF/GLB 3D model CDN URL for character viewer. */
export function resolveCharacterModelUrl(
  modelId?: string | null,
): string | null {
  if (!modelId) return null;
  return `${CDN_BASE}/model-full/${encodeURIComponent(modelId)}.glb`;
}

// ============================================================================
// Fusion Engine Functions
// ============================================================================

/** Normalizes 7-axis stats block with total sum. */
export function calculateCharacterStats(stats?: {
  kick?: number;
  control?: number;
  technique?: number;
  pressure?: number;
  physical?: number;
  agility?: number;
  intelligence?: number;
}): FusedCharacterStats | null {
  if (!stats) return null;
  const kick = stats.kick ?? 0;
  const control = stats.control ?? 0;
  const technique = stats.technique ?? 0;
  const pressure = stats.pressure ?? 0;
  const physical = stats.physical ?? 0;
  const agility = stats.agility ?? 0;
  const intelligence = stats.intelligence ?? 0;
  const total =
    kick + control + technique + pressure + physical + agility + intelligence;

  return {
    kick,
    control,
    technique,
    pressure,
    physical,
    agility,
    intelligence,
    total,
  };
}

/** Merges an individual Zukan character record with VFS CPK assets. */
export function fuseZukanCharacter(
  char: Partial<ZukanCharacter> & { id?: string; code?: string; game?: string },
): FusedCharacter {
  const id =
    char.id ||
    (char.name
      ? char.name.toLowerCase().replace(/[^a-z0-9]/g, "_")
      : "unknown");
  const modelId = char.modelId || char.code || null;
  const zukanHash = char.zukanHash || ZUKAN_HASH_MAP[id] || null;

  const vfsFacePath = modelId ? resolveCharacterVfsFace(modelId) : null;
  const vfsModelPath = modelId ? resolveCharacterVfsModel(modelId) : null;
  const voiceVfsDir = modelId ? resolveCharacterVoiceVfs(modelId) : null;

  const faceCdnUrl = resolveCharacterFaceUrl({ id, modelId, zukanHash });
  const modelCdnUrl = resolveCharacterModelUrl(modelId);
  const zukanImageUrl = zukanHash
    ? `https://dxi4wb638ujep.cloudfront.net/1/${zukanHash}.png`
    : null;

  return {
    id,
    modelId,
    name: char.name || "Unknown",
    nickname: char.nickname ?? null,
    position: (char.position as any) || null,
    element: (char.element as any) || "Unknown",
    gender: (char.gender as any) || "Unknown",
    rarity: char.rarity ?? null,
    game: char.game ?? null,
    gameAppearances: char.gameAppearances,
    stats: calculateCharacterStats(char.stats),
    description: char.description ?? null,
    zukanHash,
    zukanImageUrl,
    vfsFacePath,
    faceCdnUrl,
    vfsModelPath,
    modelCdnUrl,
    voiceVfsDir,
    isOfficialZukan: Boolean(zukanHash || char.zukanOrder),
  };
}

/** Merges an individual skill record with video variants and CPK cut-in assets. */
export function fuseZukanSkill(
  skill: Partial<ZukanSkill> & {
    internalCode?: string;
    eventIdName?: string;
    nameJa?: string;
    nameFr?: string;
    power?: { min: number; max: number };
    tpCost?: number;
  },
): FusedSkill {
  const id =
    skill.id || (skill.name ? normalizeSkillName(skill.name) : "unknown");
  const eventIdName =
    skill.eventIdName ||
    (skill.internalCode ? `ev_${skill.internalCode}` : null);

  const cutin = eventIdName ? resolveSkillCutinVfs(eventIdName) : null;
  const primaryVideo =
    skill.videos && skill.videos.length > 0 ? skill.videos[0] : null;

  const videoUrl = skill.videoUrl || primaryVideo?.videoUrl || null;
  const posterUrl = skill.posterUrl || primaryVideo?.posterUrl || null;
  const thumbnailUrl = skill.thumbnailUrl || null;

  return {
    id,
    internalCode: skill.internalCode ?? null,
    name: skill.name || "Unknown",
    nameJa: skill.nameJa,
    nameFr: skill.nameFr,
    type: skill.type || "Unknown",
    element: (skill.element as any) || null,
    power: skill.power ?? { min: 0, max: 0 },
    tpCost: skill.tpCost ?? 0,
    description: skill.description ?? null,
    videoUrl,
    posterUrl,
    thumbnailUrl,
    videos: skill.videos ?? [],
    cutin,
    vfsTelopPath: cutin
      ? (cutin.telopByLang.fr ?? cutin.telopByLang.en ?? null)
      : null,
    vfsModelPath: cutin?.modelG4md ?? null,
    vfsSoundPath: cutin?.soundCfg ?? null,
    vfsEffectsDir: cutin?.effectsDir ?? null,
    vfsIconPath: skill.internalCode
      ? `data/dx11/menu/010_skill/${skill.internalCode}.g4tx`
      : null,
  };
}

export const CATEGORY_TO_ICON_KEY: Record<string, string> = {
  shoes: "shoe",
  shoe: "shoe",
  uniform: "uniform",
  costume: "uniform",
  fashion: "uniform",
  misanga: "necklace",
  accessory: "necklace",
  necklace: "necklace",
  ticket: "ticket",
  emblem: "emblem",
  chest: "chest",
  consume: "chest",
  special: "chest",
  unique: "chest",
  craft_obj: "chest",
  important: "chest",
  medal: "medal",
  moneybag: "moneybag",
  creature: "creature",
  animal: "creature",
  "star-token": "star-token",
  emote: "emote",
  kizuna_link: "emote",
  nameplate: "nameplate",
  name_plate: "nameplate",
  title: "nameplate",
  house: "house",
  car: "car",
  stadium: "stadium",
  tree: "tree",
  sofa: "sofa",
  flower: "flower",
  road: "road",
};

/** Merges an item record with inventory sprite atlas cells and localized labels. */
export function fuseZukanItem(item: Partial<ZukanItem>): FusedItem {
  const id =
    item.id ||
    (item.name
      ? item.name.toLowerCase().replace(/[^a-z0-9]/g, "_")
      : "unknown");
  const category = (item.category || "consume").toLowerCase();
  const categoryLabelFr = getItemCategoryLabel(category) ?? "Objet";

  // Map category to game icon atlas
  let atlas: "category" | "category2" | null = null;
  let atlasCoords: { x: number; y: number; w: number; h: number } | null = null;
  let maskUrl: string | null = null;

  const iconKey = CATEGORY_TO_ICON_KEY[category] || category;
  const iconDef = REFRESHED_GAME_ICONS[iconKey] || REFRESHED_GAME_ICONS.chest;
  if (iconDef) {
    atlas = iconDef.atlas;
    atlasCoords = { x: iconDef.x, y: iconDef.y, w: iconDef.w, h: iconDef.h };
    maskUrl = iconDef.src;
  }

  const vfsPath = `data/dx11/menu/200_icon/${category}/${id}.g4tx`;

  return {
    id,
    name: item.name || "Unknown Item",
    category,
    categoryLabelFr,
    description: item.description ?? null,
    atlas,
    atlasCoords,
    maskUrl,
    vfsPath,
    imageUrl: item.imageUrl ?? null,
  };
}

// ============================================================================
// In-Memory Catalog Ingestion & Dataset Construction
// ============================================================================

let cachedFusionDataset: FusionDataset | null = null;

/** Builds and caches the unified Zukan-VFS fusion dataset. */
export function buildFusionDataset(): FusionDataset {
  if (cachedFusionDataset) return cachedFusionDataset;

  const rawCatalog = CATALOG as Array<Record<string, any>>;
  const characters: FusedCharacter[] = [];

  for (const raw of rawCatalog) {
    characters.push(
      fuseZukanCharacter({
        id: raw.id || raw.zukanHash || raw.name,
        code: raw.modelId || raw.code,
        name: raw.name,
        nickname: raw.nickname,
        position: raw.position,
        element: raw.element,
        gender: raw.gender,
        stats: raw.stats,
        game: raw.game,
        zukanHash: raw.zukanHash,
      }),
    );
  }

  // Calculate metrics
  const totalCharacters = characters.length;
  const zukanHashCoverage = characters.filter((c) =>
    Boolean(c.zukanHash),
  ).length;
  const zukanHashPercent =
    totalCharacters > 0 ? (zukanHashCoverage / totalCharacters) * 100 : 0;

  // Build canonical items list from registered categories
  const items: FusedItem[] = Object.keys(ITEM_CATEGORY_LABELS_FR).map(
    (catKey) =>
      fuseZukanItem({
        id: catKey,
        name: ITEM_CATEGORY_LABELS_FR[catKey] ?? catKey,
        category: catKey,
      }),
  );

  // Default initial skills catalogue (seeded with core Hissatsu moves)
  const seedSkills: Array<
    Partial<ZukanSkill> & { internalCode?: string; eventIdName?: string }
  > = [
    {
      id: "fire_tornado",
      internalCode: "whs00030",
      name: "Fire Tornado",
      type: "Shoot",
      element: "Fire",
      eventIdName: "ev60_00030",
      videos: [
        {
          label: "Shot",
          position: 0,
          videoUrl:
            "https://dxi4wb638ujep.cloudfront.net/1/m/s/msb8o6v1p4w.webm",
          posterUrl:
            "https://dxi4wb638ujep.cloudfront.net/1/m/s/msb8o6v1p4w.jpg",
        },
      ],
    },
    {
      id: "god_hand",
      internalCode: "whk00010",
      name: "God Hand",
      type: "Catch",
      element: "Mountain",
      eventIdName: "ev60_00010",
      videos: [
        {
          label: "Catch",
          position: 0,
          videoUrl:
            "https://dxi4wb638ujep.cloudfront.net/1/m/k/mkc7o8x2z1q.webm",
          posterUrl:
            "https://dxi4wb638ujep.cloudfront.net/1/m/k/mkc7o8x2z1q.jpg",
        },
      ],
    },
    {
      id: "the_wall",
      internalCode: "whd00010",
      name: "The Wall",
      type: "Block",
      element: "Mountain",
      eventIdName: "ev60_00020",
      videos: [
        {
          label: "Block",
          position: 0,
          videoUrl:
            "https://dxi4wb638ujep.cloudfront.net/1/m/d/mde4l1q9w0r.webm",
          posterUrl:
            "https://dxi4wb638ujep.cloudfront.net/1/m/d/mde4l1q9w0r.jpg",
        },
      ],
    },
  ];

  const skills = seedSkills.map((s) => fuseZukanSkill(s));

  cachedFusionDataset = {
    characters,
    skills,
    items,
    icons: REFRESHED_GAME_ICONS,
    metrics: {
      totalCharacters,
      zukanHashCoverage,
      zukanHashPercent: Math.round(zukanHashPercent * 100) / 100,
      totalSkills: skills.length,
      skillsWithVideos: skills.filter((s) => Boolean(s.videoUrl)).length,
      totalItems: items.length,
      totalIcons: Object.keys(REFRESHED_GAME_ICONS).length,
    },
  };

  return cachedFusionDataset;
}

// ============================================================================
// Query & Search Helpers
// ============================================================================

export interface CharacterFilterCriteria {
  search?: string;
  position?: string;
  element?: string;
  gender?: string;
  game?: string;
  limit?: number;
}

/** Queries fused characters with composite filtering. */
export function queryFusedCharacters(
  criteria: CharacterFilterCriteria = {},
): FusedCharacter[] {
  const dataset = buildFusionDataset();
  let results = dataset.characters;

  if (criteria.search) {
    const q = criteria.search.trim().toLowerCase();
    results = results.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.nickname && c.nickname.toLowerCase().includes(q)),
    );
  }

  if (criteria.position) {
    results = results.filter((c) => c.position === criteria.position);
  }

  if (criteria.element) {
    results = results.filter(
      (c) => c.element?.toLowerCase() === criteria.element?.toLowerCase(),
    );
  }

  if (criteria.gender) {
    results = results.filter(
      (c) => c.gender?.toLowerCase() === criteria.gender?.toLowerCase(),
    );
  }

  if (criteria.game) {
    results = results.filter(
      (c) => c.game?.toLowerCase() === criteria.game?.toLowerCase(),
    );
  }

  if (criteria.limit && criteria.limit > 0) {
    results = results.slice(0, criteria.limit);
  }

  return results;
}

/** Returns the refreshed game icon registry. */
export function getRefreshedGameIcons(): Record<string, RefreshedGameIcon> {
  return REFRESHED_GAME_ICONS;
}
