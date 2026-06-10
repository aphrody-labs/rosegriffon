/**
 * Partie CLIENT-SAFE du hub de données « Inazuma Eleven Cross » (`/cross/*`).
 *
 * Jeu mobile Unity IL2CPP DISTINCT d'Inazuma Eleven: Victory Road. Ce module ne
 * contient QUE des types + constantes purs (aucune dépendance Node/SQLite) ; le
 * data-fetch serveur vit dans `lib/cross/data.ts` (`import "server-only"`).
 *
 * Toutes les structures proviennent de l'extraction statique du dump IL2CPP
 * (schéma masterdata typé, enums) — voir `data/cross/*`. Les VALEURS de jeu
 * (lignes masterdata) ne sont pas encore récupérables (anti-triche serveur),
 * donc on n'affiche que le MODÈLE DE DONNÉES réel, jamais de fausse donnée.
 */

/** Teinte cyan officielle de la landing Cross (signal « jeu différent »). */
export const CROSS_CYAN = "#00aeef";

/** Une colonne typée d'une table masterdata. */
export interface CrossColumn {
	name: string;
	type: string;
	/** Famille du type : int | float | bool | string | enum | ref | array | list | dict | struct | localizationKey. */
	kind: string;
	enumValues?: { name: string; value: number }[];
	/** Table masterdata cible si `kind === "ref"`. */
	ref?: string;
	element?: string;
	key?: string;
	value?: string;
	nullable?: boolean;
	inherited?: boolean;
	from?: string;
}

/** Une table masterdata (= un fichier TSV côté jeu). */
export interface CrossTable {
	file: string;
	fullName: string;
	extends: string | null;
	relatedFiles?: string[];
	columns: CrossColumn[];
}

export type CrossSchema = Record<string, CrossTable>;

export interface CrossEnumMember {
	name: string;
	value: number;
}
export type CrossEnums = Record<string, CrossEnumMember[]>;

/** Statut d'extraction (compteurs + blocage), affiché sur le hub. */
export interface CrossExtractionStatus {
	game: string;
	package: string;
	version: string;
	engine: string;
	released: string;
	masterdata_tables: number;
	masterdata_columns: number;
	enums: number;
	remote_bundles: number;
	audio_wav: number;
	local_assets: number;
	classes: number;
	game_classes: number;
	localization_langs: string[];
	blocked: string;
	extracted_static: string[];
}

/** Manifest des voix de personnages décodées (CRI HCA → WAV). */
export interface CrossAudioManifest {
	total_wav: number;
	characters: Record<string, string[]>;
}

/** Libellés FR des familles de type (colonne « kind »). */
export const KIND_LABELS: Record<string, string> = {
	int: "entier",
	float: "décimal",
	bool: "booléen",
	string: "texte",
	enum: "énumération",
	ref: "référence",
	array: "tableau",
	list: "liste",
	dict: "dictionnaire",
	struct: "structure",
	localizationKey: "clé i18n",
};

/** Couleur de chip MD3 par famille de type. */
export const KIND_TONE: Record<string, string> = {
	int: "bg-primary-container text-on-primary-container",
	float: "bg-primary-container text-on-primary-container",
	bool: "bg-tertiary-container text-on-tertiary-container",
	string: "bg-secondary-container text-on-secondary-container",
	localizationKey: "bg-secondary-container text-on-secondary-container",
	enum: "bg-tertiary-container text-on-tertiary-container",
	ref: "bg-surface-container-highest text-on-surface",
	array: "bg-surface-container text-on-surface-variant",
	list: "bg-surface-container text-on-surface-variant",
	dict: "bg-surface-container text-on-surface-variant",
	struct: "bg-surface-container text-on-surface-variant",
};

/** Slug URL stable pour une table (nom court, sans le namespace). */
export function tableSlug(fullNameOrShort: string): string {
	const short = fullNameOrShort.split(".").pop() ?? fullNameOrShort;
	return short;
}
