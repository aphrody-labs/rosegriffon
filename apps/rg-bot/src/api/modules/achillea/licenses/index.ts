import { Elysia, status, t } from "elysia";
import { dbPlugin } from "../../../plugins/db";
import { LicenseModel } from "./model";
import { LicenseService, LicenseUserNotFoundError } from "./service";
import { resolveAchilleaSession } from "../../auth/session";
import { requireRole, ROLE_ADMINISTRATOR } from "../guards";
import { renderLicensePdf } from "./pdf";

const LICENSE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const message = t.Object({ message: t.String() });

export const licenseController = new Elysia({ prefix: "/licenses" })
  .use(dbPlugin)
  .get(
    "/me",
    async ({ db, headers }) => {
      const session = await resolveAchilleaSession(headers);
      if (!session) return status(401, { message: "Authentication required" as const });
      return LicenseService.findLatestForUser(db, session.id);
    },
    {
      response: {
        200: LicenseModel.me,
        401: t.Object({ message: t.Literal("Authentication required") }),
      },
    },
  )
  .get(
    "/verify/:qrSecret",
    async ({ db, params: { qrSecret } }) => {
      if (qrSecret.length < 32 || qrSecret.length > 64)
        return status(200, { valid: false, reason: "not_found" as const });
      return LicenseService.verify(db, qrSecret);
    },
    {
      params: t.Object({ qrSecret: t.String({ minLength: 1, maxLength: 128 }) }),
      response: { 200: LicenseModel.verify },
    },
  )
  .post(
    "/issue/:userId",
    async ({ db, headers, params: { userId } }) => {
      const auth = await requireRole(db, headers, ROLE_ADMINISTRATOR);
      if (auth.error) return auth.error;
      try {
        return status(201, await LicenseService.issue(db, userId.trim(), auth.session.id));
      } catch (err) {
        if (err instanceof LicenseUserNotFoundError) return status(404, { message: err.message });
        throw err;
      }
    },
    {
      params: t.Object({ userId: t.String({ pattern: "^\\s*\\d{5,24}\\s*$" }) }),
      response: { 201: LicenseModel.license, 401: message, 403: message, 404: message },
    },
  )
  .post(
    "/:id/revoke",
    async ({ db, headers, params: { id } }) => {
      const auth = await requireRole(db, headers, ROLE_ADMINISTRATOR);
      if (auth.error) return auth.error;
      const license = LICENSE_ID.test(id) ? await LicenseService.revoke(db, id, auth.session.id) : null;
      return license ?? status(404, { message: `Licence ${id} introuvable` });
    },
    {
      params: t.Object({ id: t.String({ maxLength: 64 }) }),
      response: { 200: LicenseModel.license, 401: message, 403: message, 404: message },
    },
  )
  // `/:id.pdf` : le routeur n'accepte pas de suffixe après un paramètre, on
  // capte `/:id` et on exige l'extension. Route publique : l'UUID v4 (122 bits)
  // n'est pas énumérable, et le PDF ne contient que ce que le porteur imprime.
  .get(
    "/:id",
    async ({ db, params: { id } }) => {
      const licenseId = id.endsWith(".pdf") ? id.slice(0, -4) : "";
      if (!LICENSE_ID.test(licenseId)) return status(404, { message: "PDF introuvable" });
      const input = await LicenseService.pdfInput(db, licenseId);
      if (!input) return status(404, { message: "PDF introuvable" });
      const pdf = await renderLicensePdf(input);
      return new Response(new Uint8Array(pdf), {
        headers: {
          "content-type": "application/pdf",
          "content-disposition": `inline; filename="licence-${licenseId}.pdf"`,
          "cache-control": "private, max-age=60",
        },
      });
    },
    { params: t.Object({ id: t.String({ maxLength: 64 }) }) },
  );
