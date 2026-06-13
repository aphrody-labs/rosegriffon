/**
 * Assets de cut-in des hissatsu, générés par niers (`export_skills` → `data/skills-cutin.json`).
 *
 * Source : `nie-data/src/skill.rs::SkillInfo::cutin_assets()` — chemins VFS dérivés de
 * `event_id_name` + `skill_id_str`, vérifiés byte-exact sur whs00340. Permet à la page skill
 * d'afficher le modèle 3D du cut-in, le telop (nom rendu) par langue, et les assets son/effets,
 * tous déjà servis live par `nie-model-serve` (`/raw`, `/tex`, `/model-*`).
 */
import skillsCutinData from "@/data/skills-cutin.json";

/** Chemins VFS des assets de cut-in d'un hissatsu. */
export interface SkillCutin {
	event_id_name: string;
	model_g4mg: string;
	model_g4md: string;
	texture_g4tx: string;
	sound_cfg: string;
	effects_dir: string;
	/** `[langue, chemin .g4tx du telop]`. */
	telop_by_lang: [string, string][];
}

/** Une entrée skill enrichie (identité + cut-in). */
export interface SkillCutinEntry {
	skill_id_str: string;
	skill_id: string;
	event_id_name: string;
	element: number;
	element_name: { fr: string; en: string; ja: string };
	category: number;
	category_name: { fr: string; en: string; ja: string };
	power_min: number;
	power_max: number;
	consume_tp: number;
	foul_rate: number;
	growth_type: number;
	recast_time: number;
	partner_type: number;
	cutin: SkillCutin | null;
}

interface SkillsCutinFile {
	meta: { skill_count: number; cutin_count: number };
	skills: SkillCutinEntry[];
}

const byCode = new Map<string, SkillCutinEntry>(
	(skillsCutinData as SkillsCutinFile).skills.map((s) => [s.skill_id_str, s])
);

/** Renvoie l'entrée cut-in d'un skill par son code interne (`skill_id_str`, ex. `whs00340`). */
export function getSkillCutin(codeOrId: string): SkillCutinEntry | null {
	return byCode.get(codeOrId) ?? null;
}
