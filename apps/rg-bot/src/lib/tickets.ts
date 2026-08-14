/**
 * Tickets d'assistance — le noyau, sans Discord ni base.
 *
 * ── CE QUI EXISTE DÉJÀ, ET QU'ON REPREND ───────────────────────────────────
 * Le serveur n'attend pas un système de tickets : il en a un, et il tourne
 * depuis le 16 avril 2023 (`ticketsbot.net`). Relevé le 14/8/2026 dans la
 * catégorie « 𝐒𝐮𝐩𝐩𝐨𝐫𝐭 » (`1097193189212966973`) :
 *
 *   - `📩〡demandes-tickets` (`1097189982826938529`) — le point d'entrée ;
 *   - `📦〡ticket-history`  (`1097198504667005099`) — 84 cartes « Ticket Closed »,
 *     numéros 1 → 85, chacune avec ses champs *Ticket ID · Opened By · Closed
 *     By · Open Time · Claimed By · Reason* ;
 *   - les tickets sont des **fils** (`View Thread` pointe vers un fil de la
 *     guilde), pas des salons ;
 *   - la consigne du staff, épinglée dans le salon d'entrée :
 *     « **TOUJOURS** fermer avec motif · Synthétiser le problème + solution
 *     (*On peut lire les tickets déjà fermés*) ».
 *
 * Ces quatre faits DÉCIDENT de la conception de ce module. On ne réinvente pas
 * un système de tickets : on reprend celui-là, à l'identique là où il marche, et
 * on corrige le seul point qui coince.
 *
 * ── LE POINT QUI COINCE : LES TRANSCRIPTIONS PARTENT CHEZ UN TIERS ─────────
 * Chaque carte de fermeture porte un bouton « View Online Transcript » vers
 * `dashboard.ticketsbot.net/manage/…/transcripts/view/<n>`. Autrement dit :
 * l'intégralité de 85 conversations privées — signalements, conflits, problèmes
 * personnels — est stockée chez un hébergeur tiers, lisible par qui possède le
 * lien et par l'exploitant du service, et elle survivra au serveur.
 *
 * Ici, la conversation ne quitte jamais Discord. Un ticket fermé est un fil
 * **archivé et verrouillé**, pas un fil supprimé : le staff continue de lire les
 * tickets déjà fermés, exactement comme sa consigne le demande, sans qu'aucune
 * copie n'existe ailleurs. Il n'y a donc pas d'export de transcription : il n'y
 * en a pas besoin.
 *
 * ── CE QUI EST ÉCRIT EN BASE ───────────────────────────────────────────────
 * Des métadonnées, et rien d'autre (`bot_tickets`) : qui a ouvert, quand, dans
 * quelle catégorie, qui a pris en charge, quand c'est fermé, et le motif de
 * fermeture. Aucun message. La base sert à compter et à retrouver, pas à
 * relire.
 *
 * ── MODULE PUR ─────────────────────────────────────────────────────────────
 * Aucune E/S, aucun `discord.js`. Ce qui touche Discord et la base vit dans
 * `services/tickets.ts`.
 */
import { LIMITES } from "./ui/theme";

// ─── Continuité de la numérotation ──────────────────────────────────────────

/**
 * Premier numéro attribué par NOTRE système.
 *
 * `ticketsbot` est allé jusqu'au 85 (relevé sur les 84 cartes de
 * `📦〡ticket-history`, du 16/4/2023 au 25/2/2025). Repartir de 1 créerait deux
 * tickets « #12 » dans le même salon d'historique, à deux ans d'intervalle :
 * la seule référence que le staff cite entre lui deviendrait ambiguë.
 *
 * La suite continue donc là où l'autre s'est arrêtée. C'est une valeur de
 * DÉMARRAGE : le numéro réel est `max(numero) + 1` en base, borné par
 * celle-ci.
 */
export const NUMERO_DEPART = 86;

