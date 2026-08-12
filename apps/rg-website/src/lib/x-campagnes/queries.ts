import "server-only";

import { getPgPool } from "@/lib/db/pg";

import {
	type Campagne,
	entierPositif,
	extraireImages,
	type MetriquesPost,
	type PostCampagne,
	type StatsCampagne,
} from "./types";

/*
 * Lectures serveur des campagnes à hashtag X.
 *
 * ⚠ `getPgPool()` se connecte avec le rôle `rg`, PROPRIÉTAIRE des tables : la RLS
 * ne s'applique donc pas (exemption propriétaire). Les clauses `publiee` et
 * `not masque` doivent figurer EXPLICITEMENT dans chaque requête — s'appuyer sur
 * les policies publierait les campagnes dépubliées et les posts modérés.
 *
 * Chaque requête est enveloppée dans un try/catch avec repli neutre : la page
 * publique ne doit jamais renvoyer une 500 parce que Postgres a hoqueté
 * (même motif que `app/community/page.tsx`).
 */

/** Colonnes de campagne, une seule fois : les trois requêtes lisent la même chose. */
const COLONNES_CAMPAGNE = `slug, titre, sur_titre, description, image_couverture, hashtags,
	       debut_le, fin_le, actif, principale, collecte_le`;

interface LigneCampagne {
	slug: string;
	titre: string;
	sur_titre: string | null;
	description: string | null;
	image_couverture: string | null;
	hashtags: string[] | null;
	debut_le: Date | string | null;
	fin_le: Date | string | null;
	actif: boolean;
	principale: boolean;
	collecte_le: Date | string | null;
}

interface LignePost {
	tweet_id: string;
	hashtag_trouve: string | null;
	mis_en_avant: boolean;
	publie_le: Date | string | null;
	author_username: string | null;
	author_name: string | null;
	text: string | null;
	media: unknown;
	metrics: unknown;
}

/*
 * `entierPositif` (plafond + rejet de NaN) vit dans `./types`, module PUR partagé
 * avec `page.tsx` : la page et les requêtes DOIVENT normaliser le numéro de page
 * de la même façon, sans quoi la grille et le widget de pagination désignent deux
 * pages différentes.
 */

