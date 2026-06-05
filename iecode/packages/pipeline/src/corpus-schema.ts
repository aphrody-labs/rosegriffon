/**
 * Schémas Valibot du **corpus exporté** (`exportCorpus`) — un schéma par domaine inagle
 * (characters/skills/auras/passives/basara/items/teams/series/quests/team-passives…).
 *
 * Source unique de vérité : chaque schéma dérive un type (`v.InferOutput`) ET un validateur du
 * même objet. La conformité « aligné sur la vraie donnée » est prouvée par `corpus-schema.test.ts`
 * qui exporte le corpus RÉEL (`/home/ubuntu/niers/data` via inagle) puis `v.parse` chaque entrée.
 *
 * Conventions (calées 1:1 sur la présence réelle des clés, mesurée sur le corpus exporté 2026-06) :
 *   • `v.looseObject` partout → tolérant aux clés ajoutées par un futur build (ne casse pas).
 *   • `v.optional(...)` = clé absente sur ≥1 ligne réelle (compte indiqué en commentaire).
 *   • clé sans `optional` = présente sur 100 % des lignes du domaine.
 *   • `Crc32Hex` brande les hash `0xXXXXXXXX` (réutilise les ids de `@rose-griffon/iecode-inagle`).
 */

// oxlint-disable-next-line id-length
import * as v from "valibot";
import { Crc32Hex } from "@rose-griffon/iecode-inagle/db/ids.ts";

// ── Briques communes ──────────────────────────────────────────────────────────

