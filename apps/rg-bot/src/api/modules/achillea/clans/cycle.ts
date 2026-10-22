/**
 * `/clans` — cycle de vie d'un clan, servi au site, au bot Discord et à la CLI.
 *
 *   GET  /clans/fiche/:ref          fiche complète par id ou sigle (public)
 *   GET  /clans/history/:userId     carrière d'un joueur (public)
 *   POST /clans/leave               quitter son clan            { clanId? }
 *   POST /clans/:id/disband         dissoudre (Président, admin) { }
 *   POST /clans/transfer-ownership  céder la présidence          { userId }
 *   POST /clans/invites/accept      l'invité accepte             { id }
 *   POST /clans/invites/decline     l'invité refuse              { id }
 *   POST /clans/votes/:id           voter sur une proposition    { approve }
 *   POST /clans/internal/votes/expire  clôt les votes échus (jeton `API_ADMIN_TOKEN`,
 *                                   tâche `achillea:votes`)       { now? } → { success, closes }
 *
 * Aucune de ces routes ne recouvre celles de `./index` et `./management-routes` :
 * premiers segments statiques distincts (`fiche`, `history`, `leave`,
 * `transfer-ownership`, `votes`, `invites/accept|decline`) et `/:id/disband` en
 * POST, méthode que `/:id` n'a pas. Les règles vivent dans `./cycle-service`.
 */
import { Elysia, status, t } from "elysia";
import { verifyAdminBearerToken } from "@rosegriffon/achillea-core/auth";
import { dbPlugin } from "../../../plugins/db";
import { resolveAchilleaSession } from "../../auth/session";
import { developpeurs } from "../ops";
import { ClanCycleService, type EchecCycle } from "./cycle-service";

const nonAuthentifie = { success: false as const, error: "Non authentifié." };

function refus(echec: EchecCycle) {
  return status(echec.status, { success: false as const, error: echec.error });
}

const identifiantDiscord = t.String({ pattern: "^\\d{5,25}$" });

export const clanCycleController = new Elysia({ prefix: "/clans" })
  .use(dbPlugin)
  .get(
    "/fiche/:ref",
    async ({ db, params }) => {
      const fiche = await ClanCycleService.fiche(db, params.ref);
      return fiche ?? status(404, { success: false as const, error: `Aucun Clan ne correspond à « ${params.ref} ».` });
    },
    { params: t.Object({ ref: t.String({ minLength: 1, maxLength: 40 }) }) },
  )
  .get(
    "/history/:userId",
    async ({ db, params }) => {
      const carriere = await ClanCycleService.carriere(db, params.userId);
      return carriere ?? status(404, { success: false as const, error: "Ce joueur n'a pas de compte Achilléa." });
    },
    { params: t.Object({ userId: identifiantDiscord }) },
  )
  .post(
    "/leave",
    async ({ db, headers, body }) => {
      const session = await resolveAchilleaSession(headers);
      if (!session) return status(401, nonAuthentifie);
      const issue = await ClanCycleService.quitter(db, session.id, body?.clanId ?? null);
      return issue.ok ? { success: true as const, clanId: issue.clanId, clanName: issue.clanName } : refus(issue);
    },
    { body: t.Optional(t.Object({ clanId: t.Optional(t.Numeric()) })) },
  )
  .post(
    "/:id/disband",
    async ({ db, headers, params }) => {
      const session = await resolveAchilleaSession(headers);
      if (!session) return status(401, nonAuthentifie);
      const issue = await ClanCycleService.dissoudre(db, session.id, params.id);
      return issue.ok ? { success: true as const, clanId: issue.clanId, clanName: issue.clanName } : refus(issue);
    },
    { params: t.Object({ id: t.Numeric() }) },
  )
  .post(
    "/transfer-ownership",
    async ({ db, headers, body }) => {
      const session = await resolveAchilleaSession(headers);
      if (!session) return status(401, nonAuthentifie);
      const issue = await ClanCycleService.transferer(db, session.id, body.userId);
      return issue.ok ? { success: true as const, clanId: issue.clanId, clanName: issue.clanName } : refus(issue);
    },
    { body: t.Object({ userId: identifiantDiscord }) },
  )
  .post(
    "/invites/accept",
    async ({ db, headers, body }) => {
      const session = await resolveAchilleaSession(headers);
      if (!session) return status(401, nonAuthentifie);
      const issue = await ClanCycleService.accepterInvitation(db, session.id, body.id);
      return issue.ok ? { success: true as const, clanId: issue.clanId, clanName: issue.clanName } : refus(issue);
    },
    { body: t.Object({ id: t.Numeric() }) },
  )
  .post(
    "/invites/decline",
    async ({ db, headers, body }) => {
      const session = await resolveAchilleaSession(headers);
      if (!session) return status(401, nonAuthentifie);
      const issue = await ClanCycleService.refuserInvitation(db, session.id, body.id);
      return issue.ok ? { success: true as const, clanName: issue.clanName } : refus(issue);
    },
    { body: t.Object({ id: t.Numeric() }) },
  )
  .post(
    "/internal/votes/expire",
    async ({ db, headers, body, set }) => {
      const porteur = headers.authorization?.replace(/^Bearer\s+/i, "");
      if (!verifyAdminBearerToken(porteur, process.env.API_ADMIN_TOKEN)) {
        set.status = 401;
        return { message: "Internal authentication required" as const };
      }
      const maintenant = body?.now ? new Date(body.now) : new Date();
      if (Number.isNaN(maintenant.getTime())) {
        set.status = 400;
        return { message: "Invalid expiration timestamp" as const };
      }
      const { closes } = await ClanCycleService.expirerVotes(db, maintenant);
      return { success: true as const, closes };
    },
    { body: t.Optional(t.Object({ now: t.Optional(t.String({ maxLength: 40 })) })) },
  )
  .post(
    "/votes/:id",
    async ({ db, headers, params, body }) => {
      const session = await resolveAchilleaSession(headers);
      if (!session) return status(401, nonAuthentifie);
      const issue = await ClanCycleService.voter(db, session.id, params.id, body.approve, developpeurs());
      return issue.ok ? { success: true as const, ...issue.resultat } : refus(issue);
    },
    { params: t.Object({ id: t.Numeric() }), body: t.Object({ approve: t.Boolean() }) },
  );
