/**
 * Schémas Valibot des colonnes JSONB `inagle_*` — la VRAIE lacune de typage.
 *
 * Les colonnes scalaires sont déjà typées par les types Supabase générés ; les colonnes `Json`
 * (`data`, `sheet_data`, `skills`…) ne l'étaient PAS. Ces schémas dérivent un type ET un validateur
 * d'une source unique, calés sur la structure RÉELLE de la prod (cf. `fixtures/inagle.sample.json`,
 * validés par `db.test.ts`).
 *
 * Convention : `v.object` valide les clés connues et ignore les extras (tolérant aux ajouts) ;
 * `v.optional` pour les clés absentes sur certaines lignes. `Crc32Hex` brande les hash.
 */

import * as v from "valibot";
import { Crc32Hex } from "./ids.js";

// ── Briques communes ──────────────────────────────────────────────────────────

/** Bloc de 7 stats LEVEL-5. */
export const StatBlock = v.object({
	kick: v.number(),
	agility: v.number(),
	control: v.number(),
	physical: v.number(),
	pressure: v.number(),
	technique: v.number(),
	intelligence: v.number(),
});
export type StatBlock = v.InferOutput<typeof StatBlock>;

/** Stats par palier (lv50/lv99 toujours ; lv1 absent sur ~10 lignes prod, lv30 sur certaines). */
export const StatsByLevel = v.object({
	lv1: v.optional(StatBlock),
	lv30: v.optional(StatBlock),
	lv50: StatBlock,
	lv99: StatBlock,
});
export type StatsByLevel = v.InferOutput<typeof StatsByLevel>;

/**
 * Noms localisés. Toutes les clés optionnelles : sur ~58/6148 lignes prod, `names` est un objet
 * vide (`{}`) — vérifié contre Supabase. Ne PAS les marquer required (sinon `v.parse` throw).
 */
export const LocalizedNames = v.object({
	en: v.optional(v.string()),
	fr: v.optional(v.string()),
	ja: v.optional(v.string()),
	romanized: v.optional(v.object({ lastName: v.string(), firstName: v.string() })),
});
export type LocalizedNames = v.InferOutput<typeof LocalizedNames>;

/** Descriptions localisées (en/fr/ja). */
export const LocalizedText = v.object({ en: v.string(), fr: v.string(), ja: v.string() });
export type LocalizedText = v.InferOutput<typeof LocalizedText>;

/** Référence à une compétence apprise (skills[] / auras[]). */
export const SkillRef = v.object({ skillId: Crc32Hex, learnLevel: v.number() });
export type SkillRef = v.InferOutput<typeof SkillRef>;

/** Référence d'équipe dans `data.teams[]`. */
export const TeamRef = v.object({
	id: Crc32Hex,
	names: v.object({ en: v.string(), fr: v.string(), ja: v.string() }),
	seasons: v.array(v.string()),
});
export type TeamRef = v.InferOutput<typeof TeamRef>;

// ── inagle_characters ─────────────────────────────────────────────────────────

/** Payload `inagle_characters.data` (≈ BaseCharacter, présent sur les 6148 lignes). */
// Optionalité calée 1:1 sur la prod (présence vérifiée sur 6148 lignes) : `required` =
// présent sur TOUTES les lignes ; `v.optional` = absent sur ≥1 ligne (compte entre parenthèses).
export const CharaData = v.object({
	// Toujours présents (6148/6148).
	slug: v.string(),
	base_slug: v.string(),
	charaId: Crc32Hex,
	charaParamId: Crc32Hex,
	index: v.number(),
	names: LocalizedNames,
	stats: StatsByLevel,
	skills: v.array(SkillRef),
	auras: v.array(SkillRef),
	icons: v.object({ face: v.optional(v.string()) }),
	gender: v.number(),
	rarity: v.string(),
	rarityCode: v.number(),
	element: v.string(),
	elementRaw: v.number(),
	position: v.string(),
	positionRaw: v.number(),
	subPosition: v.optional(v.string()),
	growthPattern: v.number(),
	is_primary: v.boolean(),
	// Absents sur certaines lignes → optionnels.
	internalCode: v.optional(v.string()),      // 8 absents
	image: v.optional(v.string()),             // 8
	descriptions: v.optional(LocalizedText),   // 157
	teams: v.optional(v.array(TeamRef)),       // 69
	series: v.optional(v.string()),            // 34
	seriesId: v.optional(Crc32Hex),            // 68
	zukanHash: v.optional(v.string()),         // 200
	zukanOrder: v.optional(v.number()),        // 200
	controlType: v.optional(v.number()),       // présent sur 55 seulement
	isControllable: v.optional(v.boolean()),   // 55
	personalityType: v.optional(v.number()),   // 591
});
export type CharaData = v.InferOutput<typeof CharaData>;

/**
 * Payload curé `inagle_characters.sheet_data` — overlay communautaire, clés VARIABLES
 * (parfois `{heroType}` seul, parfois moveset complet). Toutes optionnelles + tolérant.
 */
export const CharaSheetData = v.object({
	heroType: v.optional(v.string()),
	matchedName: v.optional(v.string()),
	sheetId: v.optional(v.string()),
	playstyle: v.optional(v.string()),
	moveset: v.optional(v.string()),
	altMoveset: v.optional(v.string()),
	firstMoves: v.optional(v.string()),
	paths: v.optional(v.object({ main: v.optional(v.string()), alt: v.optional(v.string()) })),
	stats: v.optional(StatBlock),
});
export type CharaSheetData = v.InferOutput<typeof CharaSheetData>;

/** Colonne scalaire `inagle_characters.skills` (= `data.skills`). */
export const CharaSkillsColumn = v.array(SkillRef);
export type CharaSkillsColumn = v.InferOutput<typeof CharaSkillsColumn>;

// ── inagle_skills ─────────────────────────────────────────────────────────────

/** Payload `inagle_skills.data` (parse brut enrichi d'une compétence). */
export const SkillData = v.object({
	skillID: Crc32Hex,
	skillIDStr: v.string(),
	internalCode: v.string(),
	displayName: v.string(),
	// name_*/desc_* absents sur ~13/1002 lignes prod → optionnels.
	name_EN: v.optional(v.string()),
	name_FR: v.optional(v.string()),
	name_JA: v.optional(v.string()),
	desc_EN: v.optional(v.string()),
	desc_FR: v.optional(v.string()),
	desc_JA: v.optional(v.string()),
	image: v.string(),
	element: v.number(),
	elementName: v.object({ en: v.string(), fr: v.string(), ja: v.string() }),
	category: v.number(),
	categoryName: v.object({ en: v.string(), fr: v.string(), ja: v.string() }),
	power_min: v.number(),
	power_max: v.number(),
	powerRange: v.string(),
	consumeTp: v.number(),
	foulRate: v.number(),
	recastTime: v.number(),
	growthType: v.number(),
	growthSpeed: v.string(),
	skillType: v.string(),
	hasPartner: v.boolean(),
	partnerType: v.number(),
	partnerCount: v.number(),
	tags: v.array(v.string()),
});
export type SkillData = v.InferOutput<typeof SkillData>;
