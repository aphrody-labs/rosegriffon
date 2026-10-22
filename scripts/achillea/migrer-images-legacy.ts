#!/usr/bin/env bun
/**
 * Rapatrie les images Achilléa encore référencées par une URL morte.
 *
 * ── LE DÉFAUT ──────────────────────────────────────────────────────────────
 * Les avatars de clan, la table `image` et les captures de litige pointent vers
 * `https://achillea.rosegriffon.fr/storage/v1/object/public/images/<nom>`. Ce
 * domaine redirige désormais vers `rosegriffon.fr/achillea` : chaque image répond
 * 404 (59 avatars de clan sur 69, constaté le 22/10/2026). Les octets existent
 * toujours dans le bucket PUBLIC `images` de l'ancien projet Supabase Cloud
 * d'Achilléa (`yftdclwvehxxffwqvhmc`), dont les clés ont été révoquées : on les
 * relit par leur URL publique, on ne liste rien.
 *
 * ── CE QUE FAIT LE SCRIPT ──────────────────────────────────────────────────
 *  1. relève en base toutes les URL mortes (avatars, `image.url`, captures) ;
 *  2. télécharge chaque objet depuis l'ancien projet, vérifie qu'il s'agit d'une
 *     image (magic bytes), et le dépose sous le MÊME nom dans le bucket `images`
 *     du projet courant (`SUPABASE_URL`) — sans écraser un objet déjà présent ;
 *  3. seulement si TOUS les dépôts ont réussi, réécrit les URL en une
 *     transaction, et consigne l'opération dans le journal d'audit.
 *
 * Simulation par défaut (aucune écriture). `--execute` pour agir. Rejouable :
 * un objet déjà présent avec la même taille est compté comme migré.
 *
 * Variables : `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (ou
 * `SUPABASE_SERVICE_ROLE_KEY`). Aucune valeur n'est affichée.
 */
import { SQL } from "bun";

export const PREFIXE_MORT = "https://achillea.rosegriffon.fr/storage/v1/object/public/images/";
export const ORIGINE_SOURCE = "https://yftdclwvehxxffwqvhmc.supabase.co/storage/v1/object/public/images/";
export const BUCKET = "images";

