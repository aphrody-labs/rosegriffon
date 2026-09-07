/**
 * Client de l'API du bot Achillea — la seule porte d'entrée de ce dépôt vers elle.
 *
 * ── POURQUOI UN CLIENT, ET PAS DES `fetch` DISPERSÉS ───────────────────────
 * Achillea est un AUTRE dépôt, avec son propre cycle de vie : ses contrôleurs
 * `@tsed/common` peuvent changer de forme sans que rien ici ne le sache, et aucun
 * type TypeScript ne franchit la frontière entre les deux monorepos. Un `fetch`
 * écrit à la volée renverrait donc `any`, et une colonne renommée là-bas se
 * manifesterait ici par un `undefined` affiché à un membre, des mois plus tard.
 *
 * Le contrat est donc redéclaré ici en schémas Zod, qui font les deux à la fois :
 * ils produisent les types TypeScript ET vérifient la réponse à l'exécution. Une
 * dérive de l'API devient une erreur nette, datée, avec le champ fautif — au lieu
 * d'un affichage silencieusement faux.
 *
 * ── CE QUE L'API SERT ──────────────────────────────────────────────────────
 * `GET /guilds`        liste paginée des serveurs scannés (les non scannés sont exclus)
 * `GET /guilds/stats`  agrégats : serveurs, membres, date du dernier scan, types de salons
 * `GET /guilds/:id`    fiche d'un serveur AVEC ses rôles et ses salons
 *
 * Ces tables sont remplies par `scripts/ops/discord/scan-guilds.ts --db` côté
 * Achillea. Un serveur jamais scanné répond avec des champs à `null` et des listes
 * vides : ce n'est pas une panne, c'est un scan qui n'a pas encore eu lieu, et
 * `estScanne()` permet de le dire à l'utilisateur plutôt que d'afficher du vide.
 *
 * ── OÙ ELLE VIT ────────────────────────────────────────────────────────────
 * Achillea a sa propre infra (VPS dédié, nginx/systemd propres) — jamais colocalisée
 * avec ce dépôt, et elle en change (cf. `migration.md` côté `rose-griffon/achillea`).
 * L'adresse reste configurable par `ACHILLEA_API_URL` ; le défaut vise l'entrée
 * publique stable plutôt qu'une IP de VPS qui bouge.
 */

import { z } from "zod";

/** Entrée publique stable : ne dépend pas de l'IP du VPS derrière `ranked.rosegriffon.fr`. */
const BASE = (Bun.env.ACHILLEA_API_URL ?? "https://ranked.rosegriffon.fr/api").replace(/\/+$/, "");

/**
 * Un bot Discord ne doit jamais rester bloqué sur un service voisin : au-delà de ce
 * délai, mieux vaut répondre « Achillea ne répond pas » que laisser l'interaction
 * expirer sans un mot.
 */
const DELAI_MS = 8000;

/** Identifiant Discord (flocon) : 15 à 25 chiffres, jamais un nombre JavaScript. */
export const IdentifiantDiscord = z.string().regex(/^\d{15,25}$/u, "identifiant Discord invalide");

/**
 * Les compteurs arrivent en `bigint` sérialisé côté Postgres : `total_members` est une
 * chaîne dans le JSON, `member_count` un nombre. On normalise en nombre ici, une fois,
 * plutôt que dans chaque appelant.
 */
const NombreSouple = z.union([z.number(), z.string()]).nullable().transform((v) => {
	if (v === null) return null;
	const n = typeof v === "number" ? v : Number(v);
	return Number.isFinite(n) ? n : null;
});

export const RoleAchillea = z.object({
	id: IdentifiantDiscord,
	name: z.string(),
	/** Couleur Discord en entier 24 bits ; 0 signifie « pas de couleur », pas noir. */
	color: z.number().default(0),
	position: z.number().default(0),
	permissions: z.string().nullable().default(null),
	hoist: z.boolean().nullable().default(false),
	managed: z.boolean().nullable().default(false),
	mentionable: z.boolean().nullable().default(false),
});

export const SalonAchillea = z.object({
	id: IdentifiantDiscord,
	name: z.string(),
	/** Type Discord (0 texte, 2 vocal, 4 catégorie, 5 annonces, 15 forum…). */
	type: z.number(),
	parent_id: z.string().nullable().default(null),
	position: z.number().nullable().default(0),
	topic: z.string().nullable().default(null),
	nsfw: z.boolean().nullable().default(false),
});