/** Prochain numéro, à partir du plus grand déjà attribué (0 si la table est vide). */
export function prochainNumero(dernierNumero: number | null | undefined): number {
	const dernier =
		typeof dernierNumero === "number" && Number.isFinite(dernierNumero)
			? Math.floor(dernierNumero)
			: 0;
	return Math.max(NUMERO_DEPART, dernier + 1);
}

// ─── Catégories ─────────────────────────────────────────────────────────────

export interface CategorieTicket {
	/** Clé technique — celle écrite en base et dans les identifiants de boutons. */
	cle: string;
	/** Libellé du bouton du panneau. */
	libelle: string;
	/** Émoji du bouton. Unicode uniquement : les deux bots servent deux serveurs. */
	emoji: string;
	/** Ce que le membre doit y mettre, en une phrase — affiché dans le panneau. */
	description: string;
	/**
	 * Vrai quand le ticket parle d'une PERSONNE (signalement, conflit).
	 * Ces tickets-là ne sont jamais visibles des modérateurs ordinaires : ils
	 * peuvent viser un modérateur.
	 */
	sensible: boolean;
}

/**
 * Les catégories, dans l'ordre d'affichage du panneau.
 *
 * Cinq au maximum : c'est le nombre de boutons d'une rangée Discord
 * (`LIMITES.composantsParRangee`). Au-delà il faudrait une seconde rangée, et
 * un panneau à deux rangées se lit moins bien — autant garder cinq portes bien
 * nommées.
 */
export const CATEGORIES_TICKET: readonly CategorieTicket[] = Object.freeze([
	{
		cle: "aide",
		description: "Une question sur le serveur, un souci technique, une demande d'accès.",
		emoji: "❓",
		libelle: "Aide",
		sensible: false,
	},
	{
		cle: "signalement",
		description: "Signaler un comportement, un message, un conflit. Traité par la direction.",
		emoji: "🛡️",
		libelle: "Signalement",
		sensible: true,
	},
	{
		cle: "boutique",
		description: "Une commande, une livraison, un remboursement sur la boutique.",
		emoji: "🛍️",
		libelle: "Boutique",
		sensible: false,
	},
	{
		cle: "wiki",
		description: "Contribuer au wiki Azalée, signaler une donnée fausse, demander un accès.",
		emoji: "📚",
		libelle: "Wiki Azalée",
		sensible: false,
	},
	{
		cle: "partenariat",
		description: "Partenariat, presse, collaboration, événement commun.",
		emoji: "🤝",
		libelle: "Partenariat",
		sensible: false,
	},
]);

export function categorieTicket(cle: unknown): CategorieTicket | null {
	if (typeof cle !== "string") {
		return null;
	}
	return CATEGORIES_TICKET.find((categorie) => categorie.cle === cle) ?? null;
}

/** Libellé d'une catégorie ; la clé brute si elle vient d'une ligne ancienne. */
export function libelleCategorieTicket(cle: string): string {
	return categorieTicket(cle)?.libelle ?? cle;
}

// ─── États ──────────────────────────────────────────────────────────────────

export const ETATS_TICKET = ["ouvert", "pris", "ferme"] as const;

export type EtatTicket = (typeof ETATS_TICKET)[number];

export function estEtatTicket(valeur: unknown): valeur is EtatTicket {
	return typeof valeur === "string" && (ETATS_TICKET as readonly string[]).includes(valeur);
}

const LIBELLES_ETAT: Readonly<Record<EtatTicket, string>> = Object.freeze({
	ferme: "⚫ Fermé",
	ouvert: "🟢 En attente",
	pris: "🟡 Pris en charge",
});

export function libelleEtatTicket(etat: string): string {
	return estEtatTicket(etat) ? LIBELLES_ETAT[etat] : "⚪ État inconnu";
}

/**
 * Transitions permises.
 *
 * `pris → ouvert` existe : un membre du staff peut rendre un ticket qu'il ne
 * peut pas traiter. Sans ce retour, la seule sortie serait de fermer — et
 * `ticketsbot` montre où ça mène : sur les cartes relevées, « Claimed By » vaut
 * « Not claimed » alors que le ticket a bel et bien été traité. Une prise en
 * charge qu'on ne peut pas rendre n'est jamais prise.
 */
