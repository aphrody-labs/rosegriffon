/**
 * `/proxy` — dépôt et suppression d'images du site Achilléa (logos de clan,
 * bannières…) dans le bucket public Supabase Storage, dossier `proxy/`.
 *
 * - `POST /proxy/upload` (multipart, champ `file`) : 6 Mo max, PNG / JPEG /
 *   WebP / GIF vérifiés par octets magiques ; dédoublonné par hash MD5 du
 *   contenu (même empreinte que les lignes `image` du legacy).
 * - `GET /proxy/delete/:id` : supprime l'objet et sa ligne `image`.
 *
 * Écart avec le legacy : toute session pouvait supprimer n'importe quelle
 * image. Le déposant est désormais consigné (`tags: ["uploader:<id>"]`) et
 * seuls lui et le staff peuvent supprimer.
 */

import { Elysia, status, t } from "elysia";
import type { Generated, Kysely } from "kysely";
import type { Database } from "@rosegriffon/db/schema";
import { dbPlugin } from "../../../plugins/db";
import { journaliserAudit } from "../audit";
import { requireSession, ROLE_MODERATOR } from "../guards";
import { IMAGE_ID_PATTERN, MAX_IMAGE_UPLOAD_BYTES, publicImageStorage, sniffImageMime } from "../storage";

const FOLDER = "proxy";

export type ImageTables = {
  image: {
    id: Generated<number>;
    created_at: Generated<Date>;
    updated_at: Generated<Date>;
    file_name: string;
    base_path: string;
    url: string;
    size: number;
    tags: string[];
    hash: string;
    delete_hash: string;
  };
};

const imageDb = (db: Kysely<Database>) => db.withTables<ImageTables>();
const uploaderTag = (userId: string) => `uploader:${userId}`;
const failure = t.Object({ error: t.String(), detail: t.Optional(t.String()) });

export const proxyController = new Elysia({ prefix: "/proxy" })
  .use(dbPlugin)
  .post(
    "/upload",
    async ({ db, headers, body }) => {
      const auth = await requireSession(headers);
      if (auth.error) return auth.error;
      const file = (body as { file?: unknown } | null)?.file;
      if (!(file instanceof Blob))
        return status(400, { error: "No file uploaded", detail: "Champ multipart 'file' manquant" });
      if (file.size > MAX_IMAGE_UPLOAD_BYTES)
        return status(413, { error: "File too large", detail: `Taille max ${MAX_IMAGE_UPLOAD_BYTES / (1024 * 1024)} Mo` });
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (bytes.byteLength === 0 || !sniffImageMime(bytes))
        return status(400, { error: "Upload rejected", detail: "Type d'image non supporté (png, jpeg, webp, gif uniquement)" });
      const storage = publicImageStorage();
      if (!storage) return status(503, { error: "Image upload disabled (stockage Supabase non configuré)" });

      const images = imageDb(db);
      const hash = new Bun.CryptoHasher("md5").update(bytes).digest("hex");
      const existing = await images
        .selectFrom("image")
        .select(["file_name", "url"])
        .where("hash", "=", hash)
        .executeTakeFirst();
      if (existing) return { id: existing.file_name, url: existing.url };

      try {
        const { id, url } = await storage.uploadImage(bytes, FOLDER);
        await images
          .insertInto("image")
          .values({
            // Horodatage explicite, comme le legacy (la table n'a pas toujours de défaut).
            created_at: new Date(),
            updated_at: new Date(),
            file_name: id,
            base_path: FOLDER,
            url,
            size: bytes.byteLength,
            tags: [uploaderTag(auth.session.id)],
            hash,
            delete_hash: "",
          })
          .execute();
        return { id, url };
      } catch (err) {
        return status(500, { error: "Proxy upload failed", detail: err instanceof Error ? err.message : undefined });
      }
    },
    {
      response: {
        200: t.Object({ id: t.String(), url: t.String() }),
        400: failure,
        401: t.Object({ message: t.String() }),
        413: failure,
        500: failure,
        503: failure,
      },
    },
  )
  .get(
    "/delete/:id",
    async ({ db, headers, params: { id } }) => {
      const auth = await requireSession(headers);
      if (auth.error) return auth.error;
      if (!IMAGE_ID_PATTERN.test(id)) return status(400, { error: "Invalid image id" });
      const images = imageDb(db);
      const row = await images
        .selectFrom("image")
        .select(["tags"])
        .where("file_name", "=", id)
        .where("base_path", "=", FOLDER)
        .executeTakeFirst();
      if (!row) return status(404, { error: "Image introuvable" });
      if (!row.tags?.includes(uploaderTag(auth.session.id))) {
        const actor = await db.selectFrom("user").select("role").where("id", "=", auth.session.id).executeTakeFirst();
        if ((actor?.role ?? 0) < ROLE_MODERATOR) return status(403, { error: "Réservé au déposant ou au staff" });
      }
      const storage = publicImageStorage();
      if (!storage) return status(503, { error: "Image deletion disabled (stockage Supabase non configuré)" });
      try {
        const ok = await storage.deleteImage(id, FOLDER);
        if (ok)
          await images.transaction().execute(async trx => {
            await trx.deleteFrom("image").where("file_name", "=", id).where("base_path", "=", FOLDER).execute();
            await journaliserAudit(trx as unknown as Kysely<Database>, {
              acteur: auth.session.id,
              action: "image.delete",
              cibleType: "image",
              cibleId: id,
              charge: { folder: FOLDER, uploader: row.tags?.find(tag => tag.startsWith("uploader:"))?.slice(9) ?? null },
            });
          });
        return { success: ok };
      } catch (err) {
        return status(500, { error: "Proxy delete failed", detail: err instanceof Error ? err.message : undefined });
      }
    },
    {
      params: t.Object({ id: t.String({ maxLength: 64 }) }),
      response: {
        200: t.Object({ success: t.Boolean() }),
        400: failure,
        401: t.Object({ message: t.String() }),
        403: failure,
        404: failure,
        500: failure,
        503: failure,
      },
    },
  );
