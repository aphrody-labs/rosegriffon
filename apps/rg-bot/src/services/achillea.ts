/**
 * Compatibility facade for the versioned Achillea guild API client.
 *
 * Bot callers keep the historical French names and `Resultat` envelope while
 * transport and runtime validation live in `@rosegriffon/achillea-client/v1`.
 */

import {
	achilleaChannelSchema,
	achilleaGuildDetailSchema,
	achilleaGuildPageSchema,
	achilleaGuildSchema,
	achilleaGuildStatsSchema,
	achilleaRoleSchema,
	createAchilleaClient,
	discordIdSchema,
	type AchilleaChannel,
	type AchilleaClientResult,
	type AchilleaGuild,
	type AchilleaGuildDetail,
	type AchilleaGuildPage,
	type AchilleaGuildStats,
	type AchilleaRole,
} from "@rosegriffon/achillea-client/v1";

export const IdentifiantDiscord = discordIdSchema;
export const RoleAchillea = achilleaRoleSchema;
export const SalonAchillea = achilleaChannelSchema;
export const GuildeAchillea = achilleaGuildSchema;
export const GuildeDetaillee = achilleaGuildDetailSchema;
export const PageGuildes = achilleaGuildPageSchema;
export const StatsGuildes = achilleaGuildStatsSchema;

export type RoleAchillea = AchilleaRole;
export type SalonAchillea = AchilleaChannel;
export type GuildeAchillea = AchilleaGuild;
export type GuildeDetaillee = AchilleaGuildDetail;
export type PageGuildes = AchilleaGuildPage;
export type StatsGuildes = AchilleaGuildStats;

export type Resultat<T> =
	| { ok: true; valeur: T }
	| { ok: false; raison: "injoignable" | "http" | "forme"; detail: string };

const client = createAchilleaClient({ baseUrl: Bun.env.ACHILLEA_API_URL });

function adapterResultat<T>(resultat: AchilleaClientResult<T>): Resultat<T> {
	if (resultat.ok) return { ok: true, valeur: resultat.value };

	switch (resultat.kind) {
		case "unreachable":
			return { ok: false, raison: "injoignable", detail: resultat.detail };
		case "http":
			return {
				ok: false,
				raison: "http",
				detail: `HTTP ${resultat.status} sur ${resultat.path}`,
			};
		case "invalid_json":
			return {
				ok: false,
				raison: "forme",
				detail: resultat.detail.replace(/^unreadable response:/u, "réponse illisible :"),
			};
		case "invalid_response":
			return { ok: false, raison: "forme", detail: resultat.detail };
	}
}

/** Serveurs scannés, du plus peuplé au moins peuplé. */
export async function listerGuildes(page = 1, limite = 25): Promise<Resultat<PageGuildes>> {
	return adapterResultat(await client.listGuilds(page, limite));
}

/** Agrégats sur l'ensemble des serveurs scannés. */
export async function statistiquesGuildes(): Promise<Resultat<StatsGuildes>> {
	return adapterResultat(await client.getGuildStats());
}

/** Fiche d'un serveur avec ses rôles et ses salons. */
export async function detailGuilde(id: string): Promise<Resultat<GuildeDetaillee>> {
	return adapterResultat(await client.getGuild(id));
}

/** Un serveur connu mais jamais scanné garde ses champs principaux à `null`. */
export function estScanne(guilde: GuildeAchillea): boolean {
	return guilde.scanned_at !== null && guilde.name !== null;
}
