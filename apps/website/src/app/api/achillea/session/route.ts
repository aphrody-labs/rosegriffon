import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
	COOKIE_SESSION_ACHILLEA,
	DUREE_SESSION_ACHILLEA_SECONDES,
	signerJetonAchillea,
} from "@/lib/achillea/jeton";
import { getServerSession } from "@/lib/auth-helpers";
import { getPgPool } from "@/lib/db/pg";

/**
 * Passerelle d'identité : une session Rose Griffon vaut une session Achilléa.
 *
 * LE PROBLÈME QU'ELLE SUPPRIME
 * Le même visiteur avait DEUX comptes sur le même site. La session Rose Griffon
 * (Better Auth) ouvrait `/wiki`, `/shop`, `/settings` ; la session Achilléa —
 * un JWT maison posé par l'API après son propre OAuth Discord — ouvrait
 * `/achillea/**`. Deux boutons « Connexion » dans le même chrome, deux
 * déconnexions, et un membre connecté depuis dix minutes qui se voyait proposer
 * de se connecter en arrivant sur la page des clans.
 *
 * CE QU'ELLE FAIT
 * Elle lit la session Rose Griffon, retrouve le compte Discord qui lui est lié
 * (`account.provider_id = 'discord'`), s'assure que ce joueur existe dans
 * `achillea."user"` — c'est la même base depuis la fusion — et signe le jeton
 * qu'attend l'API Achilléa. Aucun second écran Discord : le lien de compte a
 * déjà eu lieu, une fois, côté Rose Griffon.
 *
 * POURQUOI L'IDENTIFIANT DISCORD
 * C'est la seule clé commune, et ce n'est pas un accident : le compte Achilléa
 * NAÎT d'un OAuth Discord, son identifiant primaire EST l'identifiant Discord.
 * Un membre connecté par e-mail ou Google sans Discord lié n'a donc pas de
 * contrepartie côté e-sport — la route le dit (`409`) au lieu de fabriquer un
 * compte fantôme.
 *
 * POURQUOI SIGNER ICI PLUTÔT QUE DEMANDER À L'API
 * L'API Achilléa ne sait signer un jeton qu'au retour de SON OAuth. Lui ajouter
 * un point d'entrée « fais-moi confiance, ce membre est authentifié » revient à
 * déplacer le secret sans rien gagner : c'est le même secret, partagé par les
 * deux moitiés de la même application.
 */

/**
 * Attributs du cookie de session.
 *
 * Domaine parent : le jeton doit valoir pour `rosegriffon.fr` ET
 * `ranked.rosegriffon.fr`, que le front appelle directement.
 */
const COOKIE = {
	domain: process.env.NODE_ENV === "production" ? ".rosegriffon.fr" : undefined,
	httpOnly: true,
	path: "/",
	sameSite: "lax",
	secure: process.env.NODE_ENV === "production",
} as const;

interface LigneCompteDiscord {
	discord_id: string;
	username: string | null;
	avatar_url: string | null;
}

export async function POST() {
	const secret = process.env.ACHILLEA_JWT_SECRET;
	if (!secret) {
		// Sans le secret partagé, la passerelle ne peut rien signer. On le dit
		// franchement : un 500 muet enverrait chercher la panne côté Achilléa.
		return NextResponse.json({ error: "passerelle_non_configuree" }, { status: 503 });
	}

	const session = await getServerSession();
	if (!session?.user) {
		return NextResponse.json({ error: "non_authentifie" }, { status: 401 });
	}

	const pool = getPgPool();

	// Le compte Discord lié à CETTE session, et le profil qui porte le pseudo et
	// l'avatar affichés côté Rose Griffon.
	const { rows } = await pool.query<LigneCompteDiscord>(
		`SELECT a.account_id AS discord_id,
		        COALESCE(p.username, u.name) AS username,
		        COALESCE(p.avatar_url, u.image) AS avatar_url
		 FROM public.account a
		 JOIN public."user" u ON u.id = a.user_id
		 LEFT JOIN public.profiles p ON p.id = a.user_id
		 WHERE a.user_id = $1 AND a.provider_id = 'discord'
		 LIMIT 1`,
		[session.user.id]
	);

	const compte = rows[0];
	if (!compte?.discord_id) {
		return NextResponse.json({ error: "discord_non_lie" }, { status: 409 });
	}

	// Le joueur doit exister côté Achilléa : `/api/users/me` lit cette table, et
	// un jeton valide pour un identifiant absent produirait une session qui
	// s'authentifie mais ne trouve personne. `on conflict` ne touche pas aux
	// données du jeu (elo, clan, licence) — seulement à l'identité affichée.
	//
	// `display_name` et `normalized_display_name` sont laissés à leur défaut :
	// le bot les calcule avec `normalizeNames()` (NFKC, alphabets stylisés
	// repliés, 90 lignes), et les recopier ici en `UPPER()` fabriquerait une
	// seconde normalisation, divergente, qui casserait la recherche de joueurs.
	// Le bot les remplit à la première synchronisation Discord.
	await pool.query(
		`INSERT INTO achillea."user" (id, created_at, updated_at, last_interact, role, username, avatar)
		 VALUES ($1, now(), now(), now(), 0, $2, $3)
		 ON CONFLICT (id) DO UPDATE
		 SET last_interact = now(),
		     updated_at = now(),
		     username = COALESCE(EXCLUDED.username, achillea."user".username),
		     avatar = COALESCE(EXCLUDED.avatar, achillea."user".avatar)`,
		[compte.discord_id, compte.username, compte.avatar_url]
	);

	const jeton = signerJetonAchillea(
		{ avatar: compte.avatar_url, id: compte.discord_id, username: compte.username },
		secret
	);

	const magasin = await cookies();
	magasin.set(COOKIE_SESSION_ACHILLEA, jeton, {
		...COOKIE,
		maxAge: DUREE_SESSION_ACHILLEA_SECONDES,
	});

	return NextResponse.json({ id: compte.discord_id, username: compte.username });
}

/** Ferme la session Achilléa en même temps que celle de Rose Griffon. */
export async function DELETE() {
	const magasin = await cookies();
	magasin.set(COOKIE_SESSION_ACHILLEA, "", { ...COOKIE, maxAge: 0 });
	return NextResponse.json({ ok: true });
}
