/**
 * Niveaux de communauté — la courbe RÉELLE d'Inazuma Eleven Victory Road.
 *
 * ── POURQUOI LA COURBE DU JEU, ET PAS UNE FORMULE MAISON ───────────────────
 * Tous les bots de niveaux du marché utilisent la même parabole (`5·n² + 50n`,
 * héritée de MEE6). Elle marche, et elle ne veut rien dire : elle n'appartient
 * à personne et ne raconte rien du serveur qui l'utilise.
 *
 * Ce serveur parle d'un jeu qui a SA propre table d'expérience — 100 paliers,
 * extraits des données du jeu et présents en base (`inagle_exp_table`, colonnes
 * `level` et `need_exp`). C'est elle qui est reprise ici, valeur pour valeur.
 * Conséquence directe et voulue : monter de niveau sur le Discord coûte
 * exactement ce que ça coûte en jeu, et le niveau 99 reste un exploit.
 *
 *   niveau 10 →      2 422 XP  ≈    121 messages
 *   niveau 20 →     12 291 XP  ≈    615 messages
 *   niveau 30 →     38 310 XP  ≈  1 916 messages
 *   niveau 50 →    195 502 XP  ≈  9 776 messages
 *   niveau 99 →  2 878 742 XP  ≈ 143 938 messages
 *
 * (à 20 XP par message et un message éligible par minute — les valeurs par
 * défaut ci-dessous.)
 *
 * ── POURQUOI LA TABLE EST RECOPIÉE ICI ─────────────────────────────────────
 * Elle vit aussi en base, mais ce module doit rester PUR : aucune E/S, aucun
 * import de `discord.js`, aucune connexion. C'est ce qui permet de le couvrir
 * intégralement par `bun:test` sans base ni bot allumé — et la courbe d'un jeu
 * sorti ne bouge plus. Le test de ce fichier fixe la valeur totale et trois
 * points de contrôle relevés en base le 14/8/2026 : une recopie fautive ne
 * passerait pas.
 *
 * Requête d'origine :
 *   select string_agg(need_exp::text, ',' order by level) from inagle_exp_table;
 */

/**
 * XP nécessaire pour passer du niveau `n` au niveau `n + 1`, `n` allant de 1 à
 * 100. L'index 0 porte donc le palier du niveau 1.
 *
 * Le centième palier (124 072) n'est jamais consommé : le niveau 100 est le
 * plafond, il n'y a pas de niveau 101. Il est conservé pour que la table reste
 * la copie exacte de `inagle_exp_table`, et pour que sa recopie soit
 * vérifiable ligne à ligne.
 */
export const PALIERS_EXPERIENCE: readonly number[] = Object.freeze([
	124, 130, 146, 165, 196, 230, 275, 323, 384, 449, 524, 603, 693, 789, 896, 1009, 1132, 1263, 1407,
	1553, 1715, 1883, 2065, 2252, 2454, 2664, 2887, 3117, 3363, 3619, 3888, 4166, 4459, 4763, 5081,
	5410, 5796, 6223, 6675, 7148, 7649, 8173, 8728, 9305, 9917, 10555, 11228, 11927, 12666, 13435,
	14242, 15082, 15966, 16884, 17846, 18844, 19891, 20976, 22115, 23290, 24522, 25800, 27133, 28510,
	29949, 31438, 32990, 34591, 36258, 37984, 39780, 41631, 43555, 45543, 47605, 49731, 51938, 54216,
	56574, 59004, 61521, 64113, 66797, 69555, 72412, 75352, 78391, 81511, 84740, 88058, 91479, 94994,
	98626, 102355, 106196, 110138, 114202, 118371, 120541, 124072,
]);

/** Plafond, celui du jeu. */
export const NIVEAU_MAX = 100;

/**
 * XP cumulée nécessaire pour ATTEINDRE chaque niveau. `CUMULS[1] === 0` : le
 * niveau 1 est le point de départ, il ne se gagne pas.
 *
 * Calculé une fois à l'import plutôt qu'à chaque appel : `niveauPour` est
 * appelé sur chaque message du serveur.
 */
export const CUMULS: readonly number[] = (() => {
	const cumuls: number[] = Array.from({ length: NIVEAU_MAX + 1 }, () => 0);
	for (let niveau = 2; niveau <= NIVEAU_MAX; niveau++) {
		cumuls[niveau] = (cumuls[niveau - 1] as number) + (PALIERS_EXPERIENCE[niveau - 2] as number);
	}
	return Object.freeze(cumuls);
})();

/** XP totale à accumuler pour toucher le plafond. */
export const XP_NIVEAU_MAX = CUMULS[NIVEAU_MAX] as number;

/**
 * XP cumulée à posséder pour être de ce niveau. Hors bornes, on borne plutôt que
 * de lever : un niveau vient parfois d'une colonne, et un `NaN` ne doit pas
 * remonter jusqu'à un affichage.
 */
export function xpPourAtteindre(niveau: number): number {
	if (!Number.isFinite(niveau) || niveau <= 1) {
		return 0;
	}
	return CUMULS[Math.min(NIVEAU_MAX, Math.floor(niveau))] as number;
}

