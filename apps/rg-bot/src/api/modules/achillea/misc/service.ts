/**
 * Autocomplétion clans + joueurs (legacy `services/Suggestions.ts`).
 *
 * Le legacy s'appuyait sur la vue `user_view` et l'opérateur `%` de pg_trgm.
 * Ici, uniquement les tables canoniques et `ILIKE` (aucune extension ni vue
 * requise) ; le score `sim` est calculé côté API pour ordonner les résultats.
 */

import type { Kysely } from "kysely";
import type { Database } from "@rosegriffon/db/schema";
import { resolveDiscordAvatarUrl } from "@rosegriffon/achillea-core";

export const CLAN_SUGGESTION_LIMIT = 5;
export const USER_SUGGESTION_LIMIT = 8;
export const ALL_SUGGESTION_LIMIT = 5;

/** Modes ranked projetés dans la suggestion (mêmes valeurs que `GET /users/:id`). */
const SOLO_MODE = 2;
const DUO_MODE = 4;

type SuggestionRank = { elo: number; key: string; gradient: string[] };

export type Suggestion = {
  id: string;
  type: "clan" | "user";
  label: string;
  sim: number;
  clanShortName?: string;
  avatar?: string;
  soloRank: SuggestionRank;
  duoRank: SuggestionRank;
  lastInteract?: Date;
  role?: number;
  hasTwitch?: boolean;
  hasChallonge?: boolean;
  hasYoutube?: boolean;
};

const isContractRole = (role: unknown) => Number.isInteger(Number(role)) && Number(role) >= 0 && Number(role) <= 3;

const emptyRank = ():SuggestionRank => ({ elo: 0, key: "Fer", gradient: [] });

