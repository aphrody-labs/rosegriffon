import "server-only";

import { getPgPool } from "@/lib/db/pg";

import {
	type Campagne,
	type DepotCampagne,
	entierPositif,
	extraireImages,
	type ImageCampagne,
	type MetriquesPost,
	type PostCampagne,
	type StatsCampagne,
	urlImageAsset,
} from "./types";

/*
 * Lectures serveur des campagnes : publications X ET créations Discord.
 *
 * ⚠ `getPgPool()` se connecte avec le rôle `rg`, PROPRIÉTAIRE des tables : la RLS
 * ne s'applique donc pas (exemption propriétaire). Les clauses `publiee`,
 * `not masque`, `deleted_at is null` et `suivi` doivent figurer EXPLICITEMENT
 * dans chaque requête — s'appuyer sur les policies publierait les campagnes
 * dépubliées, les publications modérées, les messages effacés de Discord et les
 * salons retirés de la veille.
 *
 * DEUX SOURCES, UN SEUL TYPE. Mesuré le 12/8/2026 : aucune des 12 998 lignes de
 * `public.tweets` ne porte `#inazumarg`, `#inatoberrg*` ni `#iergday` — les cinq
 * campagnes archivées n'ont donc RIEN à montrer côté X, leurs créations ayant été
 * déposées sur Discord. Les deux sources remontent dans le même `PostCampagne`,
 * discriminé par `source` : c'est le composant qui se branche dessus, jamais la
 * page qui devine.
 *
 * Chaque requête est enveloppée dans un try/catch avec repli neutre : la page
 * publique ne doit jamais renvoyer une 500 parce que Postgres a hoqueté
 * (même motif que `app/community/page.tsx`).
 */

/**
 * Colonnes de campagne, une seule fois : les trois requêtes lisent la même chose.
 *
 * ⚠ `hashtags_rattrapage` en est ABSENTE, et doit le rester. Cette colonne porte
 * les variantes récoltées en silence (la coquille `#InazumaRGday` de l'affiche
 * IERG Day, par exemple) : la récolte les lit, l'écran jamais. Ne pas la
 * sélectionner est ce qui garantit que la page n'a AUCUN moyen de l'afficher.
 * Côté lecture, elle ne sert qu'en ARGUMENT de `x_masquer_hashtags()` (cf.
 * `SELECT_POSTS`), pour retirer ces variantes du texte des posts — jamais en
 * résultat.
 */
const COLONNES_CAMPAGNE = `slug, titre, sur_titre, description, image_couverture,
	       image_affiche, image_reglement, note_affiche, reglement, hashtags,
	       hashtags_affichage, salons_depot, debut_le, fin_le, actif, principale,
	       collecte_le`;

interface LigneCampagne {
	slug: string;
	titre: string;
	sur_titre: string | null;
	description: string | null;
	image_couverture: string | null;
	image_affiche: string | null;
	image_reglement: string | null;
	note_affiche: string | null;
	reglement: string[] | null;
	hashtags: string[] | null;
	hashtags_affichage: string[] | null;
	salons_depot: string[] | null;
	debut_le: Date | string | null;
	fin_le: Date | string | null;
	actif: boolean;
	principale: boolean;
	collecte_le: Date | string | null;
}

/**
 * Une ligne de la galerie, X ou Discord — la forme COMMUNE des deux moitiés de
 * l'`union all`. Les colonnes qui n'ont de sens que d'un côté (métriques,
 * identifiants de salon) sont `null` de l'autre : Postgres exige que les deux
 * branches aient la même arité, et un `null` typé dit exactement la vérité
 * (« X ne publie pas de nom de salon », « Discord ne publie pas de métriques »).
 */
interface LigneCreation {
	source: "x" | "discord";
	/** Identifiant natif : `tweets.id` ou `discord_messages.message_id`. */
	identifiant: string;
	hashtag_trouve: string | null;
	mis_en_avant: boolean;
	publie_le: Date | string | null;
	auteur_nom: string | null;
	auteur_pseudo: string | null;
	texte: string | null;
	/** `tweets.media` côté X, `campagne_creations_discord.images` côté Discord. */
	media: unknown;
	metrics: unknown;
	salon_id: string | null;
	salon_nom: string | null;
	guild_id: string | null;
}

/** Une entrée de `campagne_creations_discord.images` (jsonb). */
interface ImageDiscordStockee {
	chemin?: string | null;
	nom?: string | null;
	largeur?: number | null;
	hauteur?: number | null;
	url_origine?: string | null;
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
		hashtagsAffichage: ligne.hashtags_affichage ?? [],
		imageAffiche: ligne.image_affiche,
		imageCouverture: ligne.image_couverture,
		imageReglement: ligne.image_reglement,
		noteAffiche: ligne.note_affiche,
		principale: ligne.principale,
		reglement: ligne.reglement ?? [],
		salonsDepot: ligne.salons_depot ?? [],
		slug: ligne.slug,
		surTitre: ligne.sur_titre,
		titre: ligne.titre,
	};
}

/**
 * Images d'une création Discord, telles qu'elles sont SERVABLES.
 *
 * Une entrée sans `chemin` est une recopie encore en échec : son seul lien
 * connu est l'URL `cdn.discordapp.com` signée, périmée en moins de 24 h. On ne
 * la rend donc pas — l'écran préfère une création de moins à une image morte.
 * `url_origine` (débarrassée de sa signature) n'alimente que `source`, utilisée
 * pour le téléchargement quand notre copie manque : elle est déjà écartée par
 * `next/image` faute d'hôte autorisé, et sert de trace de provenance.
 */
