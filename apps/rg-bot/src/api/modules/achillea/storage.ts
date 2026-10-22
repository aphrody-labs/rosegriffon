/**
 * Stockage public des images Achilléa (dépôts du site, cartes joueur,
 * affiches de clan) dans Supabase Storage — même client que les preuves
 * ranked (`createPostgresClient().storage`), bucket public distinct.
 *
 * Variables d'environnement :
 * - `SUPABASE_URL` + `SUPABASE_SECRET_KEY` (ou `SUPABASE_SERVICE_ROLE_KEY`) : requis ;
 * - `SUPABASE_STORAGE_BUCKET` : bucket public, `images` par défaut (legacy).
 */

import { createPostgresClient } from "@rosegriffon/db/postgres-client";

export const MAX_IMAGE_UPLOAD_BYTES = 6 * 1024 * 1024;
const DEFAULT_BUCKET = "images";

const MIME_EXT = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
} as const;

export type SupportedImageMime = keyof typeof MIME_EXT;

interface PublicBucket {
  upload(
    path: string,
    body: Uint8Array,
    options: { cacheControl: string; contentType: string; upsert: boolean },
  ): Promise<{ error: { message: string } | null }>;
  remove(paths: string[]): Promise<{ error: { message: string } | null }>;
  getPublicUrl(path: string): { data: { publicUrl: string } };
}

export interface ImageStorageClientLike {
  storage: { from(bucket: string): PublicBucket };
}

const ascii = (bytes: Uint8Array, start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));

/** Type réel d'une image d'après ses octets magiques (jamais d'après le client). */
export function sniffImageMime(bytes: Uint8Array): SupportedImageMime | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && ascii(bytes, 1, 4) === "PNG" && bytes[4] === 0x0d && bytes[5] === 0x0a)
    return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 6 && ["GIF87a", "GIF89a"].includes(ascii(bytes, 0, 6))) return "image/gif";
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") return "image/webp";
  return null;
}

/** Identifiant de dépôt : 24 hex (SHA-256 du contenu) + extension. */
export const IMAGE_ID_PATTERN = /^[a-f0-9]{24}\.(?:png|jpg|webp|gif)$/;

function validFolder(folder: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(folder);
}

export class PublicImageStorage {
  private readonly bucket: PublicBucket;

  constructor(bucketName: string, client: ImageStorageClientLike) {
    if (!/^[a-z0-9][a-z0-9._-]{1,62}$/i.test(bucketName)) throw new Error("SUPABASE_STORAGE_BUCKET invalide");
    this.bucket = client.storage.from(bucketName);
  }

  /** Dépose une image validée par son contenu ; l'objet est nommé par hash (idempotent). */
  async uploadImage(bytes: Uint8Array, folder: string): Promise<{ id: string; url: string; mime: SupportedImageMime }> {
    if (!validFolder(folder)) throw new Error("Dossier Storage invalide");
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_UPLOAD_BYTES)
      throw new Error(`Taille d'image invalide (maximum ${MAX_IMAGE_UPLOAD_BYTES} octets)`);
    const mime = sniffImageMime(bytes);
    if (!mime) throw new Error("Le contenu du fichier ne correspond pas à un type d'image autorisé");
    const hash = new Bun.CryptoHasher("sha256").update(bytes).digest("hex").slice(0, 24);
    const id = `${hash}.${MIME_EXT[mime]}`;
    return { ...(await this.put(`${folder}/${id}`, bytes, mime, "31536000")), id, mime };
  }

  /** Écrit un objet à un chemin choisi (cartes / affiches régénérées). */
  async put(objectKey: string, bytes: Uint8Array, contentType: string, cacheControl = "300") {
    const { error } = await this.bucket.upload(objectKey, bytes, { cacheControl, contentType, upsert: true });
    if (error) throw new Error(`Upload Supabase Storage échoué: ${error.message}`);
    return { path: objectKey, url: this.bucket.getPublicUrl(objectKey).data.publicUrl };
  }

  async deleteImage(id: string, folder: string): Promise<boolean> {
    if (!validFolder(folder) || !IMAGE_ID_PATTERN.test(id)) throw new Error("Identifiant d'image invalide");
    const { error } = await this.bucket.remove([`${folder}/${id}`]);
    return error === null;
  }
}

let configured: PublicImageStorage | null | undefined;

/** Stockage configuré par l'environnement, ou `null` si les identifiants manquent. */
export function publicImageStorage(): PublicImageStorage | null {
  if (configured !== undefined) return configured;
  const url = process.env.SUPABASE_URL ?? "";
  // Mêmes variables que `createPostgresClient` (`getSupabaseServiceRoleKey`).
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  configured =
    url && key && !key.startsWith("sb_publishable_")
      ? new PublicImageStorage(
          process.env.SUPABASE_STORAGE_BUCKET || DEFAULT_BUCKET,
          createPostgresClient() as unknown as ImageStorageClientLike,
        )
      : null;
  return configured;
}

/** Réservé aux tests : injecte (ou retire) un stockage. */
export function setPublicImageStorageForTests(storage: PublicImageStorage | null | undefined): void {
  configured = storage;
}
