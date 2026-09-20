/**
 * Recherche unifiée sur les trois domaines du réseau Rose Griffon.
 *
 * ── POURQUOI CE PAQUET EXISTE ───────────────────────────────────────────────
 * Le site portait quatre recherches qui s'ignoraient : la barre globale
 * (`/search`) ne lisait QUE la table `articles` du portail — trois résultats
 * maximum, aucun personnage du wiki, aucun clan Achilléa. Les autres barres
 * (wiki, dialogue de personnages, actualités) vivaient chacune dans son app,
 * avec sa requête et son format de résultat. Chercher « Axel » depuis l'accueil
 * ne trouvait rien alors que le wiki a la fiche.
 *
 * Une seule requête couvre désormais les trois domaines. C'est possible parce
 * que les données d'Achilléa sont lisibles depuis la base `rg` via le miroir
 * `postgres_fdw` (`scripts/ops/achillea-fdw.ts`) : sans lui, il faudrait trois
 * allers-retours et un tri en mémoire.
 *
 * ── MODULE PUR ──────────────────────────────────────────────────────────────
 * Aucune dépendance, aucune E/S : l'exécuteur SQL est INJECTÉ. Le paquet ne
 * connaît ni `pg`, ni Bun, ni Next — il construit une requête et met en forme
 * des lignes. C'est ce qui permet de le couvrir par `bun test` sans base, et de
 * l'appeler aussi bien depuis un Server Component que depuis une route.
 */

/** Domaines interrogeables, dans l'ordre de priorité d'affichage. */
export const DOMAINES_RECHERCHE = ["association", "wiki", "esport"] as const;

export type DomaineRecherche = (typeof DOMAINES_RECHERCHE)[number];

export type TypeResultat =
	| "article"
	| "personnage"
	| "technique"
	| "objet"
	| "clan"
	| "joueur"
	| "evenement";

export interface ResultatRecherche {
	id: string;
	titre: string;
	/** URL absolue dans le site unifié, déjà préfixée par le domaine. */
	href: string;
	type: TypeResultat;
	domaine: DomaineRecherche;
	/** Second niveau d'information (tag de clan, catégorie…). */
	detail?: string;
}

/** Une source = une table, sa colonne de libellé, et comment en faire une URL. */
interface Source {
	domaine: DomaineRecherche;
	type: TypeResultat;
	/** Expression SQL de la table, schéma compris. */
	table: string;
	/** Colonne portant le libellé cherché. */
	colonneTitre: string;
	/** Colonne servant à bâtir l'URL (souvent `slug`, parfois `id`). */
	colonneCle: string;
	/** Colonne facultative de détail. */
	colonneDetail?: string;
	/** Filtre SQL additionnel, sans le `AND` initial. */
	filtre?: string;
	/** Construit l'URL depuis la clé. */
	href: (cle: string, bases: BasesRecherche) => string;
}

/** Points de montage des domaines, pour préfixer les URL. */
export interface BasesRecherche {
	wiki: string;
	esport: string;
	association: string;
}

export const BASES_PAR_DEFAUT: BasesRecherche = {
	association: "",
	esport: "/achillea",
	wiki: "/wiki",
};

/**
 * Les sources interrogées.
 *
 * L'e-sport lit le schéma `achillea`, qui est un miroir en LECTURE de l'autre
 * base. Y ajouter une table impose de vérifier qu'elle est bien exposée par le
 * miroir : `bun packages/cron/src/index.ts --run sync:achillea` la réimporte.
 */
const SOURCES: readonly Source[] = [
	{
		colonneCle: "slug",
		colonneTitre: "title",
		domaine: "association",
		filtre: "status = 'published'",
		href: (cle) => `/news/${cle}`,
		table: "public.articles",
		type: "article",
	},
	{
		colonneCle: "slug",
		colonneTitre: "name_fr",
		domaine: "wiki",
		href: (cle, bases) => `${bases.wiki}/chara/${cle}`,
		table: "public.inagle_characters",
		type: "personnage",
	},
	{
		colonneCle: "id",
		colonneTitre: "name_fr",
		domaine: "wiki",
		href: (cle, bases) => `${bases.wiki}/skill/${cle}`,
		table: "public.inagle_skills",
		type: "technique",
	},
	{
		colonneCle: "id",
		colonneTitre: "name_fr",
		domaine: "wiki",
		href: (cle, bases) => `${bases.wiki}/item/${cle}`,
		table: "public.inagle_items",
		type: "objet",
	},
	{
		colonneCle: "id",
		colonneTitre: "name",
		domaine: "esport",
		href: (cle, bases) => `${bases.esport}/clans/${cle}`,
		table: "achillea.clan",
		type: "clan",
	},
	{
		colonneCle: "id",
		colonneDetail: "display_name",
		colonneTitre: "username",
		domaine: "esport",
		href: (cle, bases) => `${bases.esport}/users/${cle}`,
		table: 'achillea."user"',
		type: "joueur",
	},
	{
		colonneCle: "id",
		colonneDetail: "status",
		colonneTitre: "name",
		domaine: "esport",
		href: (cle, bases) => `${bases.esport}/tournaments/${cle}`,
		table: "achillea.event",
		type: "evenement",
	},
] as const;

