/**
 * Client de l'API Noctaly — la partie PURE, celle qui décide.
 *
 * ── POURQUOI CE MODULE EXISTE SÉPARÉMENT DU SCRIPT D'IMPORT ────────────────
 * L'import parcourt ~1 834 membres en réseau : impossible à tester en vrai, et
 * hors de question de le lancer « pour voir ». Tout ce qui peut se tromper sans
 * réseau vit donc ici — lecture d'une réponse, lecture d'un quota, calcul de
 * l'attente, décision d'écrire ou non — et se teste en une milliseconde. Le
 * script (`scripts/import-noctaly.ts`) ne garde que la boucle et les `fetch`.
 *
 * ── LE 429 COÛTE UNE HEURE, PAS UNE SECONDE ────────────────────────────────
 * C'est LA contrainte qui dicte tout le reste. La documentation de Noctaly
 * (resources/rate-limits) annonce 50 requêtes/seconde, mais surtout :
 * « Applications that abuse the API or get too many 429s may be blacklisted »,
 * et le `retryAfter` de l'exemple vaut **3600**. Un dépassement ne coûte pas
 * une pause, il coûte l'après-midi — et potentiellement l'accès.
 *
 * D'où trois choix délibérément timides :
 *   1. la cadence par défaut est à **1/5 du plafond documenté** (10 req/s) ;
 *   2. on s'arrête à `MARGE_QUOTA` requêtes de la limite au lieu d'aller la
 *      toucher, et on attend le `X-RateLimit-Reset-After` annoncé ;
 *   3. un 429 reçu malgré tout **interrompt l'import** au lieu de réessayer.
 *      Réessayer, c'est exactement le comportement qui fait blacklister ; et
 *      l'import est idempotent, donc reprendre plus tard ne coûte rien.
 *
 * ── AUCUNE E/S ICI ─────────────────────────────────────────────────────────
 * Pas de `fetch`, pas de `sql`, pas d'horloge implicite : `maintenant` est
 * toujours un paramètre. C'est ce qui rend le comportement de quota vérifiable.
 */

/** Base documentée de l'API (getting-started/quickstart). */
export const BASE_API_NOCTALY = "https://noctaly.com/api/v1";

/**
 * Plafond global annoncé par la documentation, toutes routes confondues.
 * Il n'est PAS la cadence qu'on utilise — voir `CADENCE_DEFAUT`.
 */
export const PLAFOND_DOCUMENTE = 50;

/**
 * Cadence retenue par défaut : 10 requêtes/seconde.
 *
 * 1 834 membres à 10 req/s font trois minutes. Aller à 50 les ferait en
 * trente-sept secondes — un gain de deux minutes et demie, contre le risque
 * d'une heure de blocage et d'une mise en liste noire. Le calcul est vite fait.
 */
export const CADENCE_DEFAUT = 10;

/**
 * Combien de requêtes on se garde en réserve avant de considérer le quota
 * épuisé. À 0 on tape la limite au coup suivant ; à 2 on a de la marge pour
 * une requête en vol dont l'en-tête n'est pas encore revenu.
 */
export const MARGE_QUOTA = 2;

/** Marge ajoutée à l'attente annoncée par l'API, en millisecondes. */
export const MARGE_ATTENTE_MS = 250;

/** Le profil de niveau d'un membre, tel que le rend `GET …/level-profile`. */
export interface ProfilNoctaly {
	/** Niveau atteint sur la courbe de Noctaly (jamais écrit tel quel chez nous). */
	niveau: number;
	/** XP à l'intérieur du niveau courant. */
	xp: number;
	/** XP encore nécessaire pour monter. */
	xpRestante: number;
	/** XP cumulée depuis le début — la SEULE valeur qu'on importe. */
	xpTotale: number;
	messages: number;
	minutesVocal: number;
	reactions: number;
}

/**
 * Ce qu'une réponse HTTP veut dire pour la boucle d'import.
 *
 * `absent` est un cas NORMAL et fréquent : un membre qui n'a jamais parlé
 * depuis l'activation de Noctaly (11/3/2026) n'a pas de profil. Le distinguer
 * d'une panne évite de compter 1 700 « erreurs » là où il n'y a que des
 * silences.
 */
