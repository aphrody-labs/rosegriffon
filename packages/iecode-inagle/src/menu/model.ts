/**
 * Modèle objet des fichiers .objbin IEVR (OBJB — arbre d'objets-menu).
 * Port exact du ObjbParser.cs C# (IECODE.Core.Formats.Menu).
 *
 * Chaque .objbin décrit un objet de menu avec :
 *   - ses références assets (g4pkm, g4tx)
 *   - ses composants RTTI (RenderComponent, AnimationComponent, TextComponent…)
 * Les valeurs numériques d'identifiants sont des hash CRC-32 de noms.
 */

// ── Objet principal ───────────────────────────────────────────────────────────

/** Objet de menu parsé depuis un fichier .objbin. */
export interface MenuObject {
	/** Nom de l'objet (paramètre de OBJ_BGN, ex. "title00_09_version"). */
	readonly name: string;
	/** Type moteur (SETUP_BGN, toujours "gmdMenuObj" dans IEVR). */
	readonly engineType: string;
	/** Référence au paquet d'animation 3D (.g4pkm) — chemin logique relatif. */
	readonly g4pkmPath: string | null;
	/** Chemin logique normalisé de la texture principale (.g4tx, "<LG>" pour la locale). */
	readonly g4txPath: string | null;
	/** Composants attachés à l'objet. */
	readonly components: readonly MenuComponent[];
}

// ── Composants ───────────────────────────────────────────────────────────────

/** Discriminant de composant (union type tag). */
export type MenuComponentKind =
	| "render"
	| "animation"
	| "text"
	| "primitive"
	| "attachLocator"
	| "collision"
	| "soundCmd"
	| "meshVisible"
	| "unknown";

/** Base commune de tous les composants. */
export interface MenuComponentBase {
	readonly kind: MenuComponentKind;
	/** Nom RTTI du composant (ex. "CMenuRenderComponent"). */
	readonly typeName: string;
}

/**
 * CMenuRenderComponent — rendu (z-order, mode de dessin, caméra).
 * m_cameraName est un hash CRC-32 du nom de caméra.
 */
export interface RenderComponent extends MenuComponentBase {
	readonly kind: "render";
	/** Priorité de dessin (z-order croissant = au-dessus). */
	readonly drawPriority: number;
	/** Mode de dessin (0=normal, 1=additif, 4=…). */
	readonly drawType: number;
	/** CRC-32 du nom de caméra (ex. 0x02D8FB06 pour la caméra "menu"). */
	readonly cameraNameHash: number;
}

/**
 * CMenuAnimation — animations d'ouverture/fermeture.
 * Les hashes sont des CRC-32 de noms de motions.
 */
export interface AnimationComponent extends MenuComponentBase {
	readonly kind: "animation";
	/** Hash CRC-32 du nom de motion d'ouverture (m_nameMotOpen). */
	readonly motOpenHash: number;
	/** Hash CRC-32 du nom de motion de fermeture, 0 si absent. */
	readonly motCloseHash: number;
	/** Hash CRC-32 du nom de motion de sélection, 0 si absent. */
	readonly motSelectHash: number;
}

/**
 * MenuTextSetting — clés de texte localisées (lookup dans common/text/<locale>/).
 * Les hashes de résolution sont des CRC-32 de chaînes de texte.
 */
export interface TextComponent extends MenuComponentBase {
	readonly kind: "text";
	/** Index ou mode de la table texte. */
	readonly tableIndex: number;
	/** Entrées texte : slot nommé + hash(es) de résolution. */
	readonly entries: readonly TextEntry[];
}

/** Entrée texte : slot nommé + hash(es) de résolution. */
export interface TextEntry {
	/** Nom du slot texte (ex. "_text_choice01_on"). */
	readonly key: string;
	/** Hash(es) de résolution (hash CRC-32 de la chaîne dans le dico). */
	readonly hashes: readonly number[];
}

/**
 * CMenuCreatePrimitiveComponent — primitives graphiques (rectangles, jauges…).
 */
export interface PrimitiveComponent extends MenuComponentBase {
	readonly kind: "primitive";
	/** Hash(es) CRC-32 de noms de primitives (MenuNumberSettingName). */
	readonly numberSettingHashes: readonly number[];
	/** Maximums par primitive : hash → valeur max. */
	readonly dispMaxValues: readonly DispMaxEntry[];
}

/** Valeur maximale d'affichage pour une primitive nommée. */
export interface DispMaxEntry {
	readonly primitiveHash: number;
	readonly maxValue: number;
}

/**
 * CMenuAttachLocator — points d'attache (null layers).
 */
export interface AttachLocatorComponent extends MenuComponentBase {
	readonly kind: "attachLocator";
	/** Hash(es) CRC-32 du nom de couche null. */
	readonly nullLayerHashes: readonly number[];
}

/**
 * MenuCollisionSetting — zones de collision tactile.
 */
export interface CollisionComponent extends MenuComponentBase {
	readonly kind: "collision";
	/** Mode (0 = standard, etc.). */
	readonly mode: number;
	/** Entrées de collision : nom du touch → paramètres. */
	readonly entries: readonly CollisionEntry[];
}

/** Entrée de collision tactile. */
export interface CollisionEntry {
	readonly key: string;
	readonly enabled: number;
	readonly type: number;
	readonly extra: number;
}

/**
 * CMenuSoundCmdProperty — commandes sonores associées à l'objet.
 */
export interface SoundCmdComponent extends MenuComponentBase {
	readonly kind: "soundCmd";
	/** Entrées son : nom de commande → paramètre. */
	readonly entries: readonly SoundCmdEntry[];
}

/** Entrée son. */
export interface SoundCmdEntry {
	readonly command: string;
	readonly param: number;
}

/**
 * CSetupMeshVisible — visibilité de meshes nommés (par CRC).
 */
export interface MeshVisibleComponent extends MenuComponentBase {
	readonly kind: "meshVisible";
	/** Entrées de visibilité : hash du mesh → booléen visible. */
	readonly params: readonly MeshVisibleEntry[];
}

/** Entrée de visibilité de mesh. */
export interface MeshVisibleEntry {
	readonly meshNameCrc: number;
	readonly isVisible: boolean;
}

/**
 * Composant générique pour les types non reconnus.
 */
export interface UnknownComponent extends MenuComponentBase {
	readonly kind: "unknown";
	/** Paramètres bruts (PROP_PARAM). */
	readonly rawParams: readonly { readonly key: string; readonly values: readonly number[] }[];
}

/** Union de tous les composants de menu. */
export type MenuComponent =
	| RenderComponent
	| AnimationComponent
	| TextComponent
	| PrimitiveComponent
	| AttachLocatorComponent
	| CollisionComponent
	| SoundCmdComponent
	| MeshVisibleComponent
	| UnknownComponent;
