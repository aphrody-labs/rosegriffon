/**
 * Types du package @rose-griffon/iecode-steam-sync.
 */

/** Plateforme supportée d'après l'app Steam. */
export interface SteamPlatforms {
	windows: boolean;
	mac: boolean;
	linux: boolean;
}

/** Tarif d'une app (depuis l'API appdetails). */
export interface SteamPrice {
	currency: string;
	/** Prix initial en centimes. */
	initial: number;
	/** Prix final (après remise) en centimes. */
	final: number;
	/** Pourcentage de remise (0–100). */
	discountPercent: number;
	/** Prix final formaté (ex. "69,99€"). */
	formatted: string;
}

/**
 * Métadonnées structurées d'une app du Steam Store, agrégées par le scraper
 * (API appdetails + HTML de la page store, le tout récupéré via le package bxc).
 */
export interface SteamAppMetadata {
	appId: number;
	name: string;
	/** `game` | `dlc` | `demo` | `music` | … */
	type: string;
	isFree: boolean;
	comingSoon: boolean;
	releaseDate: string | null;
	developers: string[];
	publishers: string[];
	genres: string[];
	categories: string[];
	/** Tags communautaires scrappés du HTML (ordre = popularité). */
	tags: string[];
	platforms: SteamPlatforms;
	price: SteamPrice | null;
	shortDescription: string;
	headerImage: string | null;
	website: string | null;
	/** Note Metacritic (0–100) si disponible. */
	metacritic: number | null;
	/** Résumé des évaluations Steam (ex. "Very Positive"), scrappé du HTML. */
	reviewSummary: string | null;
	/** URL canonique de la page store. */
	storeUrl: string;
}

/** Options du scraper de store. */
export interface SteamScraperOptions {
	/** Langue Steam (défaut "english"). */
	language?: string;
	/** Pays/devise (défaut "us"). */
	countryCode?: string;
	/** Chemin d'un cookie jar (JSON array ou `{cookies:[…]}`) joint aux requêtes. */
	cookiesPath?: string;
	/** Bypass TLS (défaut true — pratique en VPS/proxy). */
	insecure?: boolean;
	/** Logger (défaut: silencieux). */
	onLog?: (msg: string) => void;
}

/** Options de la synchro complète (scrape + download + dump). */
export interface SteamSyncOptions {
	/** App ID Steam (défaut IEVR 2799860). */
	appId?: number;
	/** Répertoire d'install du download Steam (défaut: `<dumpOut>/.steam`). */
	installDir?: string;
	/** Répertoire de sortie du dump CPK. */
	dumpOut: string;
	/** Preset de dump (`inagle` | `azalee` | `inagle-azalee`, défaut `inagle-azalee`). */
	preset?: string;
	/** Compte Steam (défaut env STEAM_USER). */
	user?: string;
	/** Mot de passe (défaut env STEAM_PASSWORD). */
	password?: string;
	/** Code Steam Guard 2FA (défaut env STEAM_GUARD_CODE). */
	guardCode?: string;
	/** Branche (défaut "public"). */
	branch?: string;
	/** OS ciblé (défaut "windows"). */
	os?: string;
	/** Cache JSON des jetons (re-login sans 2FA). */
	tokenStore?: string;
	/** Scrappe et renvoie les métadonnées store (défaut true). */
	scrapeMetadata?: boolean;
	/** Saute le download (dump l'install existante). */
	skipDownload?: boolean;
	/** Saute le dump (download seulement). */
	skipDump?: boolean;
	/** Chemin du iecode.dll (défaut: build Release du monorepo). */
	cliDllPath?: string;
	/** Logger (défaut: console.info). */
	onLog?: (msg: string) => void;
}

/** Résultat d'une synchro complète. */
export interface SteamSyncResult {
	appId: number;
	metadata: SteamAppMetadata | null;
	downloaded: boolean;
	dumped: boolean;
	installDir: string;
	dumpOut: string;
}