const TRANSITIONS: Readonly<Record<EtatTicket, readonly EtatTicket[]>> = Object.freeze({
	ferme: [],
	ouvert: ["pris", "ferme"],
	pris: ["ouvert", "ferme"],
});

export function transitionPermise(depuis: string, vers: string): boolean {
	if (!estEtatTicket(depuis) || !estEtatTicket(vers)) {
		return false;
	}
	return TRANSITIONS[depuis].includes(vers);
}

/** Pourquoi une transition est refusée, en une phrase adressée au staff. */
export function refusTransition(depuis: string, vers: string): string {
	if (depuis === "ferme") {
		return "Ce ticket est déjà fermé. Son fil reste lisible, mais il ne se rouvre pas : ouvre-en un nouveau.";
	}
	if (depuis === vers) {
		return `Ce ticket est déjà « ${libelleEtatTicket(depuis)} ».`;
	}
	return `Passage impossible de « ${libelleEtatTicket(depuis)} » à « ${libelleEtatTicket(vers)} ».`;
}

// ─── Nommage ────────────────────────────────────────────────────────────────

/**
 * Longueur maximale du nom d'un salon ou d'un fil Discord. Dépasser ne tronque
 * pas : l'API refuse la création, et le membre voit un échec sans savoir
 * pourquoi.
 */
export const LONGUEUR_NOM_SALON = 100;

/**
 * Nom du fil d'un ticket : `ticket-0086`.
 *
 * ── POURQUOI PAS LE PSEUDO DANS LE NOM ─────────────────────────────────────
 * `ticket-pseudo` est l'usage courant, et c'est une fuite : le nom d'un fil
 * apparaît dans la liste du salon parent et survit dans le journal d'audit du
 * serveur. « Untel a ouvert un signalement » n'a pas à se lire sans même ouvrir
 * le fil.
 *
 * Le NUMÉRO, lui, ne dit rien à qui ne l'a pas ouvert, et il se cite en réunion
 * comme dans un message. Rembourré à quatre chiffres pour que l'ordre
 * alphabétique de Discord suive l'ordre chronologique.
 */
export function nomSalonTicket(numero: number): string {
	const borne = Number.isFinite(numero) ? Math.max(0, Math.floor(numero)) : 0;
	return `ticket-${String(borne).padStart(4, "0")}`;
}

/** Le numéro lisible d'un ticket, tel qu'on le cite : `#0086`. */
export function referenceTicket(numero: number): string {
	const borne = Number.isFinite(numero) ? Math.max(0, Math.floor(numero)) : 0;
	return `#${String(borne).padStart(4, "0")}`;
}

// ─── Sujet et motif ─────────────────────────────────────────────────────────

/** Longueur du sujet saisi à l'ouverture. Court à dessein : il NOMME, il ne raconte pas. */
export const LONGUEUR_SUJET = 100;

/** Longueur du motif de fermeture — assez pour une synthèse « problème + solution ». */
export const LONGUEUR_MOTIF = 500;

function nettoyer(brut: unknown, limite: number): string | null {
	if (typeof brut !== "string") {
		return null;
	}
	const propre = brut.replaceAll(/\s+/g, " ").trim();
	if (propre.length === 0) {
		return null;
	}
	return propre.length <= limite ? propre : `${propre.slice(0, limite - 1)}…`;
}

/**
 * Nettoie le sujet saisi.
 *
 * Les retours à la ligne sont écrasés : le sujet part dans le nom du fil et dans
 * le titre d'un embed, deux endroits où un saut de ligne casse la mise en page.
 * Le Markdown est laissé tel quel — c'est l'affichage qui échappe
 * (`ui/texte.echapper`), pas le stockage : échapper à l'écriture rendrait la
 * donnée illisible en base.
 */
export function sujetPropre(brut: unknown): string | null {
	return nettoyer(brut, LONGUEUR_SUJET);
}