export type Issue = "ok" | "absent" | "refuse" | "quota" | "panne";

export function classerReponse(statut: number): Issue {
	if (statut === 200) {
		return "ok";
	}
	if (statut === 404) {
		return "absent";
	}
	if (statut === 401 || statut === 403) {
		return "refuse";
	}
	if (statut === 429) {
		return "quota";
	}
	return "panne";
}

/** L'URL du profil de niveau d'un membre. */
export function urlProfilNiveau(guildId: string, discordId: string): string {
	return `${BASE_API_NOCTALY}/guilds/${guildId}/users/${discordId}/level-profile`;
}

/**
 * Lit le corps JSON d'un profil.
 *
 * Rend `null` plutôt que de lever : une réponse inattendue sur UN membre ne
 * doit pas faire tomber un import de 1 834 membres. Le membre est compté comme
 * illisible, la boucle continue.
 *
 * La validation est délibérément stricte sur `totalXp` (c'est la seule valeur
 * qu'on écrit) et tolérante sur le reste : Noctaly peut ajouter un champ, ou
 * en omettre un sur un profil neuf, sans que ça nous regarde.
 */
/** Un entier positif, ou zéro — pour les champs annexes qu'on n'écrit pas. */
function entier(valeur: unknown): number {
	return typeof valeur === "number" && Number.isFinite(valeur) && valeur >= 0 ? Math.floor(valeur) : 0;
}

export function lireProfil(brut: unknown): ProfilNoctaly | null {
	if (typeof brut !== "object" || brut === null) {
		return null;
	}
	const objet = brut as Record<string, unknown>;
	const xpTotale = objet.totalXp;
	if (typeof xpTotale !== "number" || !Number.isFinite(xpTotale) || xpTotale < 0) {
		return null;
	}
	return {
		messages: entier(objet.messages),
		minutesVocal: entier(objet.voiceMinutes),
		niveau: entier(objet.level),
		reactions: entier(objet.reactions),
		xp: entier(objet.xp),
		xpRestante: entier(objet.neededXp),
		xpTotale: Math.floor(xpTotale),
	};
}

/**
 * Le profil d'économie d'un membre (`GET …/eco-profile`).
 *
 * Par défaut l'API ne rend que `money` ; les trois relations optionnelles se
 * demandent en query (`?items=true&chests=true&dailyStreak=true`). On les
 * demande TOUTES : c'est la même requête, et ce qu'on ne demande pas est
 * perdu — un import ne se rejoue pas quand le bot tiers a été retiré.
 */
export interface ProfilEconomieNoctaly {
	monnaie: number;
	/** Série de récupérations quotidiennes, `null` si jamais réclamée. */
	serieQuotidienne: number | null;
	/** Nombre d'objets distincts détenus (le détail vit dans l'archive brute). */
	objets: number;
	/** Nombre de coffres distincts détenus. */
	coffres: number;
}

/** L'URL du profil d'économie, avec les trois relations optionnelles. */
export function urlProfilEconomie(guildId: string, discordId: string): string {
	return (
		`${BASE_API_NOCTALY}/guilds/${guildId}/users/${discordId}/eco-profile` +
		`?items=true&chests=true&dailyStreak=true`
	);
}

/** L'URL du catalogue d'objets de la guilde — une seule requête pour tout. */
export function urlObjetsGuilde(guildId: string): string {
	return `${BASE_API_NOCTALY}/guilds/${guildId}/items`;
}

/** L'URL du catalogue de coffres de la guilde. */
export function urlCoffresGuilde(guildId: string): string {
	return `${BASE_API_NOCTALY}/guilds/${guildId}/chests`;
}

/**
 * Lit un profil d'économie.
 *
 * `money` est le seul champ garanti par la documentation ; les trois autres
 * n'apparaissent que si la query les demande, et `dailyStreak` peut valoir
 * `null` (membre qui n'a jamais réclamé). Un profil à zéro reste un profil
 * valide — c'est `meriteEcritureEconomie` qui décide s'il vaut une ligne.
 */
