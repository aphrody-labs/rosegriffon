/**
 * Valeurs et conversions de `/administration` — module PUR.
 *
 * Aucune base, aucun réseau, aucun `discord.js` : tout ce qui décide (est-ce un
 * rôle valable ? cette date est-elle lisible ? ce bouton m'appartient-il ?) se
 * teste ici, dans `valeurs.test.ts`, plutôt que dans un salon.
 *
 * C'est particulièrement vrai des rôles : la liste écrite en dur dans l'ancien
 * `/rg-user` ne correspondait PAS à la base.
 */

import { ALL_ROLES, type RgRole } from "@rosegriffon/types/roles";

/**
 * Rôles réellement attribuables à un profil.
 *
 * ⚠ `member` n'est PAS dans `ALL_ROLES` de `@rosegriffon/types/roles`, et
 * pourtant 1 839 des 1 850 profils le portent (relevé le 13/8/2026 :
 * `member` 1839, `admin` 7, `superadmin` 2, `user` 1, `moderator` 1). L'ancien
 * `/rg-user list` proposait `user, premium, moderator, staff, admin, banned` :
 * filtrer sur `member` était donc IMPOSSIBLE, et filtrer sur `staff` ou
 * `premium` ne rendait jamais rien. On additionne ici l'union typée et la
 * réalité de la colonne, plutôt que de choisir laquelle mentir.
 */
export const ROLES_ASSIGNABLES: readonly string[] = Object.freeze(
	[...new Set<string>([...ALL_ROLES, "member"])].toSorted((a, b) => a.localeCompare(b, "fr"))
);

/** Vrai si la valeur est un rôle que l'on accepte d'écrire dans `profiles.role`. */
export function estRoleAssignable(valeur: unknown): valeur is RgRole | "member" {
	return typeof valeur === "string" && ROLES_ASSIGNABLES.includes(valeur);
}

/** Les trois états d'un article, tels que la colonne `articles.status` les porte. */
export const STATUTS_ARTICLE = ["published", "draft", "archived"] as const;
export type StatutArticle = (typeof STATUTS_ARTICLE)[number];

export function estStatutArticle(valeur: unknown): valeur is StatutArticle {
	return typeof valeur === "string" && (STATUTS_ARTICLE as readonly string[]).includes(valeur);
}

/**
 * Les dix équipes de `team_members.team_id`, avec leur libellé d'affichage.
 * Repris tel quel de `commands/admin/team.ts` : ce sont les valeurs en base.
 */
export const EQUIPES_RG = [
	{ nom: "Bureau de l'Association", valeur: "bureauteam" },
	{ nom: "Association", valeur: "assoteam" },
	{ nom: "Partenaires & Collaborateurs", valeur: "collabteam" },
	{ nom: "Équipe Achilléa", valeur: "achilleateam" },
	{ nom: "Équipe Azalée", valeur: "azaleeteam" },
	{ nom: "Équipe Lore", valeur: "loreteam" },
	{ nom: "Équipe Dessinateur", valeur: "dessinateurteam" },
	{ nom: "Cellule de Médiation", valeur: "mediationteam" },
	{ nom: "Équipe Production", valeur: "productionteam" },
	{ nom: "Équipe Réseaux", valeur: "socialteam" },
] as const;

/** Les sept jours, index `stream_schedules.day_of_week` (0 = dimanche). */
export const JOURS_SEMAINE = [
	"Dimanche",
	"Lundi",
	"Mardi",
	"Mercredi",
	"Jeudi",
	"Vendredi",
	"Samedi",
] as const;

/**
 * Lit une date saisie à la main.
 *
 * Accepte `2026-05-01`, `2026-05-01 20:00`, `2026-05-01T20:00`,
 * `2026-05-01T20:00:00+02:00`. SANS fuseau explicite, la valeur est lue dans le
 * fuseau du serveur — `Etc/UTC` sur ce VPS, aussi bien pour le processus que
 * pour Postgres (vérifié le 13/8/2026). L'écrire est plus honnête que de
 * laisser croire à une heure de Paris.
 *
 * Retourne `null` plutôt qu'une date fausse : `new Date("n'importe quoi")` rend
 * un `Invalid Date` qui s'insère silencieusement en base sous forme de `null`
 * ou lève très loin de la saisie.
 */
