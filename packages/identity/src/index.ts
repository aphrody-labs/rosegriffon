/**
 * Compte unique Rose Griffon — identité native et connexions liées.
 *
 * ── LE PROBLÈME ─────────────────────────────────────────────────────────────
 * Aujourd'hui, un compte Rose Griffon ne peut PAS exister sans un tiers.
 * `apps/website/src/lib/auth.ts` déclare Discord, Twitch et Google en
 * fournisseurs, et aucune authentification native : pour entrer, il faut un
 * compte chez quelqu'un d'autre. Si Discord suspend un compte, change ses
 * conditions ou refuse un consentement, le membre perd l'accès au site de
 * l'association — et au wiki, et à l'e-sport.
 *
 * Achilléa aggrave le tableau : il porte sa PROPRE session Discord, distincte
 * de celle de Rose Griffon. Le même membre a donc deux identités sur le même
 * site, et la barre Achilléa doit afficher son propre contrôle de compte parce
 * que celui du chrome global ne parle pas de lui.
 *
 * ── CE QUE CE MODULE DÉCRIT ─────────────────────────────────────────────────
 * Un compte, plusieurs connexions. L'adresse e-mail est l'identité NATIVE :
 * elle appartient à Rose Griffon, elle suffit à se connecter, et aucune
 * plateforme ne peut la révoquer. Tout le reste — Discord, Patreon, Twitch,
 * Google, Steam, Achilléa — vient s'y rattacher pour apporter une capacité
 * (rôles de serveur, statut de mécène, progression de jeu), jamais pour
 * conditionner l'accès.
 *
 * ── L'INVARIANT QUI MANQUAIT ────────────────────────────────────────────────
 * Un système multi-connexion sans garde-fou laisse l'utilisateur se verrouiller
 * dehors : il délie sa dernière connexion et son compte devient inaccessible.
 * `peutDelier()` refuse ce cas. C'est la seule règle de ce module qui empêche
 * une perte réelle, et c'est pour elle qu'il existe.
 *
 * ── MODULE PUR ──────────────────────────────────────────────────────────────
 * Aucune E/S, aucune dépendance. Il décrit et il décide ; la persistance est
 * ailleurs.
 */

/** Connexions rattachables à un compte. */
export const CONNEXIONS = [
	"email",
	"discord",
	"patreon",
	"twitch",
	"google",
	"steam",
	"achillea",
] as const;

export type Connexion = (typeof CONNEXIONS)[number];

export interface DescriptionConnexion {
	id: Connexion;
	nom: string;
	/**
	 * Permet-elle, à elle seule, de se connecter ?
	 *
	 * C'est la distinction qui compte. Patreon dit qui est mécène, Steam dit
	 * quelle progression afficher : ni l'un ni l'autre ne doit pouvoir servir
	 * de clé unique, sinon perdre l'accès au tiers revient à perdre le compte.
	 */
	authentifiante: boolean;
	/**
	 * Native à Rose Griffon ?
	 *
	 * Une seule l'est : l'adresse e-mail. Elle ne dépend d'aucune plateforme et
	 * ne peut donc pas être révoquée par un tiers.
	 */
	native: boolean;
	/** Ce que la connexion apporte, en une phrase. Affiché sur la page compte. */
	apporte: string;
}

export const DESCRIPTIONS: Readonly<Record<Connexion, DescriptionConnexion>> = Object.freeze({
	achillea: {
		apporte: "Clans, mode classé, tournois et licence compétitive.",
		authentifiante: false,
		id: "achillea",
		native: false,
		nom: "Achilléa",
	},
	discord: {
		apporte: "Rôles du serveur, notifications et identité de la communauté.",
		authentifiante: true,
		id: "discord",
		native: false,
		nom: "Discord",
	},
	email: {
		apporte: "Se connecter sans dépendre d'aucune plateforme extérieure.",
		authentifiante: true,
		id: "email",
		native: true,
		nom: "Adresse e-mail",
	},
	google: {
		apporte: "Connexion rapide.",
		authentifiante: true,
		id: "google",
		native: false,
		nom: "Google",
	},
	patreon: {
		apporte: "Statut de mécène, avantages et réduction boutique.",
		authentifiante: false,
		id: "patreon",
		native: false,
		nom: "Patreon",
	},
	steam: {
		apporte: "Progression et succès d'Inazuma Eleven: Victory Road.",
		authentifiante: false,
		id: "steam",
		native: false,
		nom: "Steam",
	},
	twitch: {
		apporte: "Abonnement à la chaîne et statut de streameur.",
		authentifiante: true,
		id: "twitch",
		native: false,
		nom: "Twitch",
	},
});