export function lireProfilEconomie(brut: unknown): ProfilEconomieNoctaly | null {
	if (typeof brut !== "object" || brut === null) {
		return null;
	}
	const objet = brut as Record<string, unknown>;
	const monnaie = objet.money;
	if (typeof monnaie !== "number" || !Number.isFinite(monnaie)) {
		return null;
	}
	const serie = objet.dailyStreak;
	return {
		coffres: Array.isArray(objet.chests) ? objet.chests.length : 0,
		monnaie: Math.max(0, Math.floor(monnaie)),
		objets: Array.isArray(objet.items) ? objet.items.length : 0,
		serieQuotidienne:
			typeof serie === "object" && serie !== null
				? entier((serie as Record<string, unknown>).streak ?? (serie as Record<string, unknown>).count)
				: null,
	};
}

/**
 * Convertit une monnaie Noctaly en jetons Kizuna.
 *
 * ── POURQUOI UN TAUX EXPLICITE, ET PAS UN 1:1 IMPLICITE ────────────────────
 * Les deux monnaies n'ont RIEN en commun : un jeton Kizuna se gagne à 25/jour
 * (+5 par jour de série, plafonné à +50) et un recrutement en coûte 150 ; la
 * monnaie Noctaly suit une configuration de serveur qu'on ne connaît pas avant
 * de l'avoir lue. Reporter un solde 1:1 sans regarder, c'est risquer d'offrir
 * cent recrutements à quelqu'un — ou trois.
 *
 * Le taux est donc un paramètre, le défaut est 1, et l'import se lance
 * d'abord en `--essai` pour voir la distribution réelle avant d'écrire.
 */
export function convertirMonnaie(monnaie: number, taux: number): number {
	if (!Number.isFinite(monnaie) || monnaie <= 0 || !Number.isFinite(taux) || taux <= 0) {
		return 0;
	}
	return Math.floor(monnaie * taux);
}

/** Un profil d'économie vaut une écriture s'il porte quelque chose. */
export function meriteEcritureEconomie(profil: ProfilEconomieNoctaly): boolean {
	return profil.monnaie > 0 || (profil.serieQuotidienne ?? 0) > 0;
}

/**
 * Résume une distribution de soldes, pour décider du taux en connaissance de
 * cause. La médiane compte plus que la moyenne : un seul gros solde tire la
 * moyenne, pas la médiane.
 */
export function distribution(valeurs: readonly number[]): {
	compte: number;
	total: number;
	median: number;
	maximum: number;
} {
	const triees = valeurs.filter((valeur) => valeur > 0).toSorted((a, b) => a - b);
	if (triees.length === 0) {
		return { compte: 0, maximum: 0, median: 0, total: 0 };
	}
	const milieu = Math.floor(triees.length / 2);
	const median =
		triees.length % 2 === 0
			? Math.floor(((triees[milieu - 1] ?? 0) + (triees[milieu] ?? 0)) / 2)
			: (triees[milieu] ?? 0);
	return {
		compte: triees.length,
		maximum: triees.at(-1) ?? 0,
		median,
		total: triees.reduce((somme, valeur) => somme + valeur, 0),
	};
}

/** L'état du quota tel qu'annoncé par les en-têtes de la dernière réponse. */
export interface Quota {
	limite: number | null;
	restant: number | null;
	/** Secondes avant remise à zéro, d'après `X-RateLimit-Reset-After`. */
	dansSecondes: number | null;
}

/** Une source d'en-têtes — `Headers` en vrai, un objet simple dans les tests. */
export interface SourceEnTetes {
	get(nom: string): string | null;
}

export function lireQuota(entetes: SourceEnTetes): Quota {
	const nombre = (nom: string): number | null => {
		const brut = entetes.get(nom);
		if (brut === null || brut.trim() === "") {
			return null;
		}
		const valeur = Number(brut);
		return Number.isFinite(valeur) ? valeur : null;
	};
	return {
		dansSecondes: nombre("X-RateLimit-Reset-After"),
		limite: nombre("X-RateLimit-Limit"),
		restant: nombre("X-RateLimit-Remaining"),
	};
}

