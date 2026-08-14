/**
 * Tickets — la partie qui touche Discord et la base.
 *
 * Les règles vivent dans `lib/tickets.ts` (module pur, testé). Ici : créer un
 * fil, y faire entrer les bonnes personnes, écrire la ligne, fermer proprement.
 *
 * ── POURQUOI DES FILS PRIVÉS ───────────────────────────────────────────────
 * C'est ce que fait déjà le serveur depuis 2023 (`ticketsbot` — le bouton
 * « View Thread » de chaque carte d'historique pointe vers un fil), et c'est le
 * bon choix : un serveur Discord est plafonné à 500 salons, jamais aux fils.
 * 85 tickets en trois ans en salons auraient déjà mangé un sixième du quota.
 *
 * ── QUI VOIT UN FIL PRIVÉ ──────────────────────────────────────────────────
 * Deux populations, et deux mécanismes DIFFÉRENTS :
 *
 *   - les MEMBRES invités. On y entre par mention : mentionner quelqu'un dans
 *     un fil l'y ajoute. C'est comme ça que l'auteur du ticket entre.
 *   - le STAFF, par la permission **Gérer les fils** (`ManageThreads`) sur le
 *     salon parent. Mentionner un RÔLE n'ajoute personne — c'est le piège
 *     classique, et il produit des tickets que le staff ne voit jamais.
 *
 * Conséquence d'exploitation, écrite ici parce qu'elle ne se devine pas : les
 * rôles configurés dans `tickets.rolesStaff` / `rolesDirection` DOIVENT porter
 * « Gérer les fils » sur le salon du panneau. `diagnostiquerAcces` le vérifie et
 * le dit, plutôt que de laisser découvrir le trou au premier signalement.
 */
import {
	ChannelType,
	PermissionFlagsBits,
	type Guild,
	type GuildTextBasedChannel,
	type TextChannel,
	type ThreadChannel,
} from "discord.js";

/**
 * Salon capable de porter un fil PRIVÉ.
 *
 * Il n'y en a qu'un type, et ce n'est pas une simplification : un salon
 * d'annonces ne porte que des fils d'annonces (publics), un salon de conférence
 * et un fil n'en portent aucun. Élargir ce type ferait passer le type-check et
 * échouer l'API à l'exécution, sur le premier ticket ouvert depuis le mauvais
 * salon.
 */
export type SalonAFils = TextChannel;

/** Ce salon peut-il porter un fil privé ? Garde de type, utilisable côté commandes. */
export function porteDesFils(salon: GuildTextBasedChannel | null): salon is SalonAFils {
	return salon !== null && salon.type === ChannelType.GuildText;
}

import { sql } from "../lib/db";
import {
	categorieTicket,
	invitations,
	nomSalonTicket,
	prochainNumero,
	referenceTicket,
	type CategorieTicket,
	type EtatTicket,
} from "../lib/tickets";

// ─── Lignes ─────────────────────────────────────────────────────────────────

export interface Ticket {
	id: number;
	guildId: string;
	numero: number;
	salonId: string;
	auteurId: string;
	categorie: string;
	sujet: string | null;
	statut: EtatTicket;
	prisPar: string | null;
	fermePar: string | null;
	ouvertLe: Date;
	prisLe: Date | null;
	fermeLe: Date | null;
}

interface LigneTicket {
	id: string | number;
	guild_id: string;
	numero: number;
	salon_id: string;
	auteur_id: string;
	categorie: string;
	sujet: string | null;
	statut: string;
	pris_par: string | null;
	ferme_par: string | null;
	ouvert_le: Date;
	pris_le: Date | null;
	ferme_le: Date | null;
}

function versTicket(ligne: LigneTicket): Ticket {
	return {
		auteurId: ligne.auteur_id,
		categorie: ligne.categorie,
		fermeLe: ligne.ferme_le,
		fermePar: ligne.ferme_par,
		guildId: ligne.guild_id,
		id: Number(ligne.id),
		numero: ligne.numero,
		ouvertLe: ligne.ouvert_le,
		prisLe: ligne.pris_le,
		prisPar: ligne.pris_par,
		salonId: ligne.salon_id,
		statut: ligne.statut as EtatTicket,
		sujet: ligne.sujet,
	};
}

