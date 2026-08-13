/**
 * Socle PUR des commandes qui exercent les pouvoirs Discord du bot.
 *
 * Le bot porte la permission « Administrateur » sur le serveur Rose Griffon :
 * il peut bannir, expulser, exclure temporairement, créer et distribuer des
 * rôles, ouvrir, verrouiller et purger des salons. C'est un pouvoir réel, et
 * trois choses le rendent dangereux si on l'appelle naïvement :
 *
 *   1. **La hiérarchie prime sur la permission.** Être administrateur ne permet
 *      PAS d'agir sur quelqu'un dont le rôle le plus haut est au-dessus (ou à
 *      égalité) de celui du bot, ni sur le propriétaire du serveur. Discord
 *      répond alors `50013 Missing Permissions` — un message que le membre lit
 *      comme « le bot est cassé » alors que c'est un refus normal.
 *   2. **Les bornes ne sont pas négociables.** Une exclusion dépasse rarement
 *      28 jours par accident : c'est le plafond de l'API. Une suppression de
 *      masse ne touche pas un message de plus de 14 jours. Un mode lent va de 0
 *      à 6 heures. Ces bornes se vérifient AVANT l'appel, pas dans un `catch`.
 *   3. **Une action de modération sans motif est une action sans trace.** Le
 *      journal d'audit Discord accepte 512 caractères ; on y écrit toujours QUI
 *      a demandé l'action depuis Discord, en plus de la trace en base.
 *
 * Tout ce qui DÉCIDE vit donc ici, sans `interaction`, sans base, sans réseau,
 * et se teste dans `discord-admin.test.ts`. Les fichiers de commande n'ont plus
 * qu'à appeler et à mettre en forme.
 */

import { PermissionFlagsBits, type PermissionsBitField } from "discord.js";

// ─── Bornes de l'API Discord ────────────────────────────────────────────────

/** Exclusion temporaire (`timeout`) : 28 jours, plafond dur de l'API. */
export const MAX_EXCLUSION_MS = 28 * 24 * 60 * 60 * 1000;

/** Suppression de masse : Discord refuse tout message de plus de 14 jours. */
export const AGE_MAX_SUPPRESSION_MASSE_MS = 14 * 24 * 60 * 60 * 1000;

/** `bulkDelete` accepte de 2 à 100 messages par appel. */
export const MAX_SUPPRESSION_MASSE = 100;

/** Mode lent d'un salon : de 0 à 6 heures, en secondes. */
export const MAX_LENTEUR_SECONDES = 21_600;

/** Longueur maximale d'un motif de journal d'audit. */
export const LIMITE_MOTIF_AUDIT = 512;

/** Longueur maximale d'un nom de salon ou de rôle. */
export const LIMITE_NOM = 100;

/** Nombre de jours de messages qu'un bannissement peut effacer (0 à 7). */
export const MAX_JOURS_PURGE_BANNISSEMENT = 7;

// ─── Durées ─────────────────────────────────────────────────────────────────

const UNITES_DUREE: Readonly<Record<string, number>> = Object.freeze({
	s: 1000,
	sec: 1000,
	m: 60_000,
	min: 60_000,
	h: 3_600_000,
	j: 86_400_000,
	d: 86_400_000,
});

/**
 * Lit une durée écrite à la main : `10m`, `2h`, `1h30m`, `7j`, `45 min`.
 *
 * Rend `null` sur tout le reste plutôt qu'une valeur par défaut : exclure
 * quelqu'un « 10 minutes » et l'exclure « pour toujours » ne se distinguent que
 * par ce qui a été tapé, et une saisie mal comprise doit être refusée, pas
 * devinée. Rend `null` aussi au-delà de `MAX_EXCLUSION_MS`, que l'API refuse.
 */
export function analyserDuree(saisie: unknown): number | null {
	if (typeof saisie !== "string") {
		return null;
	}
	const propre = saisie.trim().toLowerCase().replaceAll(" ", "");
	if (propre.length === 0) {
		return null;
	}
	// Une saisie doit être ENTIÈREMENT consommée : `10mois` ne doit pas être lu
	// comme « 10 minutes » en ignorant la fin.
	const motif = /(\d+)(sec|min|[smhjd])/g;
	let total = 0;
	let consomme = 0;
	for (const trouve of propre.matchAll(motif)) {
		const [entier, nombre, unite] = trouve;
		consomme += entier.length;
		const facteur = UNITES_DUREE[unite ?? ""];
		if (facteur === undefined || nombre === undefined) {
			return null;
		}
		total += Number(nombre) * facteur;
	}
	if (consomme !== propre.length || total <= 0) {
		return null;
	}
	return total > MAX_EXCLUSION_MS ? null : total;
}

