/**
 * `GET /admin/ops/audit/verify` — relit toute la chaîne signée de
 * `achillea.audit_log` et rend la première entrée altérée.
 *
 * SuperAdministrateur uniquement : la relecture parcourt toute la table.
 */
import { Elysia, t } from "elysia";
import { dbPlugin } from "../../../plugins/db";
import { verifierChaineAudit } from "../audit";
import { chargerRoleEnBase, ROLE_STAFF, staff, type ChargeurRole } from "../staff";

export type OptionsVerificationAudit = {
  chargerRole?: ChargeurRole;
  verifier?: typeof verifierChaineAudit;
};

export function creerVerificationAuditController(options: OptionsVerificationAudit = {}) {
  const chargerRole = options.chargerRole ?? chargerRoleEnBase;
  const verifier = options.verifier ?? verifierChaineAudit;
  return new Elysia({ prefix: "/admin/ops/audit" }).use(dbPlugin).get(
    "/verify",
    async ({ db, headers }) => {
      const auth = await staff(db, headers, ROLE_STAFF.SuperAdministrateur, chargerRole);
      if (auth.error) return auth.error;
      return verifier(db);
    },
    {
      response: {
        200: t.Object({ valid: t.Boolean(), broken_at: t.Union([t.String(), t.Null()]), total: t.Number() }),
        401: t.Object({ message: t.String() }),
        403: t.Object({ message: t.String() }),
      },
    },
  );
}

export const verificationAuditController = creerVerificationAuditController();