/**
 * Le motif de fermeture est OBLIGATOIRE, et c'est la consigne du staff qui le
 * dit : « TOUJOURS fermer avec motif · Synthétiser le problème + solution ».
 *
 * `ticketsbot` la laissait facultative : sur la carte la plus récente de
 * l'historique, le champ *Reason* vaut « No reason specified ». Une consigne
 * qu'aucun outil ne fait respecter n'est pas une consigne.
 */
export function motifPropre(brut: unknown): string | null {
	return nettoyer(brut, LONGUEUR_MOTIF);
}

// ─── Garde d'ouverture ──────────────────────────────────────────────────────

/** Nombre de tickets qu'un membre peut avoir ouverts en même temps. */
export const TICKETS_SIMULTANES = 1;

export type ResultatOuverture =
	| { ok: true; categorie: CategorieTicket; sujet: string | null }
	| { ok: false; erreur: string; salonExistant?: string };

/**
 * Le membre peut-il ouvrir ce ticket ?
 *
 * `salonsOuverts` est la liste des fils de ses tickets non fermés : quand elle
 * n'est pas vide, l'erreur RENVOIE vers le premier plutôt que de refuser sans
 * issue. C'est ce qui distingue une garde utile d'un mur.
 */
export function verifierOuverture(
	categorieCle: unknown,
	sujetBrut: unknown,
	salonsOuverts: readonly string[] = []
): ResultatOuverture {
	const categorie = categorieTicket(categorieCle);
	if (!categorie) {
		return {
			erreur: `Catégorie inconnue. Choisis parmi : ${CATEGORIES_TICKET.map((c) => c.libelle).join(", ")}.`,
			ok: false,
		};
	}
	if (salonsOuverts.length >= TICKETS_SIMULTANES) {
		const premier = salonsOuverts[0] as string;
		return {
			erreur:
				"Tu as déjà un ticket ouvert. Continue dedans plutôt que d'en ouvrir un second : " +
				"le staff y répond, et deux tickets en parallèle font perdre le fil.",
			ok: false,
			salonExistant: premier,
		};
	}
	return { categorie, ok: true, sujet: sujetPropre(sujetBrut) };
}

// ─── Identifiants de composants ─────────────────────────────────────────────

/**
 * Préfixe des identifiants de composants du système de tickets.
 *
 * Il est vérifié à la lecture : un identifiant de bouton est de la donnée qui
 * revient du CLIENT, et rien ne garantit qu'un autre module n'utilise pas le
 * même nom de bouton un jour.
 */
export const PREFIXE_COMPOSANT = "ticket";

export type ActionTicket = "ouvrir" | "prendre" | "rendre" | "fermer" | "confirmer";

const ACTIONS = new Set<string>(["ouvrir", "prendre", "rendre", "fermer", "confirmer"]);

/** `ticket:ouvrir:signalement` — borné à la limite dure de l'API (100). */
export function identifiantComposant(action: ActionTicket, argument?: string): string {
	const brut = [PREFIXE_COMPOSANT, action, argument].filter(Boolean).join(":");
	return brut.length <= LIMITES.identifiantComposant
		? brut
		: brut.slice(0, LIMITES.identifiantComposant);
}

export interface ComposantTicket {
	action: ActionTicket;
	argument: string | null;
}

/** Relit un identifiant de composant. `null` si ce n'en est pas un des nôtres. */
export function lireComposant(identifiant: unknown): ComposantTicket | null {
	if (typeof identifiant !== "string") {
		return null;
	}
	const morceaux = identifiant.split(":");
	if (morceaux[0] !== PREFIXE_COMPOSANT || morceaux.length < 2) {
		return null;
	}
	const action = morceaux[1] as ActionTicket;
	if (!ACTIONS.has(action)) {
		return null;
	}
	return { action, argument: morceaux.length > 2 ? morceaux.slice(2).join(":") : null };
}

// ─── Qui voit le ticket ─────────────────────────────────────────────────────