export const GuildeAchillea = z.object({
	id: IdentifiantDiscord,
	name: z.string().nullable(),
	icon: z.string().nullable(),
	banner: z.string().nullable(),
	owner_id: z.string().nullable(),
	member_count: NombreSouple,
	presence_count: NombreSouple,
	features: z.array(z.string()).nullable().default(null),
	premium_tier: z.number().nullable().default(0),
	verification_level: z.number().nullable().default(0),
	description: z.string().nullable(),
	scanned_at: z.string().nullable(),
});

export const GuildeDetaillee = GuildeAchillea.extend({
	roles: z.array(RoleAchillea).default([]),
	channels: z.array(SalonAchillea).default([]),
});

export const PageGuildes = z.object({
	data: z.array(GuildeAchillea),
	meta: z.object({
		page: z.number(),
		limit: z.number(),
		total: z.number(),
		pageCount: z.number(),
	}),
});

export const StatsGuildes = z.object({
	total_guilds: z.number(),
	total_members: z.union([z.number(), z.string()]).transform(Number),
	last_scan: z.string().nullable(),
	by_premium_tier: z.array(z.object({ premium_tier: z.number(), count: z.number() })).default([]),
	by_channel_type: z.array(z.object({ type: z.number(), count: z.number() })).default([]),
});

export type RoleAchillea = z.infer<typeof RoleAchillea>;
export type SalonAchillea = z.infer<typeof SalonAchillea>;
export type GuildeAchillea = z.infer<typeof GuildeAchillea>;
export type GuildeDetaillee = z.infer<typeof GuildeDetaillee>;
export type PageGuildes = z.infer<typeof PageGuildes>;
export type StatsGuildes = z.infer<typeof StatsGuildes>;

/**
 * Résultat explicite plutôt qu'exception : l'appelant est une commande Discord, qui
 * doit répondre quelque chose d'utile dans TOUS les cas. Distinguer « injoignable »
 * de « réponse inattendue » change le message affiché — et le service à réparer.
 */
export type Resultat<T> =
	| { ok: true; valeur: T }
	| { ok: false; raison: "injoignable" | "http" | "forme"; detail: string };

async function appeler<T>(chemin: string, schema: z.ZodType<T>): Promise<Resultat<T>> {
	let reponse: Response;
	try {
		reponse = await fetch(`${BASE}${chemin}`, {
			headers: { Accept: "application/json" },
			signal: AbortSignal.timeout(DELAI_MS),
		});
	} catch (erreur) {
		return {
			ok: false,
			raison: "injoignable",
			detail: erreur instanceof Error ? erreur.message : String(erreur),
		};
	}

	if (!reponse.ok) {
		return { ok: false, raison: "http", detail: `HTTP ${reponse.status} sur ${chemin}` };
	}

	let brut: unknown;
	try {
		brut = await reponse.json();
	} catch (erreur) {
		return {
			ok: false,
			raison: "forme",
			detail: `réponse illisible : ${erreur instanceof Error ? erreur.message : String(erreur)}`,
		};
	}

	const analyse = schema.safeParse(brut);
	if (!analyse.success) {
		// Le chemin du champ fautif, pas seulement « invalide » : c'est lui qui dit
		// quelle colonne a bougé côté Achillea.
		const premier = analyse.error.issues[0];
		return {
			ok: false,
			raison: "forme",
			detail: premier
				? `${premier.path.join(".") || "(racine)"} : ${premier.message}`
				: "structure inattendue",
		};
	}
	return { ok: true, valeur: analyse.data };
}

/** Serveurs scannés, du plus peuplé au moins peuplé. */
export function listerGuildes(page = 1, limite = 25): Promise<Resultat<PageGuildes>> {
	return appeler(`/guilds?page=${page}&limit=${limite}`, PageGuildes);
}

/** Agrégats sur l'ensemble des serveurs scannés. */
export function statistiquesGuildes(): Promise<Resultat<StatsGuildes>> {
	return appeler("/guilds/stats", StatsGuildes);
}

/** Fiche d'un serveur avec ses rôles et ses salons. */
export function detailGuilde(id: string): Promise<Resultat<GuildeDetaillee>> {
	return appeler(`/guilds/${encodeURIComponent(id)}`, GuildeDetaillee);
}

/**
 * Un serveur connu de la base mais jamais scanné répond 200 avec tout à `null`.
 * Sans ce test, la commande afficherait une fiche vide comme si c'était la réalité.
 */
export function estScanne(guilde: GuildeAchillea): boolean {
	return guilde.scanned_at !== null && guilde.name !== null;
}
