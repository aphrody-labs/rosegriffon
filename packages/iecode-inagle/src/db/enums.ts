/**
 * Enums des colonnes scalaires `inagle_*`, dérivés des VALEURS DISTINCTES RÉELLES de la prod
 * (Supabase `select distinct`, 2026-06-03). Source de vérité = la donnée, pas une supposition.
 *
 * `as const` + `v.picklist` → union littérale stricte ET validateur runtime alignés.
 * Les colonnes scalaires sont en français (locale FR de la prod) ; `data.*` est en anglais/codes
 * (cf. position codes) — d'où des enums distincts.
 */

import * as v from "valibot";

// ── Colonnes scalaires inagle_characters (locale FR) ─────────────────────────

export const CHARA_ELEMENTS = ["Aucun", "Feu", "Forêt", "Montagne", "Néant", "Vent"] as const;
export const CharaElement = v.picklist(CHARA_ELEMENTS);
export type CharaElement = v.InferOutput<typeof CharaElement>;

export const CHARA_POSITIONS = ["Attaquant", "Défenseur", "Entraîneur", "Gardien", "Milieu"] as const;
export const CharaPosition = v.picklist(CHARA_POSITIONS);
export type CharaPosition = v.InferOutput<typeof CharaPosition>;

export const CHARA_RARITY_LABELS = ["BASARA", "Expérimenté", "Héros", "Normal"] as const;
export const CharaRarityLabel = v.picklist(CHARA_RARITY_LABELS);
export type CharaRarityLabel = v.InferOutput<typeof CharaRarityLabel>;

export const GENDERS = ["F", "M"] as const;
export const Gender = v.picklist(GENDERS);
export type Gender = v.InferOutput<typeof Gender>;

export const HERO_TYPES = ["black", "fire", "pink"] as const;
export const HeroType = v.picklist(HERO_TYPES);
export type HeroType = v.InferOutput<typeof HeroType>;

export const SERIES = [
	"Ares", "Chrono Stone", "Galaxy", "Inazuma Eleven", "Inazuma Eleven 2",
	"Inazuma Eleven 3", "Inazuma Eleven GO", "Orion", "Victory Road",
] as const;
export const Series = v.picklist(SERIES);
export type Series = v.InferOutput<typeof Series>;

// ── Colonnes scalaires inagle_skills (locale FR) ─────────────────────────────

export const SKILL_CATEGORIES = ["Arrêt", "Défense", "Dribble", "Tir"] as const;
export const SkillCategory = v.picklist(SKILL_CATEGORIES);
export type SkillCategory = v.InferOutput<typeof SkillCategory>;

export const SKILL_EVOLUTION_TYPES = [
	"G (G2/G3)", "Infinie (N)", "Lente", "Normale (+1/+2)",
	"Type 4", "Type 5", "Type 6", "V (V2/V3)",
] as const;
export const SkillEvolutionType = v.picklist(SKILL_EVOLUTION_TYPES);
export type SkillEvolutionType = v.InferOutput<typeof SkillEvolutionType>;

// ── inagle_items ──────────────────────────────────────────────────────────────

export const ITEM_CATEGORIES = [
	"accessory", "animal", "consume", "costume", "craft_obj", "emblem", "fashion",
	"formation", "important", "kizuna_link", "misanga", "name_plate", "performance",
	"shoes", "special", "special_skill", "special_tactics", "super_tactics", "title",
] as const;
export const ItemCategory = v.picklist(ITEM_CATEGORIES);
export type ItemCategory = v.InferOutput<typeof ItemCategory>;

// ── auras / keshins ───────────────────────────────────────────────────────────

export const AURA_SUB_TYPES = ["Aura"] as const;
export const AuraSubType = v.picklist(AURA_SUB_TYPES);
export type AuraSubType = v.InferOutput<typeof AuraSubType>;

export const KESHIN_TYPES = ["Esprit Guerrier", "Keshin"] as const;
export const KeshinType = v.picklist(KESHIN_TYPES);
export type KeshinType = v.InferOutput<typeof KeshinType>;

// ── data.* (payload JSONB, locale EN / codes) ────────────────────────────────
// Vu dans la donnée : data.element ∈ {"Fire","Wind",…}, data.position ∈ {"FW","DF","GK","MF"}.
// L'ensemble complet EN n'a pas été figé (← seulement échantillonné) : on garde `string` plutôt
// que d'inventer une liste incomplète. À promouvoir en picklist quand le distinct EN sera figé.
export const DATA_POSITION_CODES = ["FW", "MF", "DF", "GK", "Coach"] as const;
export const DataPositionCode = v.picklist(DATA_POSITION_CODES);
export type DataPositionCode = v.InferOutput<typeof DataPositionCode>;
