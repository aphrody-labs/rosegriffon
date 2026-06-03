/**
 * Schémas Valibot du **corpus exporté** (`exportCorpus`) — un schéma par domaine inagle
 * (characters/skills/auras/passives/basara/items/teams/series/quests/team-passives…).
 *
 * Source unique de vérité : chaque schéma dérive un type (`v.InferOutput`) ET un validateur du
 * même objet. La conformité « aligné sur la vraie donnée » est prouvée par `corpus-schema.test.ts`
 * qui exporte le corpus RÉEL (`/home/ubuntu/data` via inagle) puis `v.parse` chaque entrée.
 *
 * Conventions (calées 1:1 sur la présence réelle des clés, mesurée sur le corpus exporté 2026-06) :
 *   • `v.looseObject` partout → tolérant aux clés ajoutées par un futur build (ne casse pas).
 *   • `v.optional(...)` = clé absente sur ≥1 ligne réelle (compte indiqué en commentaire).
 *   • clé sans `optional` = présente sur 100 % des lignes du domaine.
 *   • `Crc32Hex` brande les hash `0xXXXXXXXX` (réutilise les ids de `@rose-griffon/iecode-inagle`).
 */

import { Crc32Hex } from "@rose-griffon/iecode-inagle/db/ids.ts";
import * as v from "valibot";

// ── Briques communes ──────────────────────────────────────────────────────────

/** Bloc de 7 stats LEVEL-5 (ordre/clés identiques au parser inagle). */
const StatBlock = v.looseObject({
	kick: v.number(),
	control: v.number(),
	technique: v.number(),
	physical: v.number(),
	pressure: v.number(),
	agility: v.number(),
	intelligence: v.number(),
});

/** Stats par palier — lv50/lv99 toujours présents ; lv1/lv30 selon le palier de la carte. */
const StatsByLevel = v.looseObject({
	lv1: v.optional(StatBlock),
	lv30: v.optional(StatBlock),
	lv50: StatBlock,
	lv99: StatBlock,
});

/** Noms localisés (corpus : `romanized` toujours présent côté characters/basara). */
const Names = v.looseObject({
	en: v.optional(v.string()),
	fr: v.optional(v.string()),
	ja: v.optional(v.string()),
	romanized: v.optional(v.looseObject({ firstName: v.string(), lastName: v.string() })),
});

/** Libellé localisé minimal (skill element/category, series…). */
const Localized = v.looseObject({
	en: v.optional(v.string()),
	fr: v.optional(v.string()),
	ja: v.optional(v.string()),
});

/** Référence de compétence apprise (skills[]). */
const SkillRef = v.looseObject({ skillId: Crc32Hex, learnLevel: v.optional(v.number()) });

/**
 * Hash hex `0x…` toléré non zero-padded — certains domaines (passives, team-passives) émettent
 * des hash à zéros de tête supprimés (`0x914F51E` = 7 digits). Distinct du `Crc32Hex` (8 digits)
 * exigé sur les colonnes DB.
 */
const HexHash = v.pipe(v.string(), v.regex(/^0x[0-9A-Fa-f]{1,8}$/u, "hash hex 0x… attendu"));

// ── characters ──────────────────────────────────────────────────────────────
// n=6148. always: index,charaParamId,charaId,names,position,positionRaw,subPosition,element,
// elementRaw,rarity,rarityCode,gender,growthPattern,skills,stats,slug,icons.

export const CorpusCharacter = v.looseObject({
	index: v.number(),
	charaParamId: Crc32Hex,
	charaId: Crc32Hex,
	names: Names,
	position: v.string(),
	positionRaw: v.number(),
	subPosition: v.string(),
	element: v.string(),
	elementRaw: v.number(),
	rarity: v.string(),
	rarityCode: v.number(),
	gender: v.number(),
	growthPattern: v.number(),
	skills: v.array(SkillRef),
	stats: StatsByLevel,
	slug: v.string(),
	icons: v.looseObject({ face: v.optional(v.string()) }),
	// partiels (compte réel) :
	internalCode: v.optional(v.string()), // 6140
	image: v.optional(v.string()), // 6140
	descriptions: v.optional(Localized), // 5991
	zukanHash: v.optional(v.string()), // 5948
	zukanOrder: v.optional(v.number()), // 5948
	seriesId: v.optional(Crc32Hex), // 6080
	series: v.optional(v.string()), // 6114
	teams: v.optional(v.array(v.unknown())), // 6079
	sheetData: v.optional(v.looseObject({})), // 122
	isControllable: v.optional(v.boolean()), // 55
	controlType: v.optional(v.number()), // 55
	personalityType: v.optional(v.number()), // 591
});
export type CorpusCharacter = v.InferOutput<typeof CorpusCharacter>;

