/**
 * Vues typées composites des tables `inagle_*` : colonnes scalaires (autorité = types Supabase
 * générés) + colonnes JSONB typées via les schémas Valibot. C'est la forme que l'app consomme :
 * strictement typée de bout en bout, alignée sur la donnée réelle.
 *
 * NB : la `Database` Supabase complète vit dans le prod (`packages/db/src/types.gen.ts`, généré par
 * `supabase gen types`). Ici on ne re-déclare QUE les vues métier qu'iecode/inagle exploitent, pour
 * rester autonome (pas de dépendance au fichier généré prod). Les enums proviennent des valeurs
 * distinctes réelles.
 */

import type {
	CharaElement, CharaPosition, CharaRarityLabel, Gender, HeroType, Series, SkillCategory,
} from "./enums";
import type { CharaData, CharaSheetData, CharaSkillsColumn, SkillData } from "./jsonb";

/** Ligne typée `inagle_characters` (colonnes utiles + JSONB typés). */
export interface InagleCharacter {
	readonly id: string;
	readonly chara_id: string | null;
	readonly internal_code: string | null;
	readonly name_fr: string | null;
	readonly name_en: string | null;
	readonly name_ja: string | null;
	readonly element: CharaElement | null;
	readonly position: CharaPosition | null;
	readonly rarity_label: CharaRarityLabel | null;
	readonly gender: Gender | null;
	readonly hero_type: HeroType | null;
	readonly series: Series | null;
	readonly element_id: number | null;
	readonly position_id: number | null;
	readonly rarity_code: number | null;
	readonly stat_frappe: number | null;
	readonly is_primary: boolean | null;
	/** Colonnes JSONB désormais typées. */
	readonly data: CharaData;
	readonly sheet_data: CharaSheetData | null;
	readonly skills: CharaSkillsColumn | null;
}

/** Ligne typée `inagle_skills`. */
export interface InagleSkill {
	readonly id: string;
	readonly internal_code: string | null;
	readonly name_fr: string | null;
	readonly category: SkillCategory | null;
	readonly element: CharaElement | null;
	readonly power_min: number | null;
	readonly power_max: number | null;
	readonly tp_cost: number | null;
	readonly is_hyper: boolean | null;
	readonly tags: readonly string[] | null;
	readonly data: SkillData;
	readonly sheet_data: Record<string, unknown> | null;
}