function imagesDiscord(brut: unknown): ImageCampagne[] {
	if (!Array.isArray(brut)) {
		return [];
	}
	const images: ImageCampagne[] = [];
	for (const entree of brut) {
		if (!entree || typeof entree !== "object") {
			continue;
		}
		const image = entree as ImageDiscordStockee;
		const src = urlImageAsset(image.chemin);
		if (!src) {
			continue;
		}
		images.push({
			hauteur: typeof image.hauteur === "number" ? image.hauteur : null,
			largeur: typeof image.largeur === "number" ? image.largeur : null,
			source: src,
			src,
		});
	}
	return images;
}

function versPost(ligne: LigneCreation): PostCampagne {
	const commun = {
		auteurNom: ligne.auteur_nom ?? ligne.auteur_pseudo ?? "Anonyme",
		hashtagTrouve: ligne.hashtag_trouve,
		misEnAvant: ligne.mis_en_avant,
		publieLe: versISO(ligne.publie_le),
		texte: ligne.texte ?? "",
	};

	if (ligne.source === "discord") {
		return {
			...commun,
			auteurPseudo: ligne.auteur_pseudo,
			guildId: ligne.guild_id ?? "",
			images: imagesDiscord(ligne.media),
			messageId: ligne.identifiant,
			salonId: ligne.salon_id ?? "",
			salonNom: ligne.salon_nom,
			source: "discord",
		};
	}

	const metriques =
		ligne.metrics && typeof ligne.metrics === "object" && !Array.isArray(ligne.metrics)
			? (ligne.metrics as MetriquesPost)
			: null;
	return {
		...commun,
		auteurPseudo: ligne.auteur_pseudo ?? "",
		images: extraireImages(ligne.media),
		metriques,
		source: "x",
		tweetId: ligne.identifiant,
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
			   join public.x_campagnes c on c.slug = p.campagne_slug and c.publiee
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
/*
 * ⚠ LE HASHTAG D'UN POST N'EST RENDU QUE S'IL EST AFFICHABLE.
 * `x_campagne_posts.hashtag_trouve` enregistre CELUI QUI A MORDU, y compris un
 * hashtag de rattrapage (`x_campagnes.hashtags_rattrapage` : coquille d'un visuel,
 * variante fautive). Le rendre tel quel afficherait la faute sur la carte du post,
 * exactement ce que le rattrapage silencieux cherche à éviter. Le `case` ci-dessous
 * le ramène à NULL quand il ne fait pas partie des hashtags publics de la campagne.
 * Le filtrage est fait ICI, en SQL, et pas dans le composant : un futur écran qui
 * lirait ces posts hériterait sinon de la fuite.
 *
 * Quand il est affichable, il ressort dans la CASSE de la campagne
 * (`hashtags_affichage`, aligné index par index sur `hashtags`) et non dans celle
 * qu'a tapée l'auteur : la carte annonce « #InazumaDay » là où le post écrivait
 * « #inazumaday ». `hashtags_affichage` vide → indice hors bornes → NULL →
 * `coalesce` retombe sur la forme normalisée, ce qui reste exact.
 *
 * ⚠ LE TEXTE DU POST EST LE SECOND CHEMIN, ET IL EXISTE VRAIMENT.
 * Masquer `hashtag_trouve` ne suffit pas : `t.text` est rendu tel quel dans
 * l'extrait de la carte (`PostCarte`) et dans la légende de la visionneuse, donc
 * le premier participant qui recopie la coquille d'un visuel la reproduit sur
 * notre page — exactement ce que le rattrapage silencieux cherche à éviter.
 * `x_masquer_hashtags()` retire du texte les seuls hashtags de rattrapage de LA
 * campagne concernée (les autres hashtags de l'auteur, eux, ne nous appartiennent
 * pas et restent intacts). C'est fait ICI, en SQL, avec `c.hashtags_rattrapage`
 * qui n'est jamais RENVOYÉE : la colonne reste hors de portée du rendu, et un
 * futur écran qui lirait ces posts hériterait du masquage plutôt que de la fuite.
 *
 * La jointure sur `x_campagnes` sert aussi à REPOSER `c.publiee` : `getPgPool()` se
 * connecte en rôle propriétaire, donc SANS RLS (cf. l'avertissement en tête de
 * fichier). Sans elle, ces requêtes publieraient les posts d'une campagne dépubliée
 * à qui en connaîtrait le slug.
 */
const SELECT_POSTS = `select p.tweet_id, p.mis_en_avant, p.publie_le,
	       case when p.hashtag_trouve = any(c.hashtags)
	            then coalesce(c.hashtags_affichage[array_position(c.hashtags, p.hashtag_trouve)],
	                          p.hashtag_trouve)
	       end as hashtag_trouve,
	       t.author_username, t.author_name,
	       public.x_masquer_hashtags(t.text, c.hashtags_rattrapage) as text,
	       t.media, t.metrics
	  from public.x_campagne_posts p
	  join public.tweets t on t.id = p.tweet_id
	  join public.x_campagnes c on c.slug = p.campagne_slug and c.publiee`;

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
