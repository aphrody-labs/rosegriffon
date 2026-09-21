/**
 * Registre des applications du réseau Rose Griffon.
 *
 * ── POURQUOI CE PAQUET EXISTE ───────────────────────────────────────────────
 * `rosegriffon.fr` héberge trois applications qui ont fusionné : le portail de
 * l'association, le wiki Azalée et l'e-sport Achilléa. Rien ne les décrivait
 * ensemble. Chaque surface redécouvrait donc dans son coin, et en dur, la même
 * poignée de faits :
 *
 *   - la navigation, le préfixe de montage de chaque app ;
 *   - le routeur de thème, la classe à poser par domaine ;
 *   - la recherche, la base d'URL à préfixer par type de résultat ;
 *   - la page d'administration, l'API à sonder pour l'état de service ;
 *   - le script anti-scintillement, la liste des thèmes valides.
 *
 * Quatre copies de la même liste, c'est quatre occasions de diverger — et elles
 * avaient divergé : le sélecteur de thème en annonçait trois quand le catalogue
 * en déclarait cinq, et les trois barres de navigation ne reconnaissaient que
 * deux préfixes sur trois, de sorte qu'`/achillea` retombait sur les réglages
 * du wiki.
 *
 * Ce registre est la description unique. Les surfaces la LISENT ; aucune ne la
 * recopie.
 *
 * ── CE QU'IL N'EST PAS ──────────────────────────────────────────────────────
 * Ce n'est pas une couche d'abstraction au-dessus des apps, et surtout pas une
 * tentative de leur imposer une interface commune. Chaque app garde son système
 * de design, ses composants et ses données propres. On ne met en commun que ce
 * qui est VRAI pour les trois : où l'app est montée, comment on l'appelle,
 * quelle identité elle porte.
 *
 * ── MODULE PUR ──────────────────────────────────────────────────────────────
 * Aucune E/S, aucune dépendance. Importable depuis un composant serveur, un
 * îlot client, un script de déploiement ou un test.
 */

/** Identifiant stable d'une application. Sert de clé partout. */
export type IdApplication = "association" | "wiki" | "esport";

/** Ordre d'affichage : c'est celui du menu et du lanceur d'applications. */
export const ORDRE_APPLICATIONS = ["association", "wiki", "esport"] as const;

export interface ApplicationReseau {
	id: IdApplication;
	/** Nom affiché. */
	nom: string;
	/** Nom court, pour les surfaces contraintes (barre du bas, fil d'ariane). */
	nomCourt: string;
	/** Ce que l'app fait, en une phrase. Sert d'info-bulle et de description. */
	description: string;
	/**
	 * Préfixe de montage sur `rosegriffon.fr`.
	 *
	 * `""` pour l'app montée à la racine. Jamais de barre finale : la
	 * composition se fait par `cheminApplication()`, qui gère le cas de la
	 * racine — une chaîne vide n'est pas une URL valide pour un lien.
	 */
	base: string;
	/**
	 * Classe de thème appliquée à la zone de contenu de l'app.
	 *
	 * `undefined` = l'app suit le thème choisi par l'utilisateur. C'est le cas
	 * du portail, qui n'a pas d'identité chromatique propre à imposer.
	 */
	theme?: string;
	/** Image de marque servie depuis `public/`. Préférée à un pictogramme. */
	logo: string;
	/** Repli typographique quand le logo n'est pas rendu (liste dense). */
	icone: string;
	/**
	 * Origine de l'API de l'app.
	 *
	 * `""` = même origine que le site. Les deux autres sont sur des
	 * sous-domaines pour des raisons historiques : leur backend leur préexiste
	 * et n'a pas été déplacé par la fusion.
	 */
	api: string;
	/** Chemin de santé, relatif à `api`. */
	sante: string;
	/** Domaine d'origine, conservé et redirigé en 301 depuis la fusion. */
	domaineHistorique?: string;
}

