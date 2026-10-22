import { sql, type Kysely, type Selectable } from "kysely";
import type { Database, LicenseTable } from "@rosegriffon/db/schema";
import { formatLicenseNumber, generateQrSecret, LICENSE_VALIDITY_MS } from "@rosegriffon/achillea-core/licenses";
import { LicenseStatus } from "@rosegriffon/achillea-core/enums";
import { resolveDiscordAvatarUrl } from "@rosegriffon/achillea-core/identity";
import { journaliserAudit } from "../audit";

type LicenseRow = Selectable<LicenseTable>;

/** Base publique des routes Achilléa (relais `/api` de `rg-core`), pour `pdf_url`. */
export function publicApiBase(): string {
  return (process.env.ACHILLEA_PUBLIC_API_URL ?? "https://ranked.rosegriffon.fr/api").replace(/\/+$/, "");
}

export function toLicenseDto(row: LicenseRow) {
  return {
    id: row.id,
    userId: row.user_id,
    licenseNumber: row.license_number,
    issuedAt: row.issued_at.toISOString(),
    validUntil: row.valid_until.toISOString(),
    status: row.status,
    pdfUrl: row.pdf_url,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export class LicenseUserNotFoundError extends Error {}

export abstract class LicenseService {
  /**
   * Émet une licence : numéro `ACH-{année}-{séquence}`, secret QR de 256 bits,
   * validité d'un an. La séquence est prise sous verrou consultatif
   * transactionnel : deux émissions simultanées ne tirent plus le même numéro
   * (le legacy comptait sans verrou).
   */
  static async issue(db: Kysely<Database>, userId: string, actorId: string, now = new Date()) {
    return db.transaction().execute(async trx => {
      const user = await trx.selectFrom("user").select("id").where("id", "=", userId).executeTakeFirst();
      if (!user) throw new LicenseUserNotFoundError(`Utilisateur ${userId} introuvable`);
      const year = now.getUTCFullYear();
      await sql`SELECT pg_advisory_xact_lock(hashtext(${`achillea-license-${year}`}))`.execute(trx);
      const count = await trx
        .selectFrom("license")
        .select(({ fn }) => fn.countAll<string>().as("count"))
        .where("issued_at", ">=", new Date(Date.UTC(year, 0, 1)))
        .where("issued_at", "<", new Date(Date.UTC(year + 1, 0, 1)))
        .executeTakeFirstOrThrow();
      const inserted = await trx
        .insertInto("license")
        .values({
          user_id: userId,
          license_number: formatLicenseNumber(year, Number(count.count) + 1),
          issued_at: now,
          valid_until: new Date(now.getTime() + LICENSE_VALIDITY_MS),
          status: LicenseStatus.Active,
          pdf_url: null,
          qr_secret: generateQrSecret(),
        })
        .returning("id")
        .executeTakeFirstOrThrow();
      const row = await trx
        .updateTable("license")
        .set({ pdf_url: `${publicApiBase()}/licenses/${inserted.id}.pdf`, updated_at: now })
        .where("id", "=", inserted.id)
        .returningAll()
        .executeTakeFirstOrThrow();
      await journaliserAudit(trx, {
        acteur: actorId,
        action: "license.issue",
        cibleType: "license",
        cibleId: row.id,
        charge: { userId, licenseNumber: row.license_number, validUntil: row.valid_until.toISOString() },
      });
      return toLicenseDto(row);
    });
  }

  static async revoke(db: Kysely<Database>, id: string, actorId: string) {
    return db.transaction().execute(async trx => {
      const row = await trx
        .updateTable("license")
        .set({ status: LicenseStatus.Revoked, updated_at: new Date() })
        .where("id", "=", id)
        .returningAll()
        .executeTakeFirst();
      if (!row) return null;
      await journaliserAudit(trx, {
        acteur: actorId,
        action: "license.revoke",
        cibleType: "license",
        cibleId: row.id,
        charge: { userId: row.user_id, licenseNumber: row.license_number },
      });
      return toLicenseDto(row);
    });
  }

  /** Données du PDF : licence + porteur ; le statut tient compte de l'expiration. */
  static async pdfInput(db: Kysely<Database>, id: string) {
    const row = await db
      .selectFrom("license")
      .innerJoin("user", "user.id", "license.user_id")
      .select([
        "license.license_number",
        "license.qr_secret",
        "license.issued_at",
        "license.valid_until",
        "license.status",
        "user.id as user_id",
        "user.display_name",
        "user.username",
        "user.avatar",
      ])
      .where("license.id", "=", id)
      .executeTakeFirst();
    if (!row) return null;
    const expired = row.status === LicenseStatus.Active && row.valid_until.getTime() <= Date.now();
    return {
      licenseNumber: row.license_number,
      qrSecret: row.qr_secret,
      issuedAt: row.issued_at,
      validUntil: row.valid_until,
      status: expired ? LicenseStatus.Expired : row.status,
      holder: {
        displayName: row.display_name || row.username || `User#${row.user_id}`,
        avatar: resolveDiscordAvatarUrl(row.user_id, row.avatar, 256).replace(/\.(webp|gif)\?/, ".png?"),
      },
    };
  }

  static async findLatestForUser(db: Kysely<Database>, userId: string) {
    const row = await db
      .selectFrom("license")
      .selectAll()
      .where("user_id", "=", userId)
      .orderBy("issued_at", "desc")
      .executeTakeFirst();
    if (!row) return { license: null, verificationToken: null };
    return {
      license: {
        id: row.id,
        userId: row.user_id,
        licenseNumber: row.license_number,
        issuedAt: row.issued_at.toISOString(),
        validUntil: row.valid_until.toISOString(),
        status: row.status,
        pdfUrl: row.pdf_url,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
      },
      // This token is a public-verification bearer secret. It is returned only
      // by the authenticated /me endpoint to the license owner.
      verificationToken: row.qr_secret,
    };
  }

  static async verify(db: Kysely<Database>, qrSecret: string) {
    const row = await db
      .selectFrom("license")
      .innerJoin("user", "user.id", "license.user_id")
      .select([
        "license.license_number",
        "license.valid_until",
        "license.status",
        "license.qr_secret",
        "user.display_name",
        "user.username",
        "user.avatar",
      ])
      .where("license.qr_secret", "=", qrSecret)
      .executeTakeFirst();
    if (!row) return { valid: false as const, reason: "not_found" as const };
    if (row.status === "Revoked")
      return {
        valid: false as const,
        reason: "revoked" as const,
        licenseNumber: row.license_number,
      };
    if (row.status === "Expired" || row.valid_until.getTime() <= Date.now()) {
      return {
        valid: false as const,
        reason: "expired" as const,
        licenseNumber: row.license_number,
      };
    }
    return {
      valid: true as const,
      licenseNumber: row.license_number,
      validUntil: row.valid_until.toISOString(),
      holder: { displayName: row.display_name || row.username || "Inconnu", avatar: row.avatar },
    };
  }
}