// ── skills ──────────────────────────────────────────────────────────────────
// n=2697. name_*/desc_* partiels (locale/desc absentes sur certaines lignes).

export const CorpusSkill = v.looseObject({
	partnerType: v.number(),
	skillID: Crc32Hex,
	skillIDStr: v.string(),
	element: v.number(),
	category: v.number(),
	internalCode: v.string(),
	skillType: v.string(),
	displayName: v.string(),
	elementName: Localized,
	categoryName: Localized,
	powerRange: v.string(),
	hasPartner: v.boolean(),
	partnerCount: v.number(),
	image: v.string(),
	power_min: v.number(),
	power_max: v.number(),
	consumeTp: v.number(),
	recastTime: v.number(),
	foulRate: v.number(),
	growthType: v.number(),
	growthSpeed: v.string(),
	tags: v.array(v.string()),
	name_EN: v.optional(v.string()), // 2662
	name_FR: v.optional(v.string()), // 2662
	name_JA: v.optional(v.string()), // 2662
	desc_EN: v.optional(v.string()), // 988
	desc_FR: v.optional(v.string()), // 988
	desc_JA: v.optional(v.string()), // 988
	shops: v.optional(v.unknown()), // 652 — structure variable (localisée), non figée
});
export type CorpusSkill = v.InferOutput<typeof CorpusSkill>;

// ── auras ───────────────────────────────────────────────────────────────────
// n=387.

export const CorpusAura = v.looseObject({
	auraId: Crc32Hex,
	auraIdStr: v.string(),
	element: v.number(),
	name_FR: v.string(),
	desc_FR: v.string(),
	assetCode: v.string(),
	subType: v.string(),
	config: v.looseObject({}),
	_source: v.string(),
	_file: v.string(),
	displayName: v.string(),
	elementName: Localized,
	name_EN: v.optional(v.string()), // 384
	name_JA: v.optional(v.string()), // 384
	desc_JA: v.optional(v.string()), // 356
	image: v.optional(v.string()), // 308
	ownerCharaParamId: v.optional(Crc32Hex), // 102
});
export type CorpusAura = v.InferOutput<typeof CorpusAura>;

// ── passives ────────────────────────────────────────────────────────────────
// n=128.

export const CorpusPassive = v.looseObject({
	passiveId: HexHash, // hash hex non zero-padded (15/128 lignes ont 7 digits)
	passiveIdStr: v.string(),
	name_FR: v.string(),
	name_JA: v.string(),
	element: v.number(),
	scope: v.string(),
	boostType: v.string(),
	_source: v.string(),
	_file: v.string(),
	displayName: v.string(),
	scopeName: Localized,
	boostTypeName: Localized,
	desc_FR: v.optional(v.string()), // 120
	desc_JA: v.optional(v.string()), // 120
});
export type CorpusPassive = v.InferOutput<typeof CorpusPassive>;

// ── team-passives ─────────────────────────────────────────────────────────────
// n=21.

export const CorpusTeamPassive = v.looseObject({
	id: HexHash,
	effectId: HexHash,
	effectValueMin: v.number(),
	effectValueMax: v.number(),
	textId: HexHash,
	// `name` est souvent un objet vide `{}` (libellé non résolu) ou une string.
	name: v.union([v.string(), v.looseObject({})]),
});
export type CorpusTeamPassive = v.InferOutput<typeof CorpusTeamPassive>;

// ── basara ──────────────────────────────────────────────────────────────────
// n=71 (sous-ensemble BASARA des characters, enrichi builds/heroVariants).

