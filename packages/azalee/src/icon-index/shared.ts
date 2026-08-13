/**
 * Types et construction d'URL de l'**index texture → conteneur g4tx** du
 * namespace icône (`dx11/menu/200_icon/**`).
 *
 * ⚠ **Client-safe** : aucun `node:fs`, `node:zlib`, `bun:sqlite` ni réseau. Le
 * chargement de l'artefact vit dans le jumeau serveur `./index.ts`.
 *
 * ## Pourquoi un index
 *
 * Le seul localisateur fiable d'une icône est le couple **(chemin g4tx, nom de
 * texture)** — pas le dossier écrit en base de données, qui est faux pour une
 * partie du catalogue (`coa_animal_an000100` est déclaré dans `02_icon_item`
 * alors qu'il vit dans `22_icon_town/icon_animal.g4tx`). Un conteneur g4tx
 * porte plusieurs dizaines de textures nommées indépendantes : sans index, on
 * ne peut pas savoir quel `.g4tx` ouvrir pour un nom donné.
 *
 * ## Contrat d'URL
 *
 * ```text
 * texture nommée dans un conteneur :
 *   https://cdn.rosegriffon.fr/dx11/menu/<chemin>.g4tx/<nom_texture>.png
 * fichier 1:1 inchangé :
 *   https://cdn.rosegriffon.fr/dx11/menu/<chemin>.png
 * ```
 */

/** Base CDN du namespace menu dx11 (décodage live depuis les CPK). */
export const MENU_CDN_BASE = "https://cdn.rosegriffon.fr/dx11/menu";

/** Préfixe des chemins d'index CPK couverts par cet index. */
export const ICON_NAMESPACE_PREFIX = "data/dx11/menu/200_icon/";

/**
 * Nature d'une entrée d'index :
 * - `main` : texture principale du conteneur, payload DDS complet → à
 *   **sélectionner** par nom, sans rognage ;
 * - `region` : rectangle nommé d'un atlas spatial → à **rogner** dans la
 *   texture principale porteuse.
 */
export type IconTextureKind = "main" | "region";

/** Résolution d'un nom de texture vers son conteneur. */
export interface IconTextureRef {
	/** Chemin du conteneur, relatif à `dx11/menu/` (ex. `200_icon/02_icon_item/icon_item05.g4tx`). */
	g4txPath: string;
	/** Nom exact de la texture tel qu'il figure dans la table de chaînes du conteneur. */
	textureName: string;
	/** Texture principale ou région d'atlas. */
	kind: IconTextureKind;
}

/** Une ligne de l'artefact `icon-texture-index.ndjson.gz`. */
export type IconIndexEntry = [g4txPath: string, mainTextures: string[], regions: string[]];

/**
 * URL CDN d'une texture nommée dans un conteneur g4tx.
 *
 * Suit le contrat d'URL : le chemin du `.g4tx` est conservé **tel quel**
 * (extension comprise) et le nom de texture devient le dernier segment.
 */
export function iconTextureUrl(ref: Pick<IconTextureRef, "g4txPath" | "textureName">): string {
	return `${MENU_CDN_BASE}/${ref.g4txPath}/${ref.textureName}.png`;
}

/**
 * URL CDN d'un fichier menu 1:1 (un `.g4tx` dont on veut la texture évidente).
 * `relativePath` est relatif à `dx11/menu/`, avec ou sans extension `.g4tx`.
 */
export function menuFileUrl(relativePath: string): string {
	const base = relativePath.replace(/\.g4tx$/i, "");
	return `${MENU_CDN_BASE}/${base}.png`;
}

/**
 * Normalise un nom de texture pour la recherche : minuscules, sans extension.
 * Les tables de chaînes G4TX sont en ASCII ; la comparaison est insensible à la
 * casse, comme `select_main_texture` / `find_sub_texture` côté Rust.
 */
export function normalizeTextureName(name: string): string {
	return name
		.trim()
		.replace(/\.(png|g4tx|webp|dds)$/i, "")
		.toLowerCase();
}