/**
 * Un ticket est un FIL PRIVÉ, comme aujourd'hui — pas un salon.
 *
 * Un fil privé n'a pas de surcharges de permissions : sa visibilité est sa
 * liste de membres. Le plan ci-dessous est donc une liste de gens à INVITER,
 * et non des `PermissionOverwrites`. C'est aussi ce qui rend le système
 * increvable : 85 tickets en trois ans, ce sont 85 salons dans la limite de
 * 500 salons d'un serveur si on les crée en salons — en fils, aucune limite ne
 * s'approche.
 */
export interface ContexteAcces {
	auteurId: string;
	/** Rôles qui prennent en charge les tickets ordinaires. */
	rolesStaff: readonly string[];
	/** Rôles qui voient AUSSI les tickets sensibles. */
	rolesDirection: readonly string[];
	sensible: boolean;
}

export interface Invitation {
	/** `role` : à mentionner une fois dans le fil pour y faire entrer ses porteurs. */
	genre: "role" | "membre";
	id: string;
	/** Pourquoi cette entrée existe — repris tel quel dans le journal d'audit. */
	raison: string;
}

/**
 * Qui doit rejoindre le fil.
 *
 * ── LE CAS QUI JUSTIFIE TOUT ───────────────────────────────────────────────
 * Un signalement peut viser un modérateur. Ouvrir le fil à « toute la
 * modération » par défaut revient à prévenir la personne visée avant même que
 * le staff n'ait lu la demande. Les tickets `sensible` ne vont donc qu'à la
 * DIRECTION, et l'absence de rôle de direction configuré est une erreur
 * d'exploitation — pas une raison de retomber sur la modération ordinaire.
 *
 * ── UN TICKET ORDINAIRE NE PING QUE LA PRISE EN CHARGE ─────────────────────
 * La direction ne fait PLUS partie du ping des tickets ordinaires (elle l'a
 * été un temps, par symétrie avec la lecture — d'où le `Set` ci-dessous qui
 * reste prêt si la règle devait un jour redevenir plus large). Sur un serveur
 * de deux mille membres, notifier l'Administrateur et le Vice-administrateur
 * à chaque ticket banal est le genre de bruit que la règle « rester discret »
 * interdit. La direction garde l'accès (elle porte `ManageThreads`, comme
 * tout rôle de tickets) — elle ne reçoit simplement plus la notification.
 */
export function invitations(contexte: ContexteAcces): Invitation[] {
	const liste: Invitation[] = [
		{ genre: "membre", id: contexte.auteurId, raison: "Auteur du ticket." },
	];
	const habilites = contexte.sensible ? contexte.rolesDirection : [...new Set(contexte.rolesStaff)];
	for (const roleId of habilites) {
		liste.push({
			genre: "role",
			id: roleId,
			raison: contexte.sensible
				? "Ticket sensible : direction seulement."
				: "Rôle de prise en charge des tickets.",
		});
	}
	return liste;
}

/**
 * Ce qui manque pour qu'une catégorie soit ouvrable, `null` si tout est là.
 *
 * Un panneau qui propose « Signalement » sans rôle de direction configuré crée
 * des fils que PERSONNE ne voit à part l'auteur. Mieux vaut refuser à
 * l'ouverture, en nommant le réglage à poser.
 */
export function manqueDeConfiguration(
	categorie: CategorieTicket,
	contexte: Pick<ContexteAcces, "rolesStaff" | "rolesDirection">
): string | null {
	if (categorie.sensible) {
		return contexte.rolesDirection.length > 0
			? null
			: "Aucun rôle de direction n'est configuré : un ticket sensible n'aurait aucun destinataire. " +
					"Pose-le avec `/gestion ticket reglages`.";
	}
	return contexte.rolesStaff.length > 0 || contexte.rolesDirection.length > 0
		? null
		: "Aucun rôle de prise en charge n'est configuré : le ticket n'aurait aucun destinataire. " +
				"Pose-le avec `/gestion ticket reglages`.";
}
