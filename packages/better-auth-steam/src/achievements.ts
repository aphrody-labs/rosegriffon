/**
 * Manifeste des succès IEVR — pont entre les noms d'API Steam (`ACHIEVEMENT_NNNN`)
 * et des libellés lisibles (fr/en/ja).
 *
 * Données ancrées sur le réel :
 * - Noms d'API : reconstruits depuis `TROPHY_INFO_N.int[1]` (champ `num`) du
 *   trophy_config_0.00.00.00.cfg.bin via le format `ACHIEVEMENT_%04u` (extrait de nie.exe).
 * - Libellés fr/en/ja : croisés avec `inagle_trophies` (miroir Supabase) par `trophyId`
 *   (= identifiant texte du trophée, ex. `activity_story_miniquest_001`).
 *
 * Couverture (générée) : 230 trophées internes, 228 avec libellé fr/en, 230 avec ja.
 * Les 2 sans fr/en (`activity_whole_achieve_089/090`) gardent leur ja du trophy_config.
 *
 * NB : Steam n'expose publiquement qu'un sous-ensemble *visible* (~52 succès) ; les 230
 * internes couvrent aussi des compteurs/jalons non publiés. `GetPlayerAchievements` ne
 * renverra que les `apiName` réellement déclarés au schéma de l'app — on mappe tels quels.
 */

import manifest from "./data/ievr-achievements.json" with { type: "json" };
import { achievementNumFromApiName } from "./constants";

/** Entrée du manifeste de succès (libellés lisibles d'un succès IEVR). */
export interface IevrAchievementInfo {
	/** Numéro interne (`TROPHY_INFO_N.int[1]`), sert à dériver l'apiName via `ACHIEVEMENT_%04u`. */
	num: number;
	/** Identifiant texte du trophée (clé de jointure avec inagle_trophies). */
	trophyId: string;
	/** Nom français (null si non localisé en base). */
	nameFr: string | null;
	/** Nom anglais (null si non localisé en base). */
	nameEn: string | null;
	/** Nom japonais (toujours présent : fallback sur le trophy_config). */
	nameJa: string | null;
	/** Description française (optionnelle). */
	descFr?: string;
	/** Description anglaise (optionnelle). */
	descEn?: string;
}

/**
 * Manifeste complet : `{ "ACHIEVEMENT_0001": { num, trophyId, nameFr, nameEn, nameJa, … } }`.
 * Clé = nom d'API Steam (`ACHIEVEMENT_%04u`).
 */
export const IEVR_ACHIEVEMENTS: Readonly<Record<string, IevrAchievementInfo>> = manifest as Record<
	string,
	IevrAchievementInfo
>;

/** Nombre d'entrées dans le manifeste (trophées internes connus). */
export const IEVR_ACHIEVEMENTS_COUNT = Object.keys(IEVR_ACHIEVEMENTS).length;

/** Langues de libellé supportées par le manifeste. */
export type AchievementLanguage = "fr" | "en" | "ja";

/** Récupère l'entrée de manifeste pour un nom d'API Steam (`ACHIEVEMENT_NNNN`). */
export function lookupAchievement(apiName: string | null | undefined): IevrAchievementInfo | null {
	if (!apiName) {
		return null;
	}
	const direct = IEVR_ACHIEVEMENTS[apiName];
	if (direct) {
		return direct;
	}
	// Tolérance au padding : Steam peut renvoyer un apiName dérivable du même num.
	const num = achievementNumFromApiName(apiName);
	if (num === null) {
		return null;
	}
	for (const info of Object.values(IEVR_ACHIEVEMENTS)) {
		if (info.num === num) {
			return info;
		}
	}
	return null;
}

/**
 * Résout le meilleur libellé disponible pour un succès dans la langue demandée,
 * avec repli ordonné (langue demandée → en → ja → fr → apiName brut).
 */
export function achievementDisplayName(
	info: IevrAchievementInfo | null,
	language: AchievementLanguage = "fr",
	fallback?: string,
): string | undefined {
	if (!info) {
		return fallback;
	}
	const byLang: Record<AchievementLanguage, string | null> = {
		fr: info.nameFr,
		en: info.nameEn,
		ja: info.nameJa,
	};
	return (
		byLang[language] ??
		info.nameEn ??
		info.nameJa ??
		info.nameFr ??
		fallback ??
		undefined
	);
}

/** Description lisible (fr/en) d'un succès, repli ordonné, ou `undefined`. */
export function achievementDisplayDescription(
	info: IevrAchievementInfo | null,
	language: AchievementLanguage = "fr",
): string | undefined {
	if (!info) {
		return undefined;
	}
	if (language === "fr") {
		return info.descFr ?? info.descEn;
	}
	return info.descEn ?? info.descFr;
}