/** Nom d'objet d'une URL morte, ou `null` si l'URL n'en est pas une (ou est ambiguë). */
export function nomObjet(url: string): string | null {
  if (!url.startsWith(PREFIXE_MORT)) return null;
  const nom = decodeURIComponent(url.slice(PREFIXE_MORT.length).split(/[?#]/)[0]!);
  if (nom === "" || nom.includes("..") || nom.startsWith("/") || /[\\\0]/.test(nom)) return null;
  return nom;
}

/** URL morte d'un nom d'objet (inverse de `nomObjet`). */
export function urlMorte(nom: string): string {
  return PREFIXE_MORT + nom.split("/").map(encodeURIComponent).join("/");
}

/** URL publique du même objet dans le projet courant. */
export function urlCible(supabaseUrl: string, nom: string): string {
  const chemin = nom.split("/").map(encodeURIComponent).join("/");
  return `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/${BUCKET}/${chemin}`;
}

/** Type MIME d'après les premiers octets ; `null` si ce n'est pas une image acceptée. */
export function typeImage(octets: Uint8Array): string | null {
  const commence = (...signature: number[]) => signature.every((o, i) => octets[i] === o);
  if (commence(0x89, 0x50, 0x4e, 0x47)) return "image/png";
  if (commence(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (commence(0x47, 0x49, 0x46, 0x38)) return "image/gif";
  if (commence(0x52, 0x49, 0x46, 0x46) && octets[8] === 0x57 && octets[9] === 0x45 && octets[10] === 0x42 && octets[11] === 0x50)
    return "image/webp";
  return null;
}

interface Contexte {
  sql: SQL;
  supabaseUrl: string;
  cle: string;
  executer: boolean;
}

/** Toutes les URL mortes encore référencées, dédoublonnées. */
async function urlsMortes(sql: SQL): Promise<string[]> {
  const lignes = (await sql`
    SELECT DISTINCT u FROM (
      SELECT clan_avatar_url AS u FROM achillea.clan
      UNION ALL SELECT url FROM achillea.image
      UNION ALL SELECT screenshot_url FROM achillea.lobby_user
    ) x WHERE u LIKE ${`${PREFIXE_MORT}%`}`) as Array<{ u: string }>;
  return lignes.map(l => l.u);
}

/** Taille d'un objet déjà présent dans la cible, `null` s'il n'y est pas. */
async function tailleCible(ctx: Contexte, nom: string): Promise<number | null> {
  const reponse = await fetch(urlCible(ctx.supabaseUrl, nom), { method: "HEAD" });
  if (reponse.status === 404 || reponse.status === 400) return null;
  if (!reponse.ok) throw new Error(`HEAD cible ${reponse.status}`);
  return Number(reponse.headers.get("content-length") ?? "-1");
}

/** Plafond du bucket `images` (`storage.buckets.file_size_limit`, aussi celui de l'upload de l'API). */
export const TAILLE_MAX_OBJET = 6 * 1024 * 1024;

/** Nom de l'objet réencodé en WebP (même base, extension remplacée). */
export function nomWebp(nom: string): string {
  return `${nom.replace(/\.[^./]+$/, "")}.webp`;
}

/**
 * Réencode une image trop lourde pour le bucket : WebP, 2048 px au plus sur le grand
 * côté, qualité décroissante jusqu'à passer sous le plafond.
 */
export async function reduireImage(octets: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
  for (const qualite of [85, 75, 60]) {
    const sortie = await new Bun.Image(octets)
      .resize(2048, 2048, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: qualite })
      .bytes();
    if (sortie.byteLength <= TAILLE_MAX_OBJET) return new Uint8Array(sortie);
  }
  throw new Error("image encore trop lourde après réencodage WebP");
}

/** Objets déposés sous un autre nom que la source (réencodés), pour la réécriture des URL. */
const renommes = new Map<string, string>();

async function migrerObjet(ctx: Contexte, nomSource: string): Promise<"copie" | "deja" | "simule"> {
  const source = await fetch(ORIGINE_SOURCE + nomSource.split("/").map(encodeURIComponent).join("/"));
  if (!source.ok) throw new Error(`source ${source.status}`);
  let octets: Uint8Array<ArrayBuffer> = new Uint8Array(await source.arrayBuffer());
  let mime = typeImage(octets);
  if (!mime) throw new Error("contenu qui n'est pas une image (magic bytes)");
  let nom = nomSource;
  if (octets.byteLength > TAILLE_MAX_OBJET) {
    octets = await reduireImage(octets);
    mime = "image/webp";
    nom = nomWebp(nomSource);
    renommes.set(nomSource, nom);
  }

  const existante = await tailleCible(ctx, nom);
  if (existante === octets.byteLength) return "deja";
  if (existante !== null) throw new Error(`un objet différent (${existante} o) occupe déjà ce nom dans la cible`);
  if (!ctx.executer) return "simule";

  const depot = await fetch(
    `${ctx.supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/${BUCKET}/${nom.split("/").map(encodeURIComponent).join("/")}`,
    {
      method: "POST",
      headers: {
        apikey: ctx.cle,
        Authorization: `Bearer ${ctx.cle}`,
        "Content-Type": mime,
        "Cache-Control": "max-age=31536000",
        "x-upsert": "false",
      },
      body: octets,
    },
  );
  if (!depot.ok) throw new Error(`dépôt ${depot.status} : ${(await depot.text()).slice(0, 160)}`);
  if ((await tailleCible(ctx, nom)) !== octets.byteLength) throw new Error("objet relu avec une taille différente");
  return "copie";
}

async function reecrireUrls(ctx: Contexte, noms: Map<string, string>): Promise<Record<string, number>> {
  const ancien = PREFIXE_MORT;
  const nouveau = urlCible(ctx.supabaseUrl, "");
  return ctx.sql.begin(async tx => {
    // Les tables d'Achilléa portent la RLS de leur ancienne base (cf. `tasks/achillea-sync.ts`).
    await tx`SET LOCAL ROLE service_role`;
    // Objets réencodés : leur nom a changé, l'URL est remplacée en entier avant le préfixe.
    for (const [nomSource, nomCible] of renommes) {
      const avant = urlMorte(nomSource);
      const apres = urlCible(ctx.supabaseUrl, nomCible);
      await tx`UPDATE achillea.clan SET clan_avatar_url = ${apres}, updated_at = now() WHERE clan_avatar_url = ${avant}`;
      await tx`UPDATE achillea.image SET url = ${apres} WHERE url = ${avant}`;
      await tx`UPDATE achillea.lobby_user SET screenshot_url = ${apres} WHERE screenshot_url = ${avant}`;
    }
    const clans = await tx`UPDATE achillea.clan SET clan_avatar_url = replace(clan_avatar_url, ${ancien}, ${nouveau}), updated_at = now()
                            WHERE clan_avatar_url LIKE ${`${ancien}%`} RETURNING id`;
    const images = await tx`UPDATE achillea.image SET url = replace(url, ${ancien}, ${nouveau})
                             WHERE url LIKE ${`${ancien}%`} RETURNING id`;
    const captures = await tx`UPDATE achillea.lobby_user SET screenshot_url = replace(screenshot_url, ${ancien}, ${nouveau})
                               WHERE screenshot_url LIKE ${`${ancien}%`} RETURNING lobby_id`;
    const bilan = { clans: clans.length, images: images.length, captures: captures.length, objets: noms.size };
    // Même chaîne signée que l'API (`apps/rg-bot/src/api/modules/achillea/audit.ts`).
    const { signatureAudit } = await import("../../apps/rg-bot/src/api/modules/achillea/audit");
    const [tete] = (await tx`SELECT signature FROM achillea.audit_log ORDER BY ts DESC, id DESC LIMIT 1 FOR UPDATE`) as Array<{ signature: string }>;
    const ts = new Date();
    const charge = { ...bilan, depuis: ancien, vers: nouveau };
    const signature = signatureAudit(tete?.signature ?? null, {
      actor_id: null,
      action: "storage.migrate",
      target_type: "storage",
      target_id: BUCKET,
      payload: charge,
      ts,
    });
    await tx`INSERT INTO achillea.audit_log (actor_id, action, target_type, target_id, payload, reason, ts, prev_signature, signature)
             VALUES (null, 'storage.migrate', 'storage', ${BUCKET}, ${JSON.stringify(charge)}::jsonb,
                     'Images rapatriées depuis l''ancien projet Supabase d''Achilléa', ${ts}, ${tete?.signature ?? null}, ${signature})`;
    return bilan;
  });
}

async function principal(): Promise<number> {
  const executer = process.argv.includes("--execute");
  const supabaseUrl = (Bun.env.SUPABASE_URL ?? "").trim();
  const cle = (Bun.env.SUPABASE_SECRET_KEY || Bun.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const base = (Bun.env.DATABASE_URL ?? "").trim();
  if (!supabaseUrl || !cle || !base) {
    console.error("DATABASE_URL, SUPABASE_URL et SUPABASE_SECRET_KEY (ou SUPABASE_SERVICE_ROLE_KEY) sont requis.");
    return 2;
  }
  const sql = new SQL({ url: base, max: 2 });
  const ctx: Contexte = { sql, supabaseUrl, cle, executer };
  try {
    const urls = await urlsMortes(sql);
    const noms = new Map<string, string>();
    for (const url of urls) {
      const nom = nomObjet(url);
      if (!nom) throw new Error(`URL non reconnue, migration arrêtée : ${url}`);
      noms.set(url, nom);
    }
    console.info(`${noms.size} objet(s) référencé(s) par une URL morte — ${executer ? "EXÉCUTION" : "simulation"}`);

    const bilan = { copie: 0, deja: 0, simule: 0 };
    const echecs: string[] = [];
    for (const nom of new Set(noms.values())) {
      try {
        bilan[await migrerObjet(ctx, nom)]++;
      } catch (err) {
        echecs.push(`${nom} : ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    console.info(`copiés ${bilan.copie}, déjà présents ${bilan.deja}, à copier ${bilan.simule}, échecs ${echecs.length}`);
    for (const echec of echecs) console.error(`  ✗ ${echec}`);
    if (echecs.length > 0) {
      console.error("Des objets n'ont pas pu être copiés : aucune URL n'est réécrite.");
      return 1;
    }
    if (!executer) {
      console.info("Simulation terminée. Relancer avec --execute pour copier et réécrire les URL.");
      return 0;
    }
    const reecrit = await reecrireUrls(ctx, noms);
    console.info(`URL réécrites : ${JSON.stringify(reecrit)}`);
    return 0;
  } finally {
    await sql.close();
  }
}

if (import.meta.main) process.exit(await principal());
