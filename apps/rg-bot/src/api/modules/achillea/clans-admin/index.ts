/**
 * `GET /admin/clans` — liste des clans pour le back-office (staff, rôle 1+).
 *
 * Projection complète, clans masqués et inactifs compris, filtre par état de
 * validation et recherche par nom ou tag. L'édition passe par `PATCH /clans/:id`,
 * qui réserve inactivité et masquage aux administrateurs.
 */
import { Elysia, t } from "elysia";
import { dbPlugin } from "../../../plugins/db";
import { ClanModel } from "../clans/model";
import { ClanService } from "../clans/service";
import { chargerRoleEnBase, ROLE_STAFF, staff, type ChargeurRole } from "../staff";

export function creerClansAdminController(options: { chargerRole?: ChargeurRole } = {}) {
  const chargerRole = options.chargerRole ?? chargerRoleEnBase;
  return new Elysia({ prefix: "/admin/clans" }).use(dbPlugin).get(
    "/",
    async ({ db, headers, query }) => {
      const auth = await staff(db, headers, ROLE_STAFF.Moderateur, chargerRole);
      if (auth.error) return auth.error;
      return ClanService.adminList(db, query);
    },
    {
      query: t.Object({
        state: t.Optional(t.Numeric({ minimum: 0, maximum: 10 })),
        page: t.Optional(t.Numeric({ minimum: 1 })),
        pageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 50 })),
        q: t.Optional(t.String({ maxLength: 60 })),
      }),
      response: {
        200: t.Object({
          data: t.Array(ClanModel.fullClan),
          meta: t.Object({ page: t.Number(), limit: t.Number(), total: t.Number(), pageCount: t.Number() }),
        }),
        401: t.Object({ message: t.String() }),
        403: t.Object({ message: t.String() }),
      },
    },
  );
}

export const clansAdminController = creerClansAdminController();