export const APPLICATIONS: Readonly<Record<IdApplication, ApplicationReseau>> = Object.freeze({
	association: {
		api: "",
		base: "",
		description: "L'association Rose Griffon : actualités, événements, communauté et boutique.",
		icone: "diversity_3",
		id: "association",
		logo: "/RG_Logo_V2.5.webp",
		nom: "Rose Griffon",
		nomCourt: "Accueil",
		sante: "/api/health",
	},
	esport: {
		api: "https://ranked.rosegriffon.fr/api",
		base: "/achillea",
		description: "La scène compétitive : clans, mode classé, tournois et championnats.",
		domaineHistorique: "achillea.rosegriffon.fr",
		icone: "sports_esports",
		id: "esport",
		logo: "/achillea/logo1.svg",
		nom: "Achilléa",
		nomCourt: "E-sport",
		sante: "/health",
		theme: "theme-achillea",
	},
	wiki: {
		api: "https://api.rosegriffon.fr/azalee",
		base: "/wiki",
		description: "Le wiki Inazuma Eleven: Victory Road — personnages, techniques, objets.",
		domaineHistorique: "azalee.rosegriffon.fr",
		icone: "menu_book",
		id: "wiki",
		logo: "/RG_Azalee-logo.webp",
		nom: "Azalée",
		nomCourt: "Wiki",
		sante: "/health",
		theme: "theme-azalee-dark",
	},
});

/** Les applications, dans l'ordre d'affichage. */
export function listerApplications(): ApplicationReseau[] {
	return ORDRE_APPLICATIONS.map((id) => APPLICATIONS[id]);
}

/**
 * Compose un chemin interne à une application.
 *
 * Le piège, déjà rencontré dans la navigation : une base vide concaténée à `/`
 * donne `""`, qui n'est pas une URL valide et casse silencieusement le lien.
 */
export function cheminApplication(id: IdApplication, chemin = "/"): string {
	const base = APPLICATIONS[id].base.replace(/\/$/u, "");
	if (chemin === "/") return base || "/";
	return `${base}${chemin.startsWith("/") ? chemin : `/${chemin}`}`;
}

/**
 * À quelle application appartient une route ?
 *
 * Comparaison par SEGMENT, jamais par préfixe de chaîne : `/achilleaxyz` n'est
 * pas dans `/achillea`, et `/wikipedia` n'est pas dans `/wiki`. Les apps
 * préfixées sont testées d'abord ; celle montée à la racine récupère le reste,
 * elle ne peut pas être discriminée autrement.
 */
export function applicationDeLaRoute(pathname: string): ApplicationReseau {
	const prefixees = listerApplications().filter((app) => app.base !== "");
	for (const app of prefixees) {
		if (pathname === app.base || pathname.startsWith(`${app.base}/`)) return app;
	}
	return APPLICATIONS.association;
}

/** Classe de thème à poser sur la zone de contenu pour une route donnée. */
export function themeDeLaRoute(pathname: string): string | undefined {
	return applicationDeLaRoute(pathname).theme;
}

/** URL absolue de santé d'une application, pour les sondes et l'administration. */
export function urlSante(id: IdApplication): string {
	const app = APPLICATIONS[id];
	return `${app.api}${app.sante}`;
}

/**
 * Redirections des domaines historiques vers leur point de montage.
 *
 * Les trois sites ont chacun vécu sur leur domaine. Ils redirigent en 301 ;
 * cette table est la source de vérité de ces redirections, et sert aux tests
 * qui vérifient qu'aucune n'a été oubliée.
 */
export function redirectionsHistoriques(): { depuis: string; vers: string }[] {
	return listerApplications()
		.filter((app): app is ApplicationReseau & { domaineHistorique: string } =>
			Boolean(app.domaineHistorique)
		)
		.map((app) => ({
			depuis: `https://${app.domaineHistorique}`,
			vers: `https://rosegriffon.fr${app.base}`,
		}));
}
