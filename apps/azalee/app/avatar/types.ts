/**
 * Forme du catalogue d'avatar servi par `nie-model-serve` sur `/avatar/catalog.json`.
 *
 * Ces types décrivent exactement ce que `niers avatar export` écrit — ils ne réorganisent rien.
 * Les champs `Hash` sont des CRC-32 en hexadécimal sans préfixe (`"06DE46FB"`), tels que le jeu
 * les porte dans ses `cfg.bin`.
 */

/** Une part sélectionnable : une coupe de cheveux, un œil, une bouche… */
export type Part = {
	/** CRC-32 de la part, référencé par les recettes de presets. */
	id: string;
	/** Rang dans la catégorie. */
	itemNo: number;
	/** Rang d'affichage dans la grille de l'éditeur. */
	viewNo: number;
	/** Restriction de genre (`0` = tous). */
	gender: number;
	/** Nom du modèle principal en clair (`hairF001`), vide si le jeu ne le fournit pas. */
	resource: string;
	resourceHash: string;
	/** Nom du modèle secondaire (cheveux arrière, teinte) quand il existe. */
	resource2: string | null;
	/** Chemins VFS réels du modèle / de la texture. */
	modeles: string[];
	modeles2: string[];
	/**
	 * Nom de l'icône de vignette (`icon_ava_face05_001`), `null` si le hash n'a pas été résolu.
	 * À servir par `/avatar/icon/<nom>.png`.
	 */
	icone: string | null;
	iconeHash: string;
	/** Centre `(u, v, w, h)` de la part dans l'atlas de visage, quand le jeu en déclare un. */
	atlasCentre: number[] | null;
	/** Mode de translation par défaut (entier), séparé de ses composantes. */
	poseTransMode: number | null;
	poseTrans: number[] | null;
	poseScale: number[] | null;
	resource2Connu: boolean;
};

/** Une catégorie de parts, avec sa palette de couleurs. */
export type Categorie = {
	/** Identifiant de la catégorie côté jeu. */
	faceSettingType: number;
	/** Préfixe commun des noms de ressources — dérivé des fichiers, pas rédigé. */
	prefixe: string;
	parts: Part[];
	/** CRC-32 des couleurs de la palette associée. */
	couleurs: string[];
};

/** Une ligne de recette : « pour cet emplacement, cette valeur / cette part / cette couleur ». */
export type LigneRecette = {
	emplacement: number;
	valeur: number;
	couleur: number;
	part: string | null;
};

/** Un visage prédéfini et sa recette complète. */
export type Preset = {
	presetID: string;
	nom: string | null;
	/** Morphologies auxquelles le preset s'applique. */
	morphologies: string[];
	recette: LigneRecette[];
};

/** Un emplacement du code de partage. */
export type Emplacement = {
	emplacement: number;
	/** Largeur en bits dans le code. */
	bits: number;
	/** Nombre de valeurs distinctes codables. */
	valeurs: number;
	categorie: number;
	param: number;
	paramSub: number;
};

/** Un curseur de morphing. */
export type Curseur = {
	part: string;
	/** Axe de la déformation. */
	axe: number;
	defaut: number;
	min: number;
	max: number;
	morphologies: string[];
};

/** Le catalogue complet. */
export type Catalogue = {
	source: string;
	codePartage: {
		bits: number;
		alphabet: string[];
		emplacements: Emplacement[];
	};
	/**
	 * Les rubriques de l'éditeur dans l'ordre où le jeu les affiche, extraites de la suite
	 * contiguë de hachages de libellés du script `chara_edit_list_menu`.
	 *
	 * L'ordre et les libellés sont établis ; l'association d'une rubrique à une catégorie
	 * technique (`faceSettingType`) ne l'est pas — elle se fait dans le code du menu.
	 */
	rubriques: { hash: string; libelle: string }[];
	categories: Categorie[];
	presets: Preset[];
	avatarsFichiers: {
		nom: string;
		viewNo: number;
		charaId: string;
		modeles: string[];
		libelle: string | null;
	}[];
	voix: { banque: string; genre: number; personnalite: number; ton: number; itemNo: number }[];
	/** Personnalités — `libelle` vient de `menu_text`, la table de texte du jeu. */
	personnalites: { type: number; presentation: number; texte: string; libelle: string | null }[];
	tenues: { id: number; hash: string; morphologies: number[] }[];
	curseurs: { partsType: number; params: Curseur[] }[];
	modelesDeBase: {
		morphologies: string[];
		visages: { noseType: string; resources: string[] }[];
		accessoires: { presetID: string; resources: string[] }[];
	};
};