/** Longueur minimale d'une requête. En deçà, `%a%` ramène la base entière. */
export const LONGUEUR_MINIMALE = 2;

export interface LigneBrute {
	id: string;
	titre: string;
	detail: string | null;
	source: string;
}

/**
 * Construit la requête d'union.
 *
 * UNE SEULE requête, pas sept : sept allers-retours coûteraient sept latences
 * réseau là où Postgres trie et limite en une passe. Chaque branche porte son
 * index de source, ce qui évite de deviner la provenance d'une ligne au retour.
 *
 * `$1` est le motif `ILIKE`, `$2` la limite par source. Les valeurs ne sont
 * jamais interpolées : seuls des noms de tables et de colonnes constants, issus
 * de `SOURCES`, entrent dans le texte.
 */
export function construireRequete(sources: readonly Source[] = SOURCES): string {
	const branches = sources.map((source, index) => {
		const detail = source.colonneDetail ? `${source.colonneDetail}::text` : "NULL::text";
		const filtre = source.filtre ? ` AND ${source.filtre}` : "";
		return `(SELECT ${source.colonneCle}::text AS id, ${source.colonneTitre}::text AS titre, ${detail} AS detail, ${index}::int AS source
			FROM ${source.table}
			WHERE ${source.colonneTitre} ILIKE $1${filtre}
			ORDER BY length(${source.colonneTitre}::text) ASC
			LIMIT $2)`;
	});

	return branches.join("\nUNION ALL\n");
}

/** Motif `ILIKE` échappé : `%` et `_` saisis par l'utilisateur sont littéraux. */
export function motifIlike(requete: string): string {
	return `%${requete.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** Met en forme une ligne brute. Rend `null` si la source est inconnue. */
export function formaterLigne(
	ligne: LigneBrute,
	bases: BasesRecherche,
	sources: readonly Source[] = SOURCES
): ResultatRecherche | null {
	const source = sources[Number(ligne.source)];
	if (!source) return null;

	return {
		domaine: source.domaine,
		href: source.href(ligne.id, bases),
		id: `${source.type}:${ligne.id}`,
		titre: ligne.titre,
		type: source.type,
		...(ligne.detail ? { detail: ligne.detail } : {}),
	};
}

/** Exécuteur SQL injecté : c'est l'appelant qui fournit sa connexion. */
export type ExecuteurSql = (sql: string, params: unknown[]) => Promise<LigneBrute[]>;

export interface OptionsRecherche {
	bases?: BasesRecherche;
	/** Résultats maximum PAR source. */
	limiteParSource?: number;
	/** Résultats maximum rendus, toutes sources confondues. */
	limiteTotale?: number;
}

/**
 * Cherche dans les trois domaines.
 *
 * Ne lève jamais : une source indisponible — typiquement le miroir Achilléa non
 * câblé sur une machine de développement — doit dégrader la recherche, pas
 * casser la page qui l'affiche.
 */
export async function rechercherPartout(
	executer: ExecuteurSql,
	requete: string,
	options: OptionsRecherche = {}
): Promise<ResultatRecherche[]> {
	const terme = requete.trim();
	if (terme.length < LONGUEUR_MINIMALE) return [];

	const bases = options.bases ?? BASES_PAR_DEFAUT;
	const limiteParSource = options.limiteParSource ?? 5;
	const limiteTotale = options.limiteTotale ?? 20;

	let lignes: LigneBrute[];
	try {
		lignes = await executer(construireRequete(), [motifIlike(terme), limiteParSource]);
	} catch (erreur) {
		console.error("[recherche] requête unifiée en échec :", erreur);
		return [];
	}

	const resultats = lignes
		.map((ligne) => formaterLigne(ligne, bases))
		.filter((r): r is ResultatRecherche => r !== null);

	// Tri d'affichage : par domaine (ordre du menu), puis titre le plus court —
	// une correspondance courte est presque toujours la plus pertinente
	// (« Axel » avant « Axel Blaze édition limitée »).
	const rang = new Map(DOMAINES_RECHERCHE.map((d, i) => [d, i]));
	resultats.sort((a, b) => {
		const parDomaine = (rang.get(a.domaine) ?? 9) - (rang.get(b.domaine) ?? 9);
		return parDomaine !== 0 ? parDomaine : a.titre.length - b.titre.length;
	});

	return resultats.slice(0, limiteTotale);
}

/** Regroupe par domaine, pour un rendu en sections. */
export function grouperParDomaine(
	resultats: ResultatRecherche[]
): { domaine: DomaineRecherche; resultats: ResultatRecherche[] }[] {
	return DOMAINES_RECHERCHE.map((domaine) => ({
		domaine,
		resultats: resultats.filter((r) => r.domaine === domaine),
	})).filter((groupe) => groupe.resultats.length > 0);
}