const COLONNES = sql`
	id, guild_id, numero, salon_id, auteur_id, categorie, sujet, statut,
	pris_par, ferme_par, ouvert_le, pris_le, ferme_le
`;

/** Le ticket dont ce salon (ou ce fil) est le support, `null` sinon. */
export async function ticketDuSalon(salonId: string): Promise<Ticket | null> {
	const lignes = await sql<LigneTicket[]>`
		SELECT ${COLONNES} FROM bot_tickets WHERE salon_id = ${salonId} LIMIT 1
	`;
	const ligne = lignes[0];
	return ligne ? versTicket(ligne) : null;
}

/** Les tickets NON FERMÉS d'un membre. C'est la matière de la garde anti-doublon. */
export async function ticketsOuvertsDe(guildId: string, auteurId: string): Promise<Ticket[]> {
	const lignes = await sql<LigneTicket[]>`
		SELECT ${COLONNES} FROM bot_tickets
		 WHERE guild_id = ${guildId} AND auteur_id = ${auteurId} AND statut <> 'ferme'
		 ORDER BY ouvert_le ASC
	`;
	return lignes.map(versTicket);
}

/** Tous les tickets non fermés de la guilde, du plus ancien au plus récent. */
export async function ticketsOuverts(guildId: string, limite = 25): Promise<Ticket[]> {
	const lignes = await sql<LigneTicket[]>`
		SELECT ${COLONNES} FROM bot_tickets
		 WHERE guild_id = ${guildId} AND statut <> 'ferme'
		 ORDER BY ouvert_le ASC
		 LIMIT ${Math.min(50, Math.max(1, Math.floor(limite)))}
	`;
	return lignes.map(versTicket);
}

/** Compte les tickets par état, pour la vue d'exploitation. */
export async function compterTickets(
	guildId: string
): Promise<{ ouvert: number; pris: number; ferme: number }> {
	const lignes = await sql<Array<{ statut: string; total: string }>>`
		SELECT statut, count(*)::text AS total FROM bot_tickets
		 WHERE guild_id = ${guildId} GROUP BY statut
	`;
	const compte = { ferme: 0, ouvert: 0, pris: 0 };
	for (const ligne of lignes) {
		if (ligne.statut === "ouvert" || ligne.statut === "pris" || ligne.statut === "ferme") {
			compte[ligne.statut] = Number(ligne.total) || 0;
		}
	}
	return compte;
}

// ─── Ouverture ──────────────────────────────────────────────────────────────

export interface DemandeOuverture {
	guilde: Guild;
	salonPanneau: SalonAFils;
	auteurId: string;
	categorie: CategorieTicket;
	sujet: string | null;
	rolesStaff: readonly string[];
	rolesDirection: readonly string[];
}

export interface TicketOuvert {
	ticket: Ticket;
	fil: ThreadChannel;
}

/**
 * Ouvre un ticket : un fil privé, sa ligne en base, son message d'accueil.
 *
 * ── L'ORDRE N'EST PAS ARBITRAIRE ───────────────────────────────────────────
 * 1. la LIGNE d'abord, avec son numéro : c'est elle qui porte l'unicité
 *    (`unique (guild_id, numero)`). Deux ouvertures simultanées se disputent la
 *    contrainte, et la perdante réessaie — alors que deux fils créés d'abord
 *    porteraient le même nom sans que rien ne s'en aperçoive.
 * 2. le FIL ensuite, nommé d'après le numéro obtenu.
 * 3. la ligne est MISE À JOUR avec l'identifiant du fil.
 *
 * Si la création du fil échoue, la ligne est supprimée : un ticket sans fil est
 * un ticket que personne ne peut ouvrir ni fermer.
 */
