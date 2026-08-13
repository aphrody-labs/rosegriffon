/**
 * Catalogue des tâches de `rg-cron.service` et politique d'accès depuis Discord.
 *
 * Module PUR (aucune base, aucun réseau) : la politique se teste seule, et le
 * pont IPC côté cron applique EXACTEMENT la même liste noire — on ne fait jamais
 * confiance au seul appelant, même quand cet appelant est notre propre bot.
 *
 * Les noms sont ceux servis par `GET :3005/tasks` (18 tâches).
 */

/** Les 18 tâches, telles que nommées par le démon. */
export const TACHES_CRON = [
	"db",
	"cdn",
	"crawl",
	"rag",
	"publish",
	"github-publish",
	"patreon",
	"reminders",
	"warm",
	"discord",
	"discord:scan",
	"discord:messages",
	"discord:backfill",
	"discord:polls",
	"x:campagnes",
	"seo:indexnow",
	"seo:llms-txt",
	"stats:achillea",
] as const;

export type TacheCron = (typeof TACHES_CRON)[number];

/**
 * Niveau requis pour déclencher une tâche depuis Discord.
 *
 *  - `interdit`     : refusée quoi qu'il arrive, même à un administrateur.
 *  - `admin-strict` : rôle `admin` uniquement (pas `staff`).
 *  - `admin`        : `admin` ou `staff`.
 */
export type NiveauTache = "interdit" | "admin-strict" | "admin";

/**
 * Jamais déclenchables depuis Discord, quelle que soit la personne.
 *
 *  - `db`               : réécrit les tables `inagle_*` de production ET échange
 *                         le miroir SQLite que sert azalee-web.
 *  - `crawl`            : plusieurs minutes, consomme les quotas X (429 documentés).
 *  - `github-publish`   : publie réellement des paquets.
 *  - `discord:backfill` : réécrit l'historique des messages en masse.
 *
 * Une bévue de frappe dans un salon ne doit pas pouvoir déclencher ça.
 */
export const TACHES_INTERDITES: readonly string[] = [
	"db",
	"crawl",
	"github-publish",
	"discord:backfill",
];

/**
 * Réservées au rôle `admin` : elles écrivent en production, envoient aux
 * patrons, ou consomment un quota externe non renouvelable à la demande.
 */
export const TACHES_ADMIN_STRICT: readonly string[] = [
	"publish",
	"patreon",
	"reminders",
	"cdn",
	"rag",
	"seo:indexnow",
	"x:campagnes",
	// Non classées par la décision d'architecture : elles réécrivent
	// `discord_members` / `discord_channels`, donc niveau le plus strict par
	// défaut. Le doute se tranche toujours du côté du refus.
	"discord",
	"discord:scan",
];

/** Ouvertes au staff : lecture, préchauffage, imports idempotents. */
export const TACHES_ADMIN: readonly string[] = [
	"warm",
	"discord:messages",
	"discord:polls",
	"stats:achillea",
	"seo:llms-txt",
];

/**
 * Normalise un nom de tâche.
 *
 * Le démon accepte les deux écritures (`discord:scan` et `discord-scan` sont
 * mappées sur la même fonction dans `runnerMap`). Sans normalisation, la liste
 * noire serait contournable en écrivant `discord-backfill`.
 */
export function normaliserNomTache(nom: string): string {
	return nom.trim().toLowerCase().replaceAll("-", ":").replace(/^github:/, "github-");
}

/** Nom canonique du catalogue, ou `null` si la tâche n'existe pas. */
export function resoudreTache(nom: string | null | undefined): TacheCron | null {
	if (!nom) {
		return null;
	}
	const cible = normaliserNomTache(nom);
	return TACHES_CRON.find((tache) => normaliserNomTache(tache) === cible) ?? null;
}

/**
 * Niveau d'accès d'une tâche. Une tâche inconnue est traitée comme `interdit` :
 * on ne relaie pas vers le cron un nom qu'on ne sait pas classer.
 */
export function niveauTache(nom: string | null | undefined): NiveauTache {
	const tache = resoudreTache(nom);
	if (!tache) {
		return "interdit";
	}
	const cible = normaliserNomTache(tache);
	if (TACHES_INTERDITES.some((t) => normaliserNomTache(t) === cible)) {
		return "interdit";
	}
	if (TACHES_ADMIN.some((t) => normaliserNomTache(t) === cible)) {
		return "admin";
	}
	// Tout le reste (y compris une tâche ajoutée au cron sans être classée ici)
	// exige le rôle admin : le défaut penche vers la restriction.
	return "admin-strict";
}

/**
 * Propositions d'autocomplétion pour un nom de tâche.
 *
 * `exclureInterdites` retire les 4 tâches jamais déclenchables : ne pas les
 * proposer évite de faire miroiter une action qui sera refusée deux fois.
 */
export function suggererTaches(
	saisie: string | null | undefined,
	options: { exclureInterdites?: boolean } = {}
): string[] {
	const aiguille = normaliserNomTache(saisie ?? "");
	return TACHES_CRON.filter((tache) => {
		if (options.exclureInterdites && niveauTache(tache) === "interdit") {
			return false;
		}
		return aiguille.length === 0 || normaliserNomTache(tache).includes(aiguille);
	}).slice(0, 25);
}

/** Verbes de LECTURE du pont : ouverts au staff, jamais destructeurs. */
export const VERBES_LECTURE = [
	"health",
	"tasks.list",
	"tasks.schedules",
	"metrics",
	"telemetry.discord",
	"task.status",
] as const;

/** Phrase de refus, affichable telle quelle dans Discord. */
export function raisonRefus(nom: string): string {
	const tache = resoudreTache(nom);
	if (!tache) {
		return `Tâche « ${nom} » inconnue. Voir \`/cron taches\`.`;
	}
	return `La tâche « ${tache} » ne peut pas être déclenchée depuis Discord (elle écrit en production ou consomme un quota externe). Elle reste lançable en SSH : \`bun packages/cron/src/index.ts --run ${tache}\`.`;
}