/** Les dates traversent la frontière serveur → client : toujours en chaîne ISO. */
function versISO(valeur: Date | string | null | undefined): string | null {
	if (!valeur) {
		return null;
	}
	if (valeur instanceof Date) {
		return Number.isNaN(valeur.getTime()) ? null : valeur.toISOString();
	}
	const date = new Date(valeur);
	return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function versCampagne(ligne: LigneCampagne): Campagne {
	return {
		actif: ligne.actif,
		collecteLe: versISO(ligne.collecte_le),
		debutLe: versISO(ligne.debut_le),
		description: ligne.description,
		finLe: versISO(ligne.fin_le),
		hashtags: ligne.hashtags ?? [],
		imageCouverture: ligne.image_couverture,
		principale: ligne.principale,
		slug: ligne.slug,
		surTitre: ligne.sur_titre,
		titre: ligne.titre,
	};
}

function versPost(ligne: LignePost): PostCampagne {
	const metriques =
		ligne.metrics && typeof ligne.metrics === "object" && !Array.isArray(ligne.metrics)
			? (ligne.metrics as MetriquesPost)
			: null;
	return {
		auteurNom: ligne.author_name ?? ligne.author_username ?? "Anonyme",
		auteurPseudo: ligne.author_username ?? "",
		hashtagTrouve: ligne.hashtag_trouve,
		images: extraireImages(ligne.media),
		metriques,
		misEnAvant: ligne.mis_en_avant,
		publieLe: versISO(ligne.publie_le),
		texte: ligne.text ?? "",
		tweetId: ligne.tweet_id,
	};
}

/** Toutes les campagnes publiées — alimente le sélecteur de campagne. */
export async function listerCampagnesPubliees(): Promise<Campagne[]> {
	try {
		const { rows } = await getPgPool().query<LigneCampagne>(
			`select ${COLONNES_CAMPAGNE}
			   from public.x_campagnes
			  where publiee
			  order by principale desc, debut_le desc nulls last, slug`
		);
		return rows.map(versCampagne);
	} catch (error) {
		console.error("Erreur de lecture des campagnes X publiées :", error);
		return [];
	}
}

/**
 * Campagne à afficher. Sans `slug`, on prend la campagne « à la une »
 * (`principale`), puis la plus récente. Avec un `slug` inconnu ou dépublié, on
 * retombe sur ce même choix par défaut plutôt que de rendre une page vide :
 * une URL partagée après la dépublication d'une campagne reste utilisable.
 */
export async function chargerCampagne(slug?: string): Promise<Campagne | null> {
	try {
		// `getPgPool()` DOIT être appelé dans le try : il lève de façon synchrone
		// quand `DATABASE_URL` est absent ou corrompu (garde-fou `eyJ2Ijo`), et une
		// exception qui remonte ici fait tomber la page entière sur `error.tsx`.
		const pool = getPgPool();
		if (slug) {
			const { rows } = await pool.query<LigneCampagne>(
				`select ${COLONNES_CAMPAGNE}
				   from public.x_campagnes
				  where publiee and slug = $1
				  limit 1`,
				[slug]
			);
			const demandee = rows[0];
			if (demandee) {
				return versCampagne(demandee);
			}
		}
		const { rows } = await pool.query<LigneCampagne>(
			`select ${COLONNES_CAMPAGNE}
			   from public.x_campagnes
			  where publiee
			  order by principale desc, debut_le desc nulls last, slug
			  limit 1`
		);
		const defaut = rows[0];
		return defaut ? versCampagne(defaut) : null;
	} catch (error) {
		console.error("Erreur de lecture de la campagne X :", error);
		return null;
	}
}

/** Compteurs de l'en-tête : publications avec image, participants distincts, dernière. */
export async function compterPostsCampagne(slug: string): Promise<StatsCampagne> {
	try {
		const { rows } = await getPgPool().query<{
			posts: number;
			auteurs: number;
			derniere: Date | string | null;
		}>(
			`select count(*)::int                          as posts,
			        count(distinct t.author_username)::int as auteurs,
			        max(p.publie_le)                       as derniere
			   from public.x_campagne_posts p
			   join public.tweets t on t.id = p.tweet_id
			  where p.campagne_slug = $1 and not p.masque and p.a_media`,
			[slug]
		);
		const ligne = rows[0];
		return {
			auteurs: ligne?.auteurs ?? 0,
			derniere: versISO(ligne?.derniere ?? null),
			posts: ligne?.posts ?? 0,
		};
	} catch (error) {
		console.error("Erreur de comptage des publications de campagne :", error);
		return { auteurs: 0, derniere: null, posts: 0 };
	}
}

/*
 * ⚠ ORDRE DE TRI — ne PAS ajouter `nulls last`.
 * L'index `x_campagne_posts_galerie_idx (campagne_slug, publie_le desc)
 * where not masque and a_media` est NULLS FIRST (défaut d'un DESC). Mesuré sur
 * 2000 lignes avec `enable_seqscan = off` :
 *   `order by publie_le desc`                -> Index Scan            [optimal]
 *   `order by publie_le desc nulls last`     -> Sort + Bitmap Heap Scan
 *   `order by publie_le desc, tweet_id desc` -> Incremental Sort      [bon]
 * `tweet_id desc` en second critère rend la pagination déterministe (deux posts
 * à la même seconde ne peuvent pas permuter d'une page à l'autre).
 */
const SELECT_POSTS = `select p.tweet_id, p.hashtag_trouve, p.mis_en_avant, p.publie_le,
	       t.author_username, t.author_name, t.text, t.media, t.metrics
	  from public.x_campagne_posts p
	  join public.tweets t on t.id = p.tweet_id`;

/** Page de la galerie, chronologique stricte (posts avec image, non masqués). */
export async function listerPostsCampagne(
	slug: string,
	page: number,
	parPage: number
): Promise<PostCampagne[]> {
	// `Math.max(1, NaN)` vaut NaN : sans `entierPositif`, `?page=abc` envoyait
	// littéralement « NaN » à Postgres (`invalid input syntax for type bigint`),
	// la requête partait en erreur et la galerie s'affichait vide alors que la
	// campagne compte des publications.
	const taille = entierPositif(parPage, 24);
	const offset = (entierPositif(page, 1) - 1) * taille;
	try {
		const { rows } = await getPgPool().query<LignePost>(
			`${SELECT_POSTS}
			 where p.campagne_slug = $1 and not p.masque and p.a_media
			 order by p.publie_le desc, p.tweet_id desc
			 limit $2 offset $3`,
			[slug, taille, offset]
		);
		return rows.map(versPost);
	} catch (error) {
		console.error("Erreur de lecture des publications de campagne :", error);
		return [];
	}
}

/**
 * Sélection « À la une ». Requête SÉPARÉE de la grille : mettre `mis_en_avant`
 * dans l'`ORDER BY` de la grille neutraliserait l'index ET rendrait la
 * pagination instable (un post promu depuis la page 3 décalerait tout).
 */
export async function listerPostsEnAvant(slug: string, limite = 6): Promise<PostCampagne[]> {
	try {
		const { rows } = await getPgPool().query<LignePost>(
			`${SELECT_POSTS}
			 where p.campagne_slug = $1 and p.mis_en_avant and not p.masque and p.a_media
			 order by p.publie_le desc, p.tweet_id desc
			 limit $2`,
			[slug, entierPositif(limite, 6)]
		);
		return rows.map(versPost);
	} catch (error) {
		console.error("Erreur de lecture des publications à la une :", error);
		return [];
	}
}