/**
 * Niveau correspondant à une XP cumulée.
 *
 * Recherche dichotomique : 100 paliers ne justifient pas une boucle linéaire sur
 * un chemin appelé à chaque message de deux mille membres.
 */
export function niveauPour(xp: number): number {
	if (!Number.isFinite(xp) || xp <= 0) {
		return 1;
	}
	if (xp >= XP_NIVEAU_MAX) {
		return NIVEAU_MAX;
	}
	let bas = 1;
	let haut = NIVEAU_MAX;
	while (bas < haut) {
		const milieu = Math.ceil((bas + haut) / 2);
		if ((CUMULS[milieu] as number) <= xp) {
			bas = milieu;
		} else {
			haut = milieu - 1;
		}
	}
	return bas;
}

/** Tout ce qu'une carte de profil a besoin de savoir sur une XP. */
export interface Progression {
	niveau: number;
	xp: number;
	/** XP acquise DANS le niveau courant. */
	xpDansNiveau: number;
	/** XP que coûte le passage au niveau suivant, `0` au plafond. */
	xpDuNiveau: number;
	/** Ce qu'il reste à gagner pour monter, `0` au plafond. */
	restant: number;
	/** Avancement dans le niveau, de 0 à 1. Vaut 1 au plafond. */
	ratio: number;
	/** Vrai quand le plafond du jeu est atteint. */
	auMaximum: boolean;
}

/** Décompose une XP cumulée pour l'affichage. */
export function progression(xp: number): Progression {
	const total = Number.isFinite(xp) && xp > 0 ? Math.floor(xp) : 0;
	const niveau = niveauPour(total);
	if (niveau >= NIVEAU_MAX) {
		return {
			auMaximum: true,
			niveau: NIVEAU_MAX,
			ratio: 1,
			restant: 0,
			xp: total,
			xpDansNiveau: 0,
			xpDuNiveau: 0,
		};
	}
	const base = CUMULS[niveau] as number;
	const xpDuNiveau = PALIERS_EXPERIENCE[niveau - 1] as number;
	const xpDansNiveau = total - base;
	return {
		auMaximum: false,
		niveau,
		ratio: xpDuNiveau === 0 ? 0 : xpDansNiveau / xpDuNiveau,
		restant: xpDuNiveau - xpDansNiveau,
		xp: total,
		xpDansNiveau,
		xpDuNiveau,
	};
}

/**
 * Niveaux FRANCHIS entre deux XP cumulées, dans l'ordre.
 *
 * Rend une liste et non un booléen : un gain exceptionnel (un don d'XP, une
 * correction) peut franchir plusieurs paliers d'un coup, et chacun peut porter
 * sa propre récompense de rôle. N'annoncer que le dernier ferait sauter les
 * rôles intermédiaires en silence.
 */
export function niveauxFranchis(xpAvant: number, xpApres: number): number[] {
	const depart = niveauPour(xpAvant);
	const arrivee = niveauPour(xpApres);
	if (arrivee <= depart) {
		return [];
	}
	const franchis: number[] = [];
	for (let niveau = depart + 1; niveau <= arrivee; niveau++) {
		franchis.push(niveau);
	}
	return franchis;
}

// ─── Rangs ──────────────────────────────────────────────────────────────────

/**
 * L'échelle de rareté du jeu, telle qu'elle est écrite dans les données
 * françaises (`inagle_characters.rarity_label`, relevé le 14/8/2026 :
 * Normal 5 805 · Expérimenté 150 · Héros 122 · BASARA 71).
 *
 * On ne réinvente donc pas un vocabulaire (« Bronze », « Diamant »…) : le membre
 * lit sur sa carte le même mot que sur les fiches du wiki, et la rareté d'un
 * rang correspond à la rareté réelle de la catégorie dans le jeu.
 */
export interface Rang {
	/** Libellé exact des données FR du jeu. */
	nom: string;
	/** Premier niveau du rang. */
	depuis: number;
	/** Rôle de couleur à demander au thème (`lib/canvas/theme.ts`). */
	teinte: "texteAttenue" | "azalee" | "brique" | "or";
}

export const RANGS: readonly Rang[] = Object.freeze([
	{ depuis: 1, nom: "Normal", teinte: "texteAttenue" },
	{ depuis: 20, nom: "Expérimenté", teinte: "azalee" },
	{ depuis: 50, nom: "Héros", teinte: "brique" },
	{ depuis: 80, nom: "BASARA", teinte: "or" },
]);

/** Rang d'un niveau. Toujours défini : le premier rang commence au niveau 1. */
export function rangDe(niveau: number): Rang {
	const borne = Number.isFinite(niveau) ? niveau : 1;
	let trouve = RANGS[0] as Rang;
	for (const rang of RANGS) {
		if (borne >= rang.depuis) {
			trouve = rang;
		}
	}
	return trouve;
}

/** Niveau du prochain rang, `null` quand le dernier est atteint. */
export function prochainRang(niveau: number): Rang | null {
	return RANGS.find((rang) => rang.depuis > niveau) ?? null;
}

