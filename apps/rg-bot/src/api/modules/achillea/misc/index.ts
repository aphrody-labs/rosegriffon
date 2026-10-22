import { Elysia, t } from "elysia";
import { dbPlugin } from "../../../plugins/db";
import { normalizeQuery, SuggestionService } from "./service";

const rank = t.Object({ elo: t.Number(), key: t.String(), gradient: t.Array(t.String()) });

const suggestions = t.Array(
  t.Object({
    id: t.String(),
    type: t.Union([t.Literal("clan"), t.Literal("user")]),
    label: t.String(),
    sim: t.Number(),
    clanShortName: t.Optional(t.String()),
    avatar: t.Optional(t.String()),
    soloRank: rank,
    duoRank: rank,
    lastInteract: t.Optional(t.Date()),
    role: t.Optional(t.Number()),
    hasTwitch: t.Optional(t.Boolean()),
    hasChallonge: t.Optional(t.Boolean()),
    hasYoutube: t.Optional(t.Boolean()),
  }),
);

const options = {
  query: t.Object({ query: t.Optional(t.String({ maxLength: 200 })) }),
  response: { 200: suggestions },
};

/** Lecture anonyme et identique pour tous : un court cache CDN suffit. */
const CACHE_CONTROL = "public, max-age=30, stale-while-revalidate=120";

/** `/misc/suggest/*` — autocomplétion de la barre de recherche (legacy `MiscController`). */
export const miscController = new Elysia({ prefix: "/misc" })
  .use(dbPlugin)
  .get(
    "/suggest/all",
    async ({ db, query, set }) => {
      const term = normalizeQuery(query.query);
      set.headers["cache-control"] = CACHE_CONTROL;
      return term ? SuggestionService.all(db, term) : [];
    },
    options,
  )
  .get(
    "/suggest/clans",
    async ({ db, query, set }) => {
      const term = normalizeQuery(query.query);
      set.headers["cache-control"] = CACHE_CONTROL;
      return term ? SuggestionService.clans(db, term) : [];
    },
    options,
  )
  .get(
    "/suggest/users",
    async ({ db, query, set }) => {
      const term = normalizeQuery(query.query);
      set.headers["cache-control"] = CACHE_CONTROL;
      return term ? SuggestionService.users(db, term) : [];
    },
    options,
  );