/** Une connexion rattachée à un compte. */
export interface ConnexionLiee {
	type: Connexion;
	/** Identifiant chez le fournisseur. L'e-mail natif n'en a pas. */
	identifiant?: string;
	/** Libellé affichable (pseudo, adresse). */
	libelle?: string;
	liee_le?: Date;
}

/** Les connexions du compte qui permettent, à elles seules, de se connecter. */
export function connexionsAuthentifiantes(liees: readonly ConnexionLiee[]): ConnexionLiee[] {
	return liees.filter((c) => DESCRIPTIONS[c.type]?.authentifiante);
}

/** Le compte a-t-il une identité native, indépendante de toute plateforme ? */
export function aIdentiteNative(liees: readonly ConnexionLiee[]): boolean {
	return liees.some((c) => DESCRIPTIONS[c.type]?.native);
}

export type RefusDeliaison =
	| { autorise: true }
	| { autorise: false; motif: "non_liee" | "derniere_authentifiante" };

/**
 * Peut-on délier cette connexion sans verrouiller l'utilisateur dehors ?
 *
 * Refuse la dernière connexion authentifiante. Sans cette règle, un membre qui
 * ne s'est jamais donné de mot de passe et qui délie Discord perd l'accès à son
 * propre compte — à ses commandes, à sa licence, à son clan — sans aucun moyen
 * de revenir. C'est une perte irréversible produite par un clic.
 *
 * Délier une connexion NON authentifiante (Patreon, Steam, Achilléa) est
 * toujours permis : elle n'ouvre aucune porte, elle ne fait qu'apporter une
 * capacité.
 */
export function peutDelier(
	liees: readonly ConnexionLiee[],
	cible: Connexion
): RefusDeliaison {
	if (!liees.some((c) => c.type === cible)) {
		return { autorise: false, motif: "non_liee" };
	}

	if (!DESCRIPTIONS[cible]?.authentifiante) return { autorise: true };

	const restantes = connexionsAuthentifiantes(liees).filter((c) => c.type !== cible);
	if (restantes.length === 0) {
		return { autorise: false, motif: "derniere_authentifiante" };
	}

	return { autorise: true };
}

/** Message affichable pour un refus. */
export function messageRefus(motif: RefusDeliaison extends { motif: infer M } ? M : never): string {
	if (motif === "non_liee") return "Cette connexion n'est pas rattachée à ton compte.";
	return "C'est ta seule façon de te connecter. Ajoute une adresse e-mail ou une autre connexion avant de la retirer.";
}

export interface EtatCompte {
	liees: ConnexionLiee[];
	/** Connexions proposables, dans l'ordre d'affichage. */
	disponibles: DescriptionConnexion[];
	/** Le compte survivrait-il à la perte de toutes les plateformes tierces ? */
	autonome: boolean;
	/**
	 * Avertissement à afficher, ou `null`.
	 *
	 * Un compte sans identité native fonctionne parfaitement — jusqu'au jour où
	 * la plateforme tierce change d'avis. Le dire au bon moment coûte une
	 * phrase ; le découvrir après coup coûte le compte.
	 */
	avertissement: string | null;
}

/** Décrit l'état des connexions d'un compte, pour la page « Compte ». */
export function etatCompte(liees: readonly ConnexionLiee[]): EtatCompte {
	const dejaLiees = new Set(liees.map((c) => c.type));
	const autonome = aIdentiteNative(liees);

	return {
		autonome,
		avertissement: autonome
			? null
			: "Ton compte dépend entièrement d'une plateforme extérieure. Ajoute une adresse e-mail pour pouvoir te connecter même si tu perds cet accès.",
		disponibles: CONNEXIONS.filter((id) => !dejaLiees.has(id)).map((id) => DESCRIPTIONS[id]),
		liees: [...liees],
	};
}