// ─── Gain d'expérience ──────────────────────────────────────────────────────

/**
 * Réglages du gain, valeurs par défaut.
 *
 * Le DÉLAI est ce qui fait la différence entre un système de niveaux et un
 * concours de spam : sans lui, quinze messages d'un mot rapportent quinze fois
 * plus qu'un vrai échange. Une minute est la valeur de fait du domaine, et elle
 * a le mérite d'être invisible pour qui discute normalement.
 *
 * Les valeurs viennent de `@rosegriffon/types/bot` : ce sont les MÊMES que
 * celles du schéma des réglages, et le formulaire du site les affiche comme
 * « valeur par défaut ». Les redéclarer ici les ferait diverger le jour où l'un
 * des deux bouge — et personne ne verrait qu'un serveur gagne 15–25 XP quand
 * l'interface promet autre chose.
 */
// Réexporté sous son nom court : le reste du module (et le bot) le connaît
// comme `GAIN_DEFAUT`, alors que le contrat des réglages le nomme `GAIN_XP_DEFAUT`.
import { GAIN_XP_DEFAUT as GAIN_DEFAUT } from "./bot";

export { GAIN_DEFAUT };

export interface ReglesGain {
	minimum: number;
	maximum: number;
	delaiSecondes: number;
}

/**
 * XP d'un message, tirée dans la fourchette.
 *
 * Le hasard est INJECTÉ : c'est ce qui rend la fonction testable (un tirage figé
 * donne toujours la même valeur) et ce qui évite un `Math.random()` planqué au
 * milieu d'un module par ailleurs pur.
 */
export function gainDeMessage(regles: ReglesGain = GAIN_DEFAUT, tirage: number = Math.random()): number {
	const bas = Math.max(0, Math.floor(regles.minimum));
	const haut = Math.max(bas, Math.floor(regles.maximum));
	const borne = Number.isFinite(tirage) ? Math.min(0.999_999, Math.max(0, tirage)) : 0;
	return bas + Math.floor(borne * (haut - bas + 1));
}

/**
 * Le message rapporte-t-il, ou tombe-t-il dans le délai anti-spam ?
 *
 * Un `dernier` absent (premier message du membre) rapporte toujours : sans ça,
 * l'arrivée d'un nouveau membre serait la seule occasion où le système ne
 * compte pas.
 */
export function messageEligible(
	dernier: Date | string | number | null | undefined,
	maintenant: Date = new Date(),
	delaiSecondes: number = GAIN_DEFAUT.delaiSecondes
): boolean {
	if (dernier === null || dernier === undefined || dernier === "") {
		return true;
	}
	const instant = dernier instanceof Date ? dernier : new Date(dernier);
	const ms = instant.getTime();
	if (Number.isNaN(ms)) {
		return true;
	}
	return maintenant.getTime() - ms >= Math.max(0, delaiSecondes) * 1_000;
}

/**
 * Cette montée mérite-t-elle une annonce publique ?
 *
 * ── POURQUOI FILTRER ───────────────────────────────────────────────────────
 * En début de courbe, un membre actif monte tous les deux ou trois jours (le
 * niveau 10 coûte 2 422 XP, soit ~121 messages). Multiplié par les membres
 * actifs d'un serveur de deux mille, l'annonce à chaque niveau rend le salon
 * illisible en une semaine — et c'est toujours la même chose qui se passe
 * ensuite : le staff coupe le bot.
 *
 * On n'annonce donc que ce qui se fête : les paliers ronds, et les trois
 * changements de rang d'une vie de membre. Le reste se lit sur `/profil`, à la
 * demande de l'intéressé.
 */
export function meriteAnnonce(
	niveauAvant: number,
	niveauApres: number,
	options: { palier?: number; annoncerRang?: boolean } = {}
): boolean {
	if (niveauApres <= niveauAvant) {
		return false;
	}
	if (options.annoncerRang !== false && rangDe(niveauApres).nom !== rangDe(niveauAvant).nom) {
		return true;
	}
	const palier = Math.max(1, Math.floor(options.palier ?? 5));
	if (palier === 1) {
		return true;
	}
	// Un gain exceptionnel peut franchir plusieurs niveaux d'un coup : on annonce
	// dès qu'un palier a été TRAVERSÉ, pas seulement atterri dessus.
	return Math.floor(niveauApres / palier) > Math.floor(niveauAvant / palier);
}

/**
 * Jetons Kizuna offerts pour une montée de niveau.
 *
 * Croissants avec le niveau : franchir le niveau 50 doit rapporter plus que
 * franchir le niveau 2, sans quoi la seule stratégie rentable serait de rester
 * en bas de l'échelle.
 */
export function jetonsDeMontee(
	niveau: number,
	parNiveau: number = GAIN_DEFAUT.jetonsParNiveau
): number {
	const borne = Number.isFinite(niveau) ? Math.max(1, Math.floor(niveau)) : 1;
	return borne * Math.max(0, Math.floor(parNiveau));
}
