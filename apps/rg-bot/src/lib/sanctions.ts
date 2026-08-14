/**
 * Historique de modération — le noyau, sans Discord ni base.
 *
 * ── LA BOUCLE QUI N'ÉTAIT PAS FERMÉE ───────────────────────────────────────
 * `/moderation moderation avertir` consigne chaque avertissement dans
 * `admin_audit_log`, avec ce commentaire dans le code : « c'est la trace qui
 * compte pour la suite (une récidive se juge sur l'historique) ».
 *
 * Sauf qu'aucune commande ne LISAIT cet historique. Le staff écrivait dans un
 * journal que personne ne pouvait consulter depuis Discord : pour savoir si un
 * membre en était à son premier ou à son cinquième avertissement, il fallait
 * ouvrir Postgres. Autant dire que la question ne se posait jamais, et que la
 * gradation des sanctions se faisait de mémoire.
 *
 * ── CE MODULE NE DÉCIDE PAS DE LA SANCTION ─────────────────────────────────
 * Il compte, il classe, il résume. Il ne propose PAS de sanction automatique :
 * « trois avertissements ⇒ exclusion » est une règle de communauté, pas une
 * règle de code, et l'écrire ici la rendrait invisible au staff qui l'applique.
 * Ce qu'on rend, c'est de quoi décider — le nombre, la fraîcheur, la nature.
 *
 * ── MODULE PUR ─────────────────────────────────────────────────────────────
 * Aucune E/S, aucun `discord.js`.
 */

/** Les actions de modération consignées, et ce qu'elles valent à la lecture. */
export const ACTIONS_MODERATION = [
	"discord.avertir",
	"discord.exclure",
	"discord.lever-exclusion",
	"discord.expulser",
	"discord.bannir",
	"discord.debannir",
] as const;

export type ActionModeration = (typeof ACTIONS_MODERATION)[number];

export function estActionModeration(valeur: unknown): valeur is ActionModeration {
	return typeof valeur === "string" && (ACTIONS_MODERATION as readonly string[]).includes(valeur);
}

interface Etiquette {
	libelle: string;
	icone: string;
	/**
	 * Poids dans le décompte de gravité. Les LEVÉES valent zéro : elles font
	 * partie de l'historique (le staff doit voir qu'une exclusion a été levée)
	 * mais elles ne sont pas des sanctions, et les compter gonflerait le score
	 * d'un membre qu'on a justement gracié.
	 */
	poids: number;
}

const ETIQUETTES: Readonly<Record<ActionModeration, Etiquette>> = Object.freeze({
	"discord.avertir": { icone: "⚠️", libelle: "Avertissement", poids: 1 },
	"discord.bannir": { icone: "⛔", libelle: "Bannissement", poids: 5 },
	"discord.debannir": { icone: "🔓", libelle: "Débannissement", poids: 0 },
	"discord.exclure": { icone: "🔇", libelle: "Exclusion temporaire", poids: 2 },
	"discord.expulser": { icone: "👢", libelle: "Expulsion", poids: 3 },
	"discord.lever-exclusion": { icone: "🔈", libelle: "Exclusion levée", poids: 0 },
});

export function libelleAction(action: string): string {
	return estActionModeration(action) ? ETIQUETTES[action].libelle : action;
}

export function iconeAction(action: string): string {
	return estActionModeration(action) ? ETIQUETTES[action].icone : "•";
}

export function poidsAction(action: string): number {
	return estActionModeration(action) ? ETIQUETTES[action].poids : 0;
}

// ─── Entrées ────────────────────────────────────────────────────────────────

export interface EntreeHistorique {
	action: string;
	/** Motif tel qu'il a été saisi par le staff, `null` s'il n'y en avait pas. */
	motif: string | null;
	/** Identifiant Discord du membre du staff qui a agi, `null` si inconnu. */
	parQui: string | null;
	le: Date;
}

export interface Resume {
	total: number;
	/** Somme des poids — une mesure de gravité, pas un compteur d'incidents. */
	gravite: number;
	/** Décompte par action, dans l'ordre de `ACTIONS_MODERATION`. */
	parAction: Array<{ action: ActionModeration; nombre: number }>;
	/** La plus récente, `null` si l'historique est vide. */
	derniere: EntreeHistorique | null;
	/** Nombre d'entrées des 90 derniers jours — ce qui pèse vraiment. */
	recentes: number;
}

/** Fenêtre au-delà de laquelle une sanction cesse d'être « récente ». */
export const JOURS_RECENTS = 90;

/**
 * Résume un historique.
 *
 * ── POURQUOI DEUX CHIFFRES ─────────────────────────────────────────────────
 * Le TOTAL dit ce qui s'est passé depuis toujours ; les RÉCENTES disent ce qui
 * pèse aujourd'hui. Un membre avec quatre avertissements dont trois datent de
 * deux ans n'est pas dans la même situation qu'un membre qui en a trois ce
 * mois-ci, et un seul compteur confond les deux.
 */
export function resumer(
	entrees: readonly EntreeHistorique[],
	maintenant: Date = new Date()
): Resume {
	const compteurs = new Map<ActionModeration, number>(
		ACTIONS_MODERATION.map((action) => [action, 0])
	);
	let gravite = 0;
	let recentes = 0;
	const limite = maintenant.getTime() - JOURS_RECENTS * 86_400_000;

	for (const entree of entrees) {
		if (estActionModeration(entree.action)) {
			compteurs.set(entree.action, (compteurs.get(entree.action) ?? 0) + 1);
		}
		gravite += poidsAction(entree.action);
		const instant = entree.le instanceof Date ? entree.le.getTime() : Number.NaN;
		if (Number.isFinite(instant) && instant >= limite) {
			recentes += 1;
		}
	}

	// `entrees` arrive triée du plus récent au plus ancien (c'est l'ordre de la
	// requête) ; on ne re-trie pas pour ne pas dépendre silencieusement de
	// l'appelant sur le seul point qui compte.
	const derniere =
		entrees.length === 0
			? null
			: entrees.reduce((plus, entree) => (entree.le > plus.le ? entree : plus));

	return {
		derniere,
		gravite,
		parAction: ACTIONS_MODERATION.map((action) => ({
			action,
			nombre: compteurs.get(action) ?? 0,
		})),
		recentes,
		total: entrees.length,
	};
}

/**
 * Phrase d'en-tête d'un historique.
 *
 * Elle dit l'état, pas un jugement : « dossier vierge » ou le décompte. Aucune
 * recommandation de sanction — c'est au staff de décider, et une phrase du bot
 * qui suggère « à bannir » serait lue comme un avis.
 */
export function libelleResume(resume: Resume): string {
	if (resume.total === 0) {
		return "Dossier vierge — aucune trace de modération.";
	}
	const morceaux = [
		`${resume.total} entrée${resume.total > 1 ? "s" : ""} au total`,
		resume.recentes > 0
			? `${resume.recentes} sur les ${JOURS_RECENTS} derniers jours`
			: `aucune depuis ${JOURS_RECENTS} jours`,
	];
	return morceaux.join(" · ");
}
