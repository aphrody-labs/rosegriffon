/**
 * `/blacklist` — liste noire Achilléa.
 *
 *   GET    /blacklist            liste publique (comme `/blacklist` sur Discord)
 *   GET    /blacklist/:userId    statut d'un joueur (`entry: null` s'il n'y est pas)
 *   POST   /blacklist/:userId    inscription { reason } — Administrateur
 *   DELETE /blacklist/:userId    retrait — Administrateur
 *
 * Le dépôt est injectable (`creerControleurListeNoire`) : les tests de route
 * tournent sans Postgres.
 */
import { Elysia, status, t } from "elysia";
import type { Kysely } from "kysely";
import type { Database } from "@rosegriffon/db/schema";

import { dbPlugin } from "../../../plugins/db";
import { resolveAchilleaSession } from "../../auth/session";
import { developpeurs } from "../ops";
import { ajouterListeNoire, depotKysely, retirerListeNoire, type DepotListeNoire } from "./service";

const entree = t.Object({
  userId: t.String(),
  username: t.Nullable(t.String()),
  displayName: t.String(),
  reason: t.String(),
  since: t.String(),
});
const identifiant = t.Object({ userId: t.String({ pattern: "^\\d{5,25}$" }) });

export function creerControleurListeNoire(
  depotDe: (db: Kysely<Database>) => DepotListeNoire = depotKysely,
  devs: () => readonly string[] = () => developpeurs(),
) {
  return new Elysia({ prefix: "/blacklist" })
    .use(dbPlugin)
    .get("/", async ({ db }) => ({ data: await depotDe(db).lister() }), {
      response: { 200: t.Object({ data: t.Array(entree) }) },
    })
    .get(
      "/:userId",
      async ({ db, params }) => {
        const depot = depotDe(db);
        const joueur = await depot.joueur(params.userId);
        if (!joueur) return status(404, { message: "Ce joueur n'a pas de compte Achilléa." });
        return { userId: params.userId, entry: await depot.entree(params.userId) };
      },
      { params: identifiant },
    )
    .post(
      "/:userId",
      async ({ db, headers, params, body }) => {
        const session = await resolveAchilleaSession(headers);
        if (!session) return status(401, { message: "Authentication required" });
        const issue = await ajouterListeNoire(depotDe(db), session.id, params.userId, body.reason, devs());
        return issue.ok ? issue.valeur : status(issue.statut, { message: issue.message });
      },
      { params: identifiant, body: t.Object({ reason: t.String() }) },
    )
    .delete(
      "/:userId",
      async ({ db, headers, params }) => {
        const session = await resolveAchilleaSession(headers);
        if (!session) return status(401, { message: "Authentication required" });
        const issue = await retirerListeNoire(depotDe(db), session.id, params.userId);
        return issue.ok ? { success: true, userId: issue.valeur.userId } : status(issue.statut, { message: issue.message });
      },
      { params: identifiant },
    );
}

/** `/blacklist` — liste noire. */
export const blacklistController = creerControleurListeNoire();