export function analyserDate(saisie: unknown): Date | null {
	if (typeof saisie !== "string") {
		return null;
	}
	const propre = saisie.trim();
	if (propre.length === 0) {
		return null;
	}
	// On n'accepte que les formes ancrées sur une date ISO : `01/05/2026` est
	// ambigu (jour/mois ou mois/jour), et `new Date` le résout différemment
	// selon la locale du moteur.
	const forme = /^(\d{4})-(\d{2})-(\d{2})([T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/.exec(propre);
	if (!forme) {
		return null;
	}
	// Le calendrier se vérifie AVANT `new Date`, arithmétiquement : `new Date`
	// ne rejette pas un jour hors du mois, il le reporte silencieusement
	// (`2026-02-30` devenait le 2 mars, et une correction de saisie passait donc
	// pour une date valable). `Date.UTC(a, mois, 0)` donne le dernier jour du
	// mois précédent, soit le nombre de jours du mois demandé, années
	// bissextiles comprises.
	const annee = Number(forme[1]);
	const mois = Number(forme[2]);
	const jour = Number(forme[3]);
	if (mois < 1 || mois > 12 || jour < 1) {
		return null;
	}
	if (jour > new Date(Date.UTC(annee, mois, 0)).getUTCDate()) {
		return null;
	}
	const instant = new Date(propre.replace(" ", "T"));
	return Number.isNaN(instant.getTime()) ? null : instant;
}

/**
 * Lit une heure `HH:MM` et la rend normalisée sur deux chiffres.
 * `stream_schedules.start_time` est une colonne `time`, pas un texte libre.
 */
export function analyserHeure(saisie: unknown): string | null {
	if (typeof saisie !== "string") {
		return null;
	}
	const trouve = /^(\d{1,2}):(\d{2})$/.exec(saisie.trim());
	if (!trouve) {
		return null;
	}
	const heures = Number(trouve[1]);
	const minutes = Number(trouve[2]);
	if (heures > 23 || minutes > 59) {
		return null;
	}
	return `${String(heures).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** Vrai si la valeur a la forme d'un UUID (les clés primaires du site). */
export function estUuid(valeur: unknown): boolean {
	return (
		typeof valeur === "string" &&
		/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valeur.trim())
	);
}

/** Vrai si la valeur a la forme d'un identifiant Discord (flocon numérique). */
export function estIdentifiantDiscord(valeur: unknown): boolean {
	return typeof valeur === "string" && /^\d{17,20}$/.test(valeur.trim());
}

/** Huit premiers caractères d'un identifiant, pour un accusé de réception lisible. */
export function abregerIdentifiant(valeur: string | null | undefined): string {
	if (!valeur) {
		return "—";
	}
	return valeur.length > 8 ? `${valeur.slice(0, 8)}…` : valeur;
}

// ─── Boutons de confirmation ────────────────────────────────────────────────

/** Préfixe des identifiants de bouton de confirmation. */
export const PREFIXE_CONFIRMATION = "rgconf";

export type ReponseConfirmation = "oui" | "non";

/**
 * Compose l'identifiant d'un bouton de confirmation.
 *
 * Discord plafonne `custom_id` à 100 caractères. La graine est l'identifiant de
 * l'interaction d'origine (un flocon de 19 chiffres) : `rgconf|oui|<19>` tient
 * largement, et reste unique même si deux personnes lancent la même action à la
 * même seconde.
 */
export function construireIdConfirmation(reponse: ReponseConfirmation, graine: string): string {
	return `${PREFIXE_CONFIRMATION}|${reponse}|${graine}`;
}

/** Décompose un identifiant de bouton. Rend `null` sur tout ce qui n'est pas à nous. */
export function analyserIdConfirmation(
	id: unknown
): { reponse: ReponseConfirmation; graine: string } | null {
	if (typeof id !== "string") {
		return null;
	}
	const morceaux = id.split("|");
	if (morceaux.length !== 3 || morceaux[0] !== PREFIXE_CONFIRMATION) {
		return null;
	}
	const [, reponse, graine] = morceaux;
	if ((reponse !== "oui" && reponse !== "non") || !graine || graine.length === 0) {
		return null;
	}
	return { reponse, graine };
}

/**
 * Résume un changement de valeur pour l'accusé de réception ET pour l'audit.
 *
 * Écrit « avant → après » plutôt que le seul « après » : un journal qui ne dit
 * pas d'où l'on vient ne permet pas de revenir en arrière.
 */
export function decrireChangement(avant: unknown, apres: unknown, limite = 120): string {
	return `\`${bornerValeur(avant, limite)}\` → \`${bornerValeur(apres, limite)}\``;
}

/** Rend une valeur quelconque affichable sur une ligne, sans jamais lever. */
export function bornerValeur(valeur: unknown, limite = 120): string {
	if (valeur === null || valeur === undefined) {
		return "aucune";
	}
	let texte: string;
	if (typeof valeur === "string") {
		texte = valeur;
	} else {
		try {
			texte = JSON.stringify(valeur) ?? String(valeur);
		} catch {
			texte = String(valeur);
		}
	}
	texte = texte.replace(/\s+/g, " ").trim();
	if (texte.length === 0) {
		return "vide";
	}
	return texte.length > limite ? `${texte.slice(0, limite - 1)}…` : texte;
}
