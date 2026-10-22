/**
 * `/interclans` — défis entre clans, servis au site, au bot Discord et à la CLI.
 *
 *   GET  /interclans                          liste (?clanId, ?state, ?limit, ?mine=true)
 *   GET  /interclans/:id                      fiche (compositions, matchs, vote) — `viewer` si connecté
 *   POST /interclans                          défier un clan   { challengedShortName | challengedClanId, date, motif? }
 *   POST /interclans/:id/respond              répondre au défi { accept }
 *   PUT  /interclans/:id/lineups/:clanId      composer         { members: [{ userId, position }] }
 *   POST /interclans/:id/lineups/:clanId/lock verrouiller
 *   POST /interclans/:id/cancel               annuler (Président de l'un des clans)
 *   POST /interclans/:id/start                lancer : un match par position
 *   POST /interclans/matches/:lobbyId/score   saisir un score  { scoreA, scoreB }
 *   POST /interclans/:id/arbitrate            arbitrage staff  { approve }
 *   POST /interclans/internal/maintenance     entretien (jeton `API_ADMIN_TOKEN`, tâche `achillea:interclans`) { now? }
 *
 * Toutes les écritures exigent la session Achilléa ; les règles vivent dans
 * `./regles` (pures) et `./service` (base + Discord). Les refus rendent
 * `{ message }` avec 400, 403, 404 ou 409.
 */
import { Elysia, status, t } from "elysia";
import { verifyAdminBearerToken } from "@rosegriffon/achillea-core/auth";

import { dbPlugin } from "../../../plugins/db";
import { resolveAchilleaSession } from "../../auth/session";
import * as service from "./service";

const nonAuthentifie = { message: "Authentication required" };
const identifiant = t.Numeric({ minimum: 1 });

function rendre<T>(issue: service.Issue<T>) {
  return issue.ok ? issue.valeur : status(issue.statut, { message: issue.message });
}

export const interclanController = new Elysia({ prefix: "/interclans" })
  .use(dbPlugin)
  .get(
    "/",
    async ({ db, headers, query }) => {
      let clanId = query.clanId ?? null;
      if (query.mine) {
        const session = await resolveAchilleaSession(headers);
        if (!session) return status(401, nonAuthentifie);
        clanId = (await service.acteurDe(db, session.id)).clanId;
        if (clanId === null) return { data: [] };
      }
      return { data: await service.lister(db, { clanId, state: query.state ?? null, limit: query.limit ?? 25 }) };
    },
    {
      query: t.Object({
        clanId: t.Optional(identifiant),
        state: t.Optional(t.Numeric({ minimum: 0, maximum: 8 })),
        limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
        mine: t.Optional(t.BooleanString()),
      }),
    },
  )
  .get(
    "/:id",
    async ({ db, headers, params }) => {
      const session = await resolveAchilleaSession(headers);
      const acteur = session ? await service.acteurDe(db, session.id) : null;
      const detail = await service.chargerDetail(db, params.id, acteur);
      return detail ?? status(404, { message: "Cet Interclan n'existe plus ou a été supprimé." });
    },
    { params: t.Object({ id: identifiant }) },
  )
  .post(
    "/",
    async ({ db, headers, body }) => {
      const session = await resolveAchilleaSession(headers);
      if (!session) return status(401, nonAuthentifie);
      if (!body.challengedShortName && !body.challengedClanId)
        return status(400, { message: "Précisez le clan défié (sigle ou identifiant)." });
      return rendre(await service.proposer(db, session.id, body));
    },
    {
      body: t.Object({
        challengedShortName: t.Optional(t.String({ minLength: 1, maxLength: 20 })),
        challengedClanId: t.Optional(identifiant),
        date: t.String({ minLength: 4, maxLength: 40 }),
        motif: t.Optional(t.Nullable(t.String({ maxLength: 1500 }))),
      }),
    },
  )
  .post(
    "/internal/maintenance",
    async ({ db, headers, body, set }) => {
      const porteur = headers.authorization?.replace(/^Bearer\s+/i, "");
      if (!verifyAdminBearerToken(porteur, process.env.API_ADMIN_TOKEN)) {
        set.status = 401;
        return { message: "Internal authentication required" as const };
      }
      const demande = body?.now ? new Date(body.now) : new Date();
      if (Number.isNaN(demande.getTime())) {
        set.status = 400;
        return { message: "Invalid maintenance timestamp" as const };
      }
      const bilan = await service.entretenir(db, demande.getTime());
      return { success: true as const, ...bilan };
    },
    { body: t.Optional(t.Object({ now: t.Optional(t.String()) })) },
  )
  .post(
    "/matches/:lobbyId/score",
    async ({ db, headers, params, body }) => {
      const session = await resolveAchilleaSession(headers);
      if (!session) return status(401, nonAuthentifie);
      return rendre(await service.saisirScore(db, session.id, params.lobbyId, body.scoreA, body.scoreB));
    },
    {
      params: t.Object({ lobbyId: identifiant }),
      body: t.Object({ scoreA: t.Integer({ minimum: 0, maximum: 99 }), scoreB: t.Integer({ minimum: 0, maximum: 99 }) }),
    },
  )
  .post(
    "/:id/respond",
    async ({ db, headers, params, body }) => {
      const session = await resolveAchilleaSession(headers);
      if (!session) return status(401, nonAuthentifie);
      return rendre(await service.repondre(db, session.id, params.id, body.accept));
    },
    { params: t.Object({ id: identifiant }), body: t.Object({ accept: t.Boolean() }) },
  )
  .put(
    "/:id/lineups/:clanId",
    async ({ db, headers, params, body }) => {
      const session = await resolveAchilleaSession(headers);
      if (!session) return status(401, nonAuthentifie);
      return rendre(await service.composer(db, session.id, params.id, params.clanId, body.members));
    },
    {
      params: t.Object({ id: identifiant, clanId: identifiant }),
      body: t.Object({
        members: t.Array(t.Object({ userId: t.String({ pattern: "^\\s*\\d{5,25}\\s*$" }), position: t.Integer({ minimum: 1, maximum: 5 }) }), {
          maxItems: 5,
        }),
      }),
    },
  )
  .post(
    "/:id/lineups/:clanId/lock",
    async ({ db, headers, params }) => {
      const session = await resolveAchilleaSession(headers);
      if (!session) return status(401, nonAuthentifie);
      return rendre(await service.verrouiller(db, session.id, params.id, params.clanId));
    },
    { params: t.Object({ id: identifiant, clanId: identifiant }) },
  )
  .post(
    "/:id/cancel",
    async ({ db, headers, params }) => {
      const session = await resolveAchilleaSession(headers);
      if (!session) return status(401, nonAuthentifie);
      return rendre(await service.annuler(db, session.id, params.id));
    },
    { params: t.Object({ id: identifiant }) },
  )
  .post(
    "/:id/start",
    async ({ db, headers, params }) => {
      const session = await resolveAchilleaSession(headers);
      if (!session) return status(401, nonAuthentifie);
      return rendre(await service.lancer(db, session.id, params.id));
    },
    { params: t.Object({ id: identifiant }) },
  )
  .post(
    "/:id/arbitrate",
    async ({ db, headers, params, body }) => {
      const session = await resolveAchilleaSession(headers);
      if (!session) return status(401, nonAuthentifie);
      return rendre(await service.arbitrer(db, session.id, params.id, body.approve));
    },
    { params: t.Object({ id: identifiant }), body: t.Object({ approve: t.Boolean() }) },
  );