/** Écrit une durée en français, sans unité vide : `1 h 30 min`, `7 j`. */
export function dureeLisible(ms: number): string {
	if (!Number.isFinite(ms) || ms <= 0) {
		return "—";
	}
	const morceaux: string[] = [];
	let reste = Math.floor(ms / 1000);
	const jours = Math.floor(reste / 86_400);
	reste -= jours * 86_400;
	const heures = Math.floor(reste / 3600);
	reste -= heures * 3600;
	const minutes = Math.floor(reste / 60);
	const secondes = reste - minutes * 60;
	if (jours > 0) morceaux.push(`${jours} j`);
	if (heures > 0) morceaux.push(`${heures} h`);
	if (minutes > 0) morceaux.push(`${minutes} min`);
	if (secondes > 0) morceaux.push(`${secondes} s`);
	return morceaux.join(" ");
}

// ─── Motif d'audit ──────────────────────────────────────────────────────────

/**
 * Compose le motif envoyé au journal d'audit Discord.
 *
 * On y met TOUJOURS l'auteur humain : sans lui, le journal du serveur n'affiche
 * que « Rose Griffon » pour toutes les sanctions, et plus personne ne sait qui a
 * demandé quoi. Le résultat est borné à 512 caractères, limite de l'en-tête.
 */
export function motifAudit(opts: { auteur: string; motif?: string | null }): string {
	const motif = opts.motif?.trim();
	const base = motif && motif.length > 0 ? `${motif} — demandé par ${opts.auteur}` : `Demandé par ${opts.auteur}`;
	return base.length > LIMITE_MOTIF_AUDIT ? `${base.slice(0, LIMITE_MOTIF_AUDIT - 1)}…` : base;
}

// ─── Hiérarchie ─────────────────────────────────────────────────────────────

/** Ce qui empêche une action de modération d'aboutir, avant même de l'essayer. */
export type EmpechementHierarchie =
	| "soi-meme"
	| "le-bot"
	| "proprietaire"
	| "role-superieur"
	| "role-egal";

export interface ContexteHierarchie {
	/** Position du rôle le plus haut du bot. */
	positionBot: number;
	/** Position du rôle le plus haut de la cible. */
	positionCible: number;
	/** La cible est-elle le propriétaire du serveur ? */
	cibleProprietaire: boolean;
	/** La cible est-elle la personne qui lance la commande ? */
	cibleEstAuteur: boolean;
	/** La cible est-elle le bot lui-même ? */
	cibleEstBot: boolean;
}

/**
 * Dit si le bot peut agir sur cette cible, AVANT d'appeler l'API.
 *
 * Discord applique ces règles sans les expliquer : la réponse est un `50013`
 * indifférencié. On les rejoue donc ici pour pouvoir dire au staff CE QUI
 * bloque — un rôle trop haut ne se répare pas de la même façon qu'une tentative
 * de bannir le propriétaire du serveur.
 */
export function empechementHierarchie(contexte: ContexteHierarchie): EmpechementHierarchie | null {
	if (contexte.cibleEstAuteur) {
		return "soi-meme";
	}
	if (contexte.cibleEstBot) {
		return "le-bot";
	}
	if (contexte.cibleProprietaire) {
		return "proprietaire";
	}
	if (contexte.positionCible > contexte.positionBot) {
		return "role-superieur";
	}
	if (contexte.positionCible === contexte.positionBot) {
		return "role-egal";
	}
	return null;
}

/** Phrase expliquant un empêchement, telle qu'elle s'affiche dans un salon. */
export function expliquerEmpechement(empechement: EmpechementHierarchie): string {
	switch (empechement) {
		case "soi-meme":
			return "Tu ne peux pas appliquer cette action sur toi-même.";
		case "le-bot":
			return "Le bot ne peut pas s'appliquer cette action à lui-même.";
		case "proprietaire":
			return "Le propriétaire du serveur est hors de portée de toute modération, même pour un administrateur.";
		case "role-superieur":
			return "Le rôle le plus haut de ce membre est au-dessus de celui du bot : Discord refuse l'action. Remonte le rôle du bot au-dessus dans les paramètres du serveur.";
		case "role-egal":
			return "Ce membre a un rôle de même niveau que le bot : Discord exige un rôle STRICTEMENT plus haut. Remonte le rôle du bot d'un cran.";
	}
}

// ─── Permissions ────────────────────────────────────────────────────────────

/** Les permissions Discord dont chaque famille d'actions a besoin. */
export const PERMISSIONS_PAR_ACTION = Object.freeze({
	bannir: [PermissionFlagsBits.BanMembers],
	expulser: [PermissionFlagsBits.KickMembers],
	exclure: [PermissionFlagsBits.ModerateMembers],
	role: [PermissionFlagsBits.ManageRoles],
	salon: [PermissionFlagsBits.ManageChannels],
	purger: [PermissionFlagsBits.ManageMessages],
	pseudo: [PermissionFlagsBits.ManageNicknames],
	invitation: [PermissionFlagsBits.CreateInstantInvite],
	emoji: [PermissionFlagsBits.ManageGuildExpressions],
	journal: [PermissionFlagsBits.ViewAuditLog],
}) satisfies Record<string, readonly bigint[]>;