/** Échappe `%`, `_` et `\` pour un motif `ILIKE` littéral. */
export function likePattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, char => `\\${char}`)}%`;
}

/**
 * Proximité dans `[0, 1]` entre la saisie et un libellé : égalité 1, préfixe
 * puis inclusion pondérés par la part du libellé couverte.
 */
export function similarity(term: string, ...labels: Array<string | null | undefined>): number {
  const needle = term.toLowerCase();
  let best = 0;
  for (const label of labels) {
    if (!label) continue;
    const hay = label.toLowerCase();
    const ratio = needle.length / Math.max(hay.length, needle.length);
    const score = hay === needle ? 1 : hay.startsWith(needle) ? 0.6 + 0.4 * ratio : hay.includes(needle) ? 0.3 + 0.4 * ratio : 0;
    best = Math.max(best, score);
  }
  return Math.round(best * 1000) / 1000;
}

/** Saisie exploitable, ou `null` (le legacy rendait `[]` pour une saisie vide). */
export function normalizeQuery(query: string | undefined): string | null {
  const term = query?.trim().toLowerCase() ?? "";
  return term.length > 0 ? term.slice(0, 100) : null;
}

export abstract class SuggestionService {
  static async clans(db: Kysely<Database>, term: string): Promise<Suggestion[]> {
    const pattern = likePattern(term);
    const rows = await db
      .selectFrom("clan")
      .select(["id", "name", "shortened_name", "normalized_short_name", "clan_avatar_url"])
      .where("is_disbanded", "=", false)
      .where("is_hidden", "=", false)
      .where(eb =>
        eb.or([
          eb("name", "ilike", pattern),
          eb("shortened_name", "ilike", pattern),
          eb("normalized_short_name", "ilike", pattern),
        ]),
      )
      .limit(50)
      .execute();
    return rows
      .map(clan => ({
        id: String(clan.id),
        type: "clan" as const,
        label: clan.name,
        sim: similarity(term, clan.name, clan.shortened_name, clan.normalized_short_name),
        clanShortName: clan.shortened_name,
        ...(clan.clan_avatar_url ? { avatar: clan.clan_avatar_url } : {}),
        soloRank: emptyRank(),
        duoRank: emptyRank(),
      }))
      .toSorted((a, b) => b.sim - a.sim || a.label.localeCompare(b.label, "fr-FR"))
      .slice(0, CLAN_SUGGESTION_LIMIT);
  }

  static async users(db: Kysely<Database>, term: string): Promise<Suggestion[]> {
    const pattern = likePattern(term);
    const candidates = await db
      .selectFrom("user")
      .select(["id", "username", "display_name", "normalized_display_name", "avatar", "role", "last_interact", "twitch_url"])
      .where("blacklist_id", "is", null)
      .where(eb =>
        eb.or([
          eb("username", "ilike", pattern),
          eb("display_name", "ilike", pattern),
          eb("normalized_display_name", "ilike", pattern),
        ]),
      )
      .limit(50)
      .execute();
    const ranked = candidates
      .map(user => ({ user, sim: similarity(term, user.display_name, user.username, user.normalized_display_name) }))
      .toSorted(
        (a, b) => b.sim - a.sim || (a.user.display_name ?? "").localeCompare(b.user.display_name ?? "", "fr-FR"),
      )
      .slice(0, USER_SUGGESTION_LIMIT);
    if (ranked.length === 0) return [];

    const ids = ranked.map(({ user }) => user.id);
    const [elos, ranks, clans, challonge] = await Promise.all([
      db
        .selectFrom("user_elo")
        .select(["user_id", "mode", "elo", "season_id"])
        .where("user_id", "in", ids)
        .where("mode", "in", [SOLO_MODE, DUO_MODE])
        .execute(),
      db.selectFrom("rank").select(["key", "min_elo", "max_elo", "gradient"]).orderBy("min_elo", "asc").execute(),
      db
        .selectFrom("clan_member as cm")
        .innerJoin("clan as c", "c.id", "cm.clan_id")
        .select(["cm.user_id", "c.shortened_name", "c.is_inactive"])
        .where("cm.user_id", "in", ids)
        .where("c.is_disbanded", "=", false)
        .execute(),
      db
        .selectFrom("user_connection")
        .select("user_id")
        .where("user_id", "in", ids)
        .where("provider", "=", "challonge")
        .execute(),
    ]);
    const rankOf = (userId: string, mode: number): SuggestionRank => {
      const rows = elos.filter(row => row.user_id === userId && Number(row.mode) === mode);
      // Saison courante (`season_id` nul) d'abord, comme le classement.
      const row = rows.find(r => r.season_id === null) ?? rows[0];
      if (!row) return emptyRank();
      const elo = Number(row.elo ?? 0);
      const tier = ranks.find(rank => elo >= rank.min_elo && elo <= rank.max_elo);
      return { elo, key: tier?.key ?? "Fer", gradient: tier?.gradient ?? [] };
    };
    const clanOf = (userId: string) =>
      clans
        .filter(row => row.user_id === userId)
        .toSorted((a, b) => Number(a.is_inactive) - Number(b.is_inactive))[0]?.shortened_name;
    const challongeIds = new Set(challonge.map(row => row.user_id));

    return ranked.map(({ user, sim }) => {
      const clanShortName = clanOf(user.id);
      return {
        id: user.id,
        type: "user" as const,
        label: user.display_name || user.username || user.id,
        sim,
        ...(clanShortName ? { clanShortName } : {}),
        avatar: resolveDiscordAvatarUrl(user.id, user.avatar),
        soloRank: rankOf(user.id, SOLO_MODE),
        duoRank: rankOf(user.id, DUO_MODE),
        lastInteract: user.last_interact,
        // `UserRole` du contrat : 0 à 3 ; une valeur hors enum ferait rejeter toute la liste.
        ...(isContractRole(user.role) ? { role: Number(user.role) } : {}),
        hasTwitch: Boolean(user.twitch_url),
        hasChallonge: challongeIds.has(user.id),
        hasYoutube: false,
      };
    });
  }

  static async all(db: Kysely<Database>, term: string): Promise<Suggestion[]> {
    const [clans, users] = await Promise.all([SuggestionService.clans(db, term), SuggestionService.users(db, term)]);
    return [...clans, ...users].toSorted((a, b) => b.sim - a.sim).slice(0, ALL_SUGGESTION_LIMIT);
  }
}