export const CorpusBasara = v.looseObject({
	index: v.number(),
	charaParamId: Crc32Hex,
	charaId: Crc32Hex,
	internalCode: v.string(),
	names: Names,
	icons: v.looseObject({ face: v.optional(v.string()) }),
	position: v.string(),
	positionRaw: v.number(),
	element: v.string(),
	elementRaw: v.number(),
	rarity: v.string(),
	rarityCode: v.number(),
	gender: v.number(),
	growthPattern: v.number(),
	builds: v.array(v.unknown()),
	skills: v.array(SkillRef),
	heroVariants: v.looseObject({
		hasFire: v.boolean(),
		hasBlack: v.boolean(),
		hasPink: v.boolean(),
	}),
	stats: StatsByLevel,
	displayName: v.string(),
	elementName: Localized,
	positionName: Localized,
});
export type CorpusBasara = v.InferOutput<typeof CorpusBasara>;

// ── items ───────────────────────────────────────────────────────────────────
// n=4153.

export const CorpusItem = v.looseObject({
	id: Crc32Hex,
	name: v.string(),
	itemId: Crc32Hex,
	category: v.string(),
	names: Names,
	descriptions: v.looseObject({}),
	attributes: v.looseObject({}),
	imageUrl: v.string(),
	internalCode: v.optional(v.string()), // 3129
	// `shops` = libellés localisés ({ en: string[], fr: string[] }), pas un tableau.
	shops: v.optional(v.looseObject({ en: v.optional(v.array(v.string())), fr: v.optional(v.array(v.string())) })), // 1675
	price: v.optional(v.number()), // 3039
	stats: v.optional(v.looseObject({})), // 1277
	uniformId: v.optional(v.number()), // 350 — id numérique brut (pas un hash hex)
});
export type CorpusItem = v.InferOutput<typeof CorpusItem>;

// ── teams ───────────────────────────────────────────────────────────────────
// n=208.

export const CorpusTeam = v.looseObject({
	teamId: Crc32Hex,
	teamIdStr: v.string(),
	name: v.string(),
	displayName: v.string(),
	binderTeamOrderType: v.number(),
	emblems: v.looseObject({}),
	kits: v.looseObject({}),
	seasons: v.looseObject({}),
	uniforms: v.array(v.unknown()),
	name_FR: v.optional(v.string()), // 151
	name_EN: v.optional(v.string()), // 151
	name_JA: v.optional(v.string()), // 151
});
export type CorpusTeam = v.InferOutput<typeof CorpusTeam>;

// ── series ──────────────────────────────────────────────────────────────────
// n=9.

export const CorpusSeries = v.looseObject({
	seriesId: Crc32Hex,
	type: v.number(),
	names: Names,
});
export type CorpusSeries = v.InferOutput<typeof CorpusSeries>;

// ── quests ──────────────────────────────────────────────────────────────────
// n=182.

export const CorpusQuest = v.looseObject({
	questId: Crc32Hex,
	titleHash: Crc32Hex,
	phase: v.number(),
	type: v.number(),
	titles: Localized,
	id: Crc32Hex,
	displayText: v.string(),
	explain_EN: v.string(),
	explain_FR: v.string(),
	explain_JA: v.string(),
	image: v.optional(v.string()), // 169
});
export type CorpusQuest = v.InferOutput<typeof CorpusQuest>;

// ── Registre domaine → schéma d'entrée ──────────────────────────────────────
// Permet de valider un fichier `<domaine>.json` du corpus contre le bon schéma.
// Les domaines non listés (drops-*, uniforms, formations, parser-*) restent `v.unknown`
// (structure très hétérogène / Map sérialisée) — à promouvoir au besoin.

export const CORPUS_SCHEMAS = {
	characters: CorpusCharacter,
	skills: CorpusSkill,
	auras: CorpusAura,
	passives: CorpusPassive,
	"team-passives": CorpusTeamPassive,
	basara: CorpusBasara,
	items: CorpusItem,
	teams: CorpusTeam,
	series: CorpusSeries,
	quests: CorpusQuest,
} as const satisfies Record<string, v.GenericSchema>;

/** Nom de domaine couvert par un schéma Valibot. */
export type CorpusDomain = keyof typeof CORPUS_SCHEMAS;

/** Vrai si le domaine a un schéma Valibot dédié. */
export function hasCorpusSchema(domain: string): domain is CorpusDomain {
	return domain in CORPUS_SCHEMAS;
}