export type ActionDiscord = keyof typeof PERMISSIONS_PAR_ACTION;

/** Nom lisible d'un drapeau de permission, pour le dire au staff en clair. */
const NOMS_PERMISSIONS = new Map<bigint, string>([
	[PermissionFlagsBits.BanMembers, "Bannir des membres"],
	[PermissionFlagsBits.KickMembers, "Expulser des membres"],
	[PermissionFlagsBits.ModerateMembers, "Exclure temporairement des membres"],
	[PermissionFlagsBits.ManageRoles, "Gérer les rôles"],
	[PermissionFlagsBits.ManageChannels, "Gérer les salons"],
	[PermissionFlagsBits.ManageMessages, "Gérer les messages"],
	[PermissionFlagsBits.ManageNicknames, "Gérer les pseudos"],
	[PermissionFlagsBits.CreateInstantInvite, "Créer une invitation"],
	[PermissionFlagsBits.ManageGuildExpressions, "Gérer les émojis et autocollants"],
	[PermissionFlagsBits.ViewAuditLog, "Voir le journal d'audit"],
	[PermissionFlagsBits.Administrator, "Administrateur"],
]);

export function nomPermission(drapeau: bigint): string {
	return NOMS_PERMISSIONS.get(drapeau) ?? `Permission ${drapeau}`;
}

/**
 * Permissions manquantes pour une action, en clair.
 *
 * `Administrator` couvre tout : le tester d'abord évite d'annoncer « il manque
 * Bannir des membres » à un bot qui est administrateur du serveur.
 */
export function permissionsManquantes(
	possedees: PermissionsBitField | bigint,
	action: ActionDiscord
): string[] {
	const bits = typeof possedees === "bigint" ? possedees : possedees.bitfield;
	if ((bits & PermissionFlagsBits.Administrator) === PermissionFlagsBits.Administrator) {
		return [];
	}
	return PERMISSIONS_PAR_ACTION[action]
		.filter((requise) => (bits & requise) !== requise)
		.map(nomPermission);
}

// ─── Bornes de saisie ───────────────────────────────────────────────────────

/**
 * Normalise un nom de salon textuel comme Discord le fait lui-même.
 *
 * Sans cette étape, « Salon des Annonces » revient de l'API en
 * `salon-des-annonces` et l'accusé de réception affiche autre chose que la
 * réalité — le staff croit alors à un bug de nommage.
 */
export function normaliserNomSalon(saisie: string): string {
	return saisie
		.trim()
		.toLowerCase()
		.normalize("NFD")
		.replaceAll(/[̀-ͯ]/g, "")
		.replaceAll(/[^a-z0-9-_]+/g, "-")
		.replaceAll(/-{2,}/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, LIMITE_NOM);
}

/** Ramène un mode lent dans les bornes de l'API, ou `null` si la saisie est hors jeu. */
export function normaliserLenteur(secondes: unknown): number | null {
	if (typeof secondes !== "number" || !Number.isFinite(secondes)) {
		return null;
	}
	const entier = Math.trunc(secondes);
	if (entier < 0 || entier > MAX_LENTEUR_SECONDES) {
		return null;
	}
	return entier;
}

/** Ramène un nombre de jours de purge de bannissement dans les bornes (0 à 7). */
export function normaliserJoursPurge(jours: unknown): number | null {
	if (typeof jours !== "number" || !Number.isFinite(jours)) {
		return null;
	}
	const entier = Math.trunc(jours);
	if (entier < 0 || entier > MAX_JOURS_PURGE_BANNISSEMENT) {
		return null;
	}
	return entier;
}

/**
 * Combien de messages une suppression de masse peut réellement toucher.
 *
 * `bulkDelete` exige entre 2 et 100 messages ET refuse tout ce qui dépasse 14
 * jours : demander « 100 » dans un salon calme supprime souvent moins. On le
 * calcule ici pour l'annoncer avant, plutôt que de laisser croire à une purge
 * complète.
 */
export function partitionnerSuppression(
	horodatages: readonly number[],
	maintenant: number,
	demande: number
): { supprimables: number; tropAnciens: number; plafonne: boolean } {
	const limite = Math.min(Math.max(Math.trunc(demande), 0), MAX_SUPPRESSION_MASSE);
	const candidats = horodatages.slice(0, limite);
	let supprimables = 0;
	let tropAnciens = 0;
	for (const horodatage of candidats) {
		if (maintenant - horodatage < AGE_MAX_SUPPRESSION_MASSE_MS) {
			supprimables += 1;
		} else {
			tropAnciens += 1;
		}
	}
	return { supprimables, tropAnciens, plafonne: demande > MAX_SUPPRESSION_MASSE };
}
