import "server-only";

import { galleryVariantUrl } from "@/lib/images";
import { createClient } from "@/lib/supabase/server";

/**
 * Accès data dédié à la section « Stades » (terrains/salles de match IEVR).
 *
 * Source : table `inagle_stadiums` (81 lignes) du miroir SQLite embarqué, lue via
 * le client Supabase-compatible (`@/lib/supabase/server`). Fichier ISOLÉ — ne
 * dépend PAS de `lib/wiki-service.ts` (partagé entre agents).
 *
 * Vérité terrain (schéma réel inspecté) : chaque stade porte seulement un `id`
 * (hash de champ), un `field_index` (ordre in-game), un `image_path`
 * (`stadium/img_room_<code>`) et un blob `condition` opaque (29 octets, non
 * lisible — entête constant + 4 octets dérivés du hash). La table ne contient
 * AUCUN nom localisé ni texte d'effet/bonus exploitable : on n'invente donc rien,
 * on expose l'illustration in-game, le code et l'index réels.
 */

/** Base CDN du dossier menu jeu — assets servis live depuis les CPK (g4tx→png). */
const STADIUM_CDN_BASE = "https://cdn.rosegriffon.fr/dx11/menu/220_img/stadium";

/** Ligne brute `inagle_stadiums` telle que stockée dans le miroir. */
interface StadiumRow {
	id: string;
	field_index: number | null;
	image_path: string | null;
	condition: string | null;
}

/** Stade normalisé pour l'UI (aucune donnée inventée). */
export interface Stadium {
	/** Hash de champ in-game (`0x…`), identifiant stable et clé de route. */
	id: string;
	/** Code interne du terrain (`img_room_s19g001`), dérivé de `image_path`. */
	code: string;
	/** Index d'ordre in-game (`field_index`), `null` si absent. */
	index: number | null;
	/** Libellé dérivé du code (pas de localisation en DB — meilleur libellé possible). */
	title: string;
	/** PNG plein cadre d'origine (téléchargement / fond haute résolution). */
	image: string;
	/** Variante WebP w=400 pour la vignette de carte (~quelques Ko vs ~Mo). */
	thumb: string | null;
	/** Variante WebP w=1600 pour l'affichage détail plein écran. */
	full: string | null;
}

/**
 * Extrait le code terrain (`img_room_s19g001`) depuis l'`image_path`
 * (`stadium/img_room_s19g001`). Repli sur le path complet si le préfixe manque.
 */
function codeFromPath(imagePath: string | null): string {
	if (!imagePath) {
		return "";
	}
	const slash = imagePath.lastIndexOf("/");
	return slash >= 0 ? imagePath.slice(slash + 1) : imagePath;
}

/**
 * Dérive un libellé lisible depuis le code terrain : retire le préfixe `img_room_`,
 * remplace les `_` par des espaces et met en Title Case. Aucun nom localisé en DB
 * pour les stades — c'est le meilleur libellé dérivable honnêtement.
 */
function titleFromCode(code: string): string {
	const cleaned = code.replace(/^img_room_/, "").replaceAll("_", " ").trim();
	return cleaned.replace(/\b\w/g, (c) => c.toUpperCase()) || code;
}

/**
 * URL CDN du PNG plein cadre d'un stade. Le fichier menu suit le pattern
 * `<code>_<code>.png` (vérifié : les 81 codes existent dans le manifeste menu).
 */
function stadiumImageUrl(code: string): string {
	return `${STADIUM_CDN_BASE}/${code}_${code}.png`;
}

function rowToStadium(row: StadiumRow): Stadium {
	const code = codeFromPath(row.image_path);
	const image = stadiumImageUrl(code);
	return {
		id: row.id,
		code,
		index: row.field_index,
		title: titleFromCode(code),
		image,
		thumb: galleryVariantUrl(image, 400),
		full: galleryVariantUrl(image, 1600),
	};
}

/**
 * Liste les stades, filtrés par recherche texte (code/libellé, insensible à la
 * casse) et triés par `field_index` croissant (ordre in-game), `id` en repli.
 * Pas de pagination : 81 entrées tiennent sur une grille unique.
 */
export async function getStadiumsList(params: { q?: string } = {}): Promise<{
	data: Stadium[];
	total: number;
}> {
	const supabase = await createClient();
	const { data, error } = await supabase
		.from("inagle_stadiums")
		.select("id, field_index, image_path, condition");

	if (error || !data) {
		return { data: [], total: 0 };
	}

	let stadiums = (data as StadiumRow[]).map(rowToStadium);

	const q = params.q?.trim().toLowerCase();
	if (q) {
		stadiums = stadiums.filter(
			(s) => s.code.toLowerCase().includes(q) || s.title.toLowerCase().includes(q)
		);
	}

	stadiums.sort((a, b) => {
		const ai = a.index ?? Number.MAX_SAFE_INTEGER;
		const bi = b.index ?? Number.MAX_SAFE_INTEGER;
		return ai !== bi ? ai - bi : a.id.localeCompare(b.id);
	});

	return { data: stadiums, total: stadiums.length };
}

/** Récupère un stade par son `id` (hash de champ), ou `null` si introuvable. */
export async function getStadium(id: string): Promise<Stadium | null> {
	const supabase = await createClient();
	const { data, error } = await supabase
		.from("inagle_stadiums")
		.select("id, field_index, image_path, condition")
		.eq("id", id)
		.limit(1)
		.maybeSingle();

	if (error || !data) {
		return null;
	}
	return rowToStadium(data as StadiumRow);
}