/**
 * Combien de millisecondes attendre avant la requête suivante.
 *
 * Deux régimes, et le second l'emporte :
 *   - régime normal : l'intervalle de la cadence choisie ;
 *   - quota au plancher : l'attente annoncée par l'API, plus une marge.
 *
 * On prend le MAXIMUM des deux et non le premier venu : si l'API dit d'attendre
 * 40 s alors que la cadence dirait 100 ms, c'est l'API qui a raison.
 */
export function attenteAvantSuivante(quota: Quota, cadence: number = CADENCE_DEFAUT): number {
	const parCadence = Math.ceil(1_000 / Math.max(1, Math.min(PLAFOND_DOCUMENTE, cadence)));
	if (quota.restant !== null && quota.restant <= MARGE_QUOTA && quota.dansSecondes !== null) {
		return Math.max(parCadence, Math.ceil(quota.dansSecondes * 1_000) + MARGE_ATTENTE_MS);
	}
	return parCadence;
}

/**
 * Faut-il écrire une ligne pour ce profil ?
 *
 * Non si l'XP totale est nulle : un membre qui n'a jamais rien gagné chez
 * Noctaly n'a rien à importer, et créer sa ligne à zéro ne ferait qu'ajouter
 * 1 500 lignes vides au classement. Le profil se créera tout seul à son premier
 * message chez nous (`ajouterExperience`), avec la bonne date.
 */
export function meriteEcriture(profil: ProfilNoctaly): boolean {
	return profil.xpTotale > 0;
}

/** Le décompte d'un import, tel qu'on le rend à la fin. */
export interface Bilan {
	interroges: number;
	ecrits: number;
	vides: number;
	absents: number;
	illisibles: number;
	pannes: number;
	/** Profils d'économie porteurs de quelque chose (monnaie ou série). */
	economies: number;
	/** Lignes d'archive brute écrites — une par membre ayant répondu. */
	archives: number;
}

export function bilanVide(): Bilan {
	return {
		absents: 0,
		archives: 0,
		economies: 0,
		ecrits: 0,
		illisibles: 0,
		interroges: 0,
		pannes: 0,
		vides: 0,
	};
}

/**
 * Le message de fin, en une phrase lisible.
 *
 * Rendu par une fonction pure plutôt qu'assemblé dans le script : c'est le
 * seul résultat que l'opérateur va lire, et il doit rester juste même quand
 * une catégorie est à zéro.
 */
export function resumerBilan(bilan: Bilan): string {
	const morceaux = [
		`${bilan.interroges} membre(s) interrogé(s)`,
		`${bilan.ecrits} profil(s) importé(s)`,
		`${bilan.vides} sans XP`,
		`${bilan.absents} inconnu(s) de Noctaly`,
	];
	if (bilan.economies > 0) {
		morceaux.push(`${bilan.economies} économie(s)`);
	}
	if (bilan.archives > 0) {
		morceaux.push(`${bilan.archives} archive(s) brute(s)`);
	}
	if (bilan.illisibles > 0) {
		morceaux.push(`${bilan.illisibles} réponse(s) illisible(s)`);
	}
	if (bilan.pannes > 0) {
		morceaux.push(`${bilan.pannes} erreur(s) réseau`);
	}
	return morceaux.join(" · ");
}

/**
 * Le message d'aide quand la clé manque.
 *
 * Une clé Noctaly est liée à UN serveur et il n'y en a qu'une : elle
 * s'obtient par une connexion humaine au tableau de bord, cet agent ne peut
 * pas la générer. Autant dire précisément où cliquer plutôt que « clé
 * manquante ».
 */
export const AIDE_CLE_MANQUANTE = [
	"NOCTALY_API_KEY manquante.",
	"  1. https://noctaly.com/dashboard?next=/settings (compte avec « Gérer le serveur »)",
	"  2. sélectionner Rose Griffon → Paramètres → menu Développeurs → « Create API Key »",
	"  3. poser la valeur dans apps/bot/.env :  NOCTALY_API_KEY=…",
	"La clé est liée à ce seul serveur, et un serveur n'en a qu'une.",
].join("\n");