/** Bloc de 7 stats LEVEL-5 (ordre/clés identiques au parser inagle). */
const StatBlock = v.looseObject({
	agility: v.number(),
	control: v.number(),
	intelligence: v.number(),
	kick: v.number(),
	physical: v.number(),
	pressure: v.number(),
	technique: v.number(),
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
const SkillRef = v.looseObject({ learnLevel: v.optional(v.number()), skillId: Crc32Hex });

/**
 * Hash hex `0x…` toléré non zero-padded — certains domaines (passives, team-passives) émettent
 * des hash à zéros de tête supprimés (`0x914F51E` = 7 digits). Distinct du `Crc32Hex` (8 digits)
 * exigé sur les colonnes DB.
 */
const HexHash = v.pipe(v.string(), v.regex(/^0x[0-9A-Fa-f]{1,8}$/u, "Hash hex 0x… attendu"));

// ── characters ──────────────────────────────────────────────────────────────
// N=6148. Always: index,charaParamId,charaId,names,position,positionRaw,subPosition,element,
// ElementRaw,rarity,rarityCode,gender,growthPattern,skills,stats,slug,icons.

export const CorpusCharacter = v.looseObject({
	// Partiels (compte réel) :
	charaId: Crc32Hex,
	charaParamId: Crc32Hex,
	controlType: v.optional(v.number()), // 55
	descriptions: v.optional(Localized), // 5991
	element: v.string(),
	elementRaw: v.number(),
	gender: v.number(),
	growthPattern: v.number(),
	icons: v.looseObject({ face: v.optional(v.string()) }),
	image: v.optional(v.string()), // 6140
	index: v.number(),
	internalCode: v.optional(v.string()), // 6140
	isControllable: v.optional(v.boolean()), // 55
	names: Names,
	personalityType: v.optional(v.number()), // 591
	position: v.string(),
	positionRaw: v.number(),
	rarity: v.string(),
	rarityCode: v.number(),
	series: v.optional(v.string()), // 6114
	seriesId: v.optional(Crc32Hex), // 6080
	sheetData: v.optional(v.looseObject({})), // 122
	skills: v.array(SkillRef),
	slug: v.string(),
	stats: StatsByLevel,
	subPosition: v.string(),
	teams: v.optional(v.array(v.unknown())), // 6079
	zukanHash: v.optional(v.string()), // 5948
	zukanOrder: v.optional(v.number()), // 5948
});
export type CorpusCharacter = v.InferOutput<typeof CorpusCharacter>;

// ── skills ──────────────────────────────────────────────────────────────────
// N=2697. Name_*/desc_* partiels (locale/desc absentes sur certaines lignes).

export const CorpusSkill = v.looseObject({
	category: v.number(),
	categoryName: Localized,
	consumeTp: v.number(),
	desc_EN: v.optional(v.string()), // 988
	desc_FR: v.optional(v.string()), // 988
	desc_JA: v.optional(v.string()), // 988
	displayName: v.string(),
	element: v.number(),
	elementName: Localized,
	foulRate: v.number(),
	growthSpeed: v.string(),
	growthType: v.number(),
	hasPartner: v.boolean(),
	image: v.string(),
	internalCode: v.string(),
	name_EN: v.optional(v.string()), // 2662
	name_FR: v.optional(v.string()), // 2662
	name_JA: v.optional(v.string()), // 2662
	partnerCount: v.number(),
	partnerType: v.number(),
	power_max: v.number(),
	power_min: v.number(),
	powerRange: v.string(),
	recastTime: v.number(),
	shops: v.optional(v.unknown()), // 652 — Structure variable (localisée), non figée
	skillID: Crc32Hex,
	skillIDStr: v.string(),
	skillType: v.string(),
	tags: v.array(v.string()),
});
export type CorpusSkill = v.InferOutput<typeof CorpusSkill>;

// ── auras ───────────────────────────────────────────────────────────────────
// N=387.

export const CorpusAura = v.looseObject({
	_file: v.string(),
	_source: v.string(),
	assetCode: v.string(),
	auraId: Crc32Hex,
	auraIdStr: v.string(),
	config: v.looseObject({}),
	desc_FR: v.string(),
	desc_JA: v.optional(v.string()), // 356
	displayName: v.string(),
	element: v.number(),
	elementName: Localized,
	image: v.optional(v.string()), // 308
	name_EN: v.optional(v.string()), // 384
	name_FR: v.string(),
	name_JA: v.optional(v.string()), // 384
	ownerCharaParamId: v.optional(Crc32Hex), // 102
	subType: v.string(),
});
export type CorpusAura = v.InferOutput<typeof CorpusAura>;

// ── passives ────────────────────────────────────────────────────────────────
// N=128.

export const CorpusPassive = v.looseObject({
	_file: v.string(),
	_source: v.string(),
	boostType: v.string(),
	boostTypeName: Localized,
	desc_FR: v.optional(v.string()), // 120
	desc_JA: v.optional(v.string()), // 120
	displayName: v.string(),
	element: v.number(),
	name_FR: v.string(),
	name_JA: v.string(),
	passiveId: HexHash, // Hash hex non zero-padded (15/128 lignes ont 7 digits)
	passiveIdStr: v.string(),
	scope: v.string(),
	scopeName: Localized,
});
export type CorpusPassive = v.InferOutput<typeof CorpusPassive>;

// ── team-passives ─────────────────────────────────────────────────────────────
// N=21.

export const CorpusTeamPassive = v.looseObject({
	effectId: HexHash,
	effectValueMax: v.number(),
	effectValueMin: v.number(),
	id: HexHash,
	// `name` est souvent un objet vide `{}` (libellé non résolu) ou une string.
	name: v.union([v.string(), v.looseObject({})]),
	textId: HexHash,
});
export type CorpusTeamPassive = v.InferOutput<typeof CorpusTeamPassive>;

// ── basara ──────────────────────────────────────────────────────────────────
// N=71 (sous-ensemble BASARA des characters, enrichi builds/heroVariants).

export const CorpusBasara = v.looseObject({
	builds: v.array(v.unknown()),
	charaId: Crc32Hex,
	charaParamId: Crc32Hex,
	displayName: v.string(),
	element: v.string(),
	elementName: Localized,
	elementRaw: v.number(),
	gender: v.number(),
	growthPattern: v.number(),
	heroVariants: v.looseObject({
		hasBlack: v.boolean(),
		hasFire: v.boolean(),
		hasPink: v.boolean(),
	}),
	icons: v.looseObject({ face: v.optional(v.string()) }),
	index: v.number(),
	internalCode: v.string(),
	names: Names,
	position: v.string(),
	positionName: Localized,
	positionRaw: v.number(),
	rarity: v.string(),
	rarityCode: v.number(),
	skills: v.array(SkillRef),
	stats: StatsByLevel,
});
export type CorpusBasara = v.InferOutput<typeof CorpusBasara>;

// ── items ───────────────────────────────────────────────────────────────────
// N=4153.

export const CorpusItem = v.looseObject({
	attributes: v.looseObject({}),
	category: v.string(),
	descriptions: v.looseObject({}),
	id: Crc32Hex,
	imageUrl: v.string(),
	internalCode: v.optional(v.string()), // 3129
	itemId: Crc32Hex,
	name: v.string(),
	names: Names,
	price: v.optional(v.number()), // 3039
	// `shops` = libellés localisés ({ en: string[], fr: string[] }), pas un tableau.
	shops: v.optional(v.looseObject({ en: v.optional(v.array(v.string())), fr: v.optional(v.array(v.string())) })), // 1675
	stats: v.optional(v.looseObject({})), // 1277
	uniformId: v.optional(v.number()), // 350 — Id numérique brut (pas un hash hex)
});
export type CorpusItem = v.InferOutput<typeof CorpusItem>;

// ── teams ───────────────────────────────────────────────────────────────────
// N=208.

export const CorpusTeam = v.looseObject({
	binderTeamOrderType: v.number(),
	displayName: v.string(),
	emblems: v.looseObject({}),
	kits: v.looseObject({}),
	name: v.string(),
	name_EN: v.optional(v.string()), // 151
	name_FR: v.optional(v.string()), // 151
	name_JA: v.optional(v.string()), // 151
	seasons: v.looseObject({}),
	teamId: Crc32Hex,
	teamIdStr: v.string(),
	uniforms: v.array(v.unknown()),
});
export type CorpusTeam = v.InferOutput<typeof CorpusTeam>;

// ── series ──────────────────────────────────────────────────────────────────
// N=9.

export const CorpusSeries = v.looseObject({
	names: Names,
	seriesId: Crc32Hex,
	type: v.number(),
});
export type CorpusSeries = v.InferOutput<typeof CorpusSeries>;

// ── quests ──────────────────────────────────────────────────────────────────
// N=182.

export const CorpusQuest = v.looseObject({
	displayText: v.string(),
	explain_EN: v.string(),
	explain_FR: v.string(),
	explain_JA: v.string(),
	id: Crc32Hex,
	image: v.optional(v.string()), // 169
	phase: v.number(),
	questId: Crc32Hex,
	titleHash: Crc32Hex,
	titles: Localized,
	type: v.number(),
});
export type CorpusQuest = v.InferOutput<typeof CorpusQuest>;

// ── Registre domaine → schéma d'entrée ──────────────────────────────────────
// Permet de valider un fichier `<domaine>.json` du corpus contre le bon schéma.
// Les domaines non listés (drops-*, uniforms, formations, parser-*) restent `v.unknown`
// (structure très hétérogène / Map sérialisée) — à promouvoir au besoin.

export const CORPUS_SCHEMAS = {
	auras: CorpusAura,
	basara: CorpusBasara,
	characters: CorpusCharacter,
	items: CorpusItem,
	passives: CorpusPassive,
	quests: CorpusQuest,
	series: CorpusSeries,
	skills: CorpusSkill,
	"team-passives": CorpusTeamPassive,
	teams: CorpusTeam,
} as const satisfies Record<string, v.GenericSchema>;

/** Nom de domaine couvert par un schéma Valibot. */
export type CorpusDomain = keyof typeof CORPUS_SCHEMAS;

/** Vrai si le domaine a un schéma Valibot dédié. */
export const hasCorpusSchema = (domain: string): domain is CorpusDomain =>
	domain in CORPUS_SCHEMAS;