export async function ouvrirTicket(demande: DemandeOuverture): Promise<TicketOuvert> {
	const guildId = demande.guilde.id;

	// Numéro : `max + 1`, jamais en dessous du seuil de reprise (86, cf.
	// `lib/tickets.NUMERO_DEPART`). La contrainte d'unicité tranche en cas de
	// course ; une seule reprise suffit à couvrir deux ouvertures simultanées.
	let ticket: Ticket | null = null;
	let derniereErreur: unknown = null;
	for (let essai = 0; essai < 3 && ticket === null; essai++) {
		const [dernier] = await sql<Array<{ numero: number | null }>>`
			SELECT max(numero) AS numero FROM bot_tickets WHERE guild_id = ${guildId}
		`;
		const numero = prochainNumero(dernier?.numero ?? null);
		try {
			const [ligne] = await sql<LigneTicket[]>`
				INSERT INTO bot_tickets (guild_id, numero, salon_id, auteur_id, categorie, sujet)
				VALUES (${guildId}, ${numero}, '', ${demande.auteurId}, ${demande.categorie.cle},
				        ${demande.sujet})
				RETURNING ${COLONNES}
			`;
			ticket = ligne ? versTicket(ligne) : null;
		} catch (err) {
			derniereErreur = err;
		}
	}
	if (!ticket) {
		throw new Error(
			`Numéro de ticket impossible à réserver après trois tentatives : ${
				derniereErreur instanceof Error ? derniereErreur.message : String(derniereErreur)
			}`
		);
	}

	let fil: ThreadChannel;
	try {
		fil = await demande.salonPanneau.threads.create({
			// Les fils privés ne s'archivent pas d'eux-mêmes avant une semaine : un
			// ticket laissé sans réponse trois jours ne doit pas disparaître de la
			// liste du staff.
			autoArchiveDuration: 10_080,
			// `invitable: false` : seuls le staff et nous ajoutons du monde. Sans ça,
			// l'auteur d'un signalement peut y faire entrer qui il veut.
			invitable: false,
			name: nomSalonTicket(ticket.numero),
			reason: `Ticket ${referenceTicket(ticket.numero)} — ${demande.categorie.libelle}`,
			type: ChannelType.PrivateThread,
		});
	} catch (err) {
		await sql`DELETE FROM bot_tickets WHERE id = ${ticket.id}`;
		throw err;
	}

	await sql`UPDATE bot_tickets SET salon_id = ${fil.id}, maj_le = NOW() WHERE id = ${ticket.id}`;
	ticket = { ...ticket, salonId: fil.id };

	// Mentionner l'auteur l'AJOUTE au fil ; mentionner les rôles ne fait que
	// notifier (leurs porteurs voient le fil par « Gérer les fils »).
	const aInviter = invitations({
		auteurId: demande.auteurId,
		rolesDirection: demande.rolesDirection,
		rolesStaff: demande.rolesStaff,
		sensible: demande.categorie.sensible,
	});
	const mentions = aInviter
		.map((entree) => (entree.genre === "membre" ? `<@${entree.id}>` : `<@&${entree.id}>`))
		.join(" ");

	try {
		await fil.members.add(demande.auteurId).catch(() => undefined);
		await fil.send({
			allowedMentions: { parse: ["users", "roles"] },
			content: mentions,
		});
	} catch (err) {
		console.warn(
			`[tickets] invitation impossible sur ${fil.id} :`,
			err instanceof Error ? err.message : err
		);
	}

	return { fil, ticket };
}

// ─── Cycle de vie ───────────────────────────────────────────────────────────

/** Passe un ticket en « pris en charge ». Rend `null` si la ligne a disparu. */
export async function prendreTicket(ticketId: number, staffId: string): Promise<Ticket | null> {
	const lignes = await sql<LigneTicket[]>`
		UPDATE bot_tickets
		   SET statut = 'pris', pris_par = ${staffId}, pris_le = NOW(), maj_le = NOW()
		 WHERE id = ${ticketId} AND statut <> 'ferme'
		RETURNING ${COLONNES}
	`;
	const ligne = lignes[0];
	return ligne ? versTicket(ligne) : null;
}

/** Rend un ticket au pot commun — le staff qui l'avait pris ne peut pas traiter. */
export async function rendreTicket(ticketId: number): Promise<Ticket | null> {
	const lignes = await sql<LigneTicket[]>`
		UPDATE bot_tickets
		   SET statut = 'ouvert', pris_par = NULL, pris_le = NULL, maj_le = NOW()
		 WHERE id = ${ticketId} AND statut = 'pris'
		RETURNING ${COLONNES}
	`;
	const ligne = lignes[0];
	return ligne ? versTicket(ligne) : null;
}

