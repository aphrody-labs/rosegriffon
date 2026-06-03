/** Types du flow IEVR headless unifié (@rose-griffon/iecode-pipeline). */

/** Instantané du build accumulé (pour détecter une mise à jour du jeu). */
export interface BuildSnapshot {
	appId: number;
	branch: string;
	/** buildid Steam de la branche au moment de l'accumulation. */
	buildId: number;
	/** Répertoire de données inagle utilisé. */
	dataPath?: string;
	/** Répertoire du corpus exporté. */
	corpusOut?: string;
	/** ISO 8601. */
	accumulatedAt: string;
}

/** Manifeste du corpus exporté (compte par domaine). */
export interface CorpusManifest {
	generatedAt: string;
	buildId?: number;
	/** Nombre d'entrées par domaine exporté. */
	counts: Record<string, number>;
	/** Total d'entrées tous domaines. */
	total: number;
	/** Domaines ignorés (données absentes) avec raison. */
	skipped: Record<string, string>;
}

/** Options d'export du corpus depuis inagle. */
export interface CorpusOptions {
	/** DATA_PATH inagle (défaut: env DATA_PATH puis défaut inagle). */
	dataPath?: string;
	/** Répertoire de sortie des JSON. */
	outDir: string;
	/** buildId à estamper dans le manifeste. */
	buildId?: number;
	/** Indente les JSON (défaut: false, plus compact). */
	pretty?: boolean;
	onLog?: (msg: string) => void;
}

/** Options de l'accumulation complète (acquire → parse → corpus, gardée par build). */
export interface AccumulateOptions {
	/** App ID (défaut IEVR 2799860). */
	appId?: number;
	branch?: string;
	/** Répertoire d'install/download Steam (défaut: <corpusOut>/.steam). */
	dumpOut?: string;
	/** DATA_PATH inagle (défaut: dumpOut, ou la donnée existante). */
	dataPath?: string;
	/** Répertoire du corpus exporté (requis). */
	corpusOut: string;
	/** Fichier d'instantané de build (défaut: <corpusOut>/.build-snapshot.json). */
	snapshotPath?: string;
	/** Force la ré-accumulation même si le build n'a pas changé. */
	force?: boolean;
	/** Ne pas (re)télécharger/extraire ; exporter le corpus depuis dataPath existant. */
	skipAcquire?: boolean;
	/** Identifiants Steam (sinon env STEAM_USER/PASSWORD/GUARD_CODE). */
	user?: string;
	password?: string;
	guardCode?: string;
	tokenStore?: string;
	/** Preset de dump (défaut inagle-azalee). */
	preset?: string;
	onLog?: (msg: string) => void;
}

/** Résultat d'une accumulation. */
export interface AccumulateResult {
	updated: boolean;
	appId: number;
	buildId: number;
	previousBuildId: number | null;
	corpus: CorpusManifest | null;
	corpusOut: string;
}