/**
 * Ferme un ticket. Le motif est obligatoire côté appelante (`motifPropre`).
 *
 * Le fil est ARCHIVÉ et VERROUILLÉ, jamais supprimé : la consigne du staff dit
 * « on peut lire les tickets déjà fermés », et c'est ce qui remplace la
 * transcription exportée chez un tiers.
 */
export async function fermerTicket(
	ticketId: number,
	staffId: string,
	motif: string
): Promise<Ticket | null> {
	const lignes = await sql<LigneTicket[]>`
		UPDATE bot_tickets
		   SET statut = 'ferme', ferme_par = ${staffId}, ferme_le = NOW(),
		       sujet = COALESCE(sujet, ${motif}), maj_le = NOW()
		 WHERE id = ${ticketId} AND statut <> 'ferme'
		RETURNING ${COLONNES}
	`;
	const ligne = lignes[0];
	return ligne ? versTicket(ligne) : null;
}

/** Archive et verrouille le fil. Ne lève jamais : la ligne est déjà écrite. */
export async function clore(fil: ThreadChannel, raison: string): Promise<void> {
	try {
		await fil.setLocked(true, raison);
		await fil.setArchived(true, raison);
	} catch (err) {
		console.warn(
			`[tickets] archivage impossible du fil ${fil.id} :`,
			err instanceof Error ? err.message : err
		);
	}
}

// ─── Diagnostic ─────────────────────────────────────────────────────────────

export interface Diagnostic {
	/** Ce qui empêche le système de fonctionner, prêt à afficher. */
	blocages: string[];
	/** Ce qui marchera mais mérite d'être su. */
	avertissements: string[];
}

/**
 * Vérifie que le système PEUT fonctionner, avant qu'un membre ne s'en aperçoive.
 *
 * Deux vérifications que rien d'autre ne fait :
 *   - le BOT peut-il créer un fil privé et y écrire ?
 *   - les rôles de prise en charge portent-ils « Gérer les fils » ? Sans elle,
 *     les tickets existent, sont bien créés, et personne ne les voit. C'est la
 *     panne la plus coûteuse du domaine : elle est silencieuse.
 */
export async function diagnostiquerAcces(
	guilde: Guild,
	salonPanneau: GuildTextBasedChannel,
	roles: readonly string[]
): Promise<Diagnostic> {
	const blocages: string[] = [];
	const avertissements: string[] = [];

	const moi = guilde.members.me;
	if (!moi) {
		blocages.push("Le bot n'est pas résolu comme membre de ce serveur.");
		return { avertissements, blocages };
	}
	const miennes = salonPanneau.permissionsFor(moi);
	if (!miennes?.has(PermissionFlagsBits.CreatePrivateThreads)) {
		blocages.push(
			`Le bot n'a pas « Créer des fils privés » sur ${salonPanneau.toString()} : aucun ticket ne peut être ouvert.`
		);
	}
	if (!miennes?.has(PermissionFlagsBits.SendMessagesInThreads)) {
		blocages.push(
			`Le bot n'a pas « Envoyer des messages dans les fils » sur ${salonPanneau.toString()} : le ticket serait créé puis muet.`
		);
	}
	if (!miennes?.has(PermissionFlagsBits.ManageThreads)) {
		avertissements.push(
			`Le bot n'a pas « Gérer les fils » sur ${salonPanneau.toString()} : il ne pourra pas archiver un ticket à la fermeture.`
		);
	}

	for (const roleId of roles) {
		const role = guilde.roles.cache.get(roleId) ?? (await guilde.roles.fetch(roleId).catch(() => null));
		if (!role) {
			avertissements.push(`Le rôle \`${roleId}\` n'existe plus sur ce serveur.`);
			continue;
		}
		const siennes = salonPanneau.permissionsFor(role);
		if (!siennes?.has(PermissionFlagsBits.ManageThreads)) {
			blocages.push(
				`${role.toString()} n'a pas « Gérer les fils » sur ${salonPanneau.toString()} : ses membres ne VERRONT PAS les tickets. ` +
					"Un fil privé n'est visible que de ses invités et des porteurs de cette permission."
			);
		}
	}

	return { avertissements, blocages };
}

/** Résout la catégorie d'un ticket en base, `null` si elle a disparu du code. */
export function categorieDe(ticket: Ticket): CategorieTicket | null {
	return categorieTicket(ticket.categorie);
}
