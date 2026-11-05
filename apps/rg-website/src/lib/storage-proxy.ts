// SPDX-License-Identifier: Apache-2.0
// Relais des objets publics `/storage/v1/object/public/<bucket>/<chemin>`.
//
// Supabase Storage répond `400` à un objet absent, avec le vrai statut dans le corps :
// `{"statusCode":"404","error":"not_found","code":"NoSuchKey"}`. Une réécriture Next
// (`rewrites()`) recopie le statut amont : robots et `next/image` voyaient une requête
// invalide au lieu d'un fichier manquant. Ce relais rend `404` dans ce cas, le reste
// (corps, type, cache, validateurs) passe tel quel.

/** Buckets lourds servis depuis le disque de rg-core (`cdn.rosegriffon.fr`), qui retombe sur Supabase. */
const BUCKETS_DISQUE = new Set(["tweets", "assets"]);

const ENTETES_REQUETE = ["accept", "if-none-match", "if-modified-since", "range"] as const;
// Pas de `content-length` : `fetch` décompresse, la longueur amont ne serait plus juste.
const ENTETES_REPONSE = [
  "accept-ranges",
  "access-control-allow-origin",
  "cache-control",
  "content-range",
  "content-type",
  "etag",
  "last-modified",
] as const;

export interface OriginesStockage {
  /** `https://cdn.rosegriffon.fr` (`RG_MEDIA_PUBLIC_ORIGIN`). */
  medias: string;
  /** `NEXT_PUBLIC_SUPABASE_URL`, absent hors production. */
  supabase?: string;
}

export function urlAmontObjet(
  bucket: string,
  chemin: readonly string[],
  recherche: string,
  origines: OriginesStockage,
): string | null {
  const origine = BUCKETS_DISQUE.has(bucket) ? origines.medias : origines.supabase;
  if (!origine?.startsWith("https://") && !origine?.startsWith("http://")) return null;
  const segments = [bucket, ...chemin].map(s => encodeURIComponent(s)).join("/");
  return `${origine.replace(/\/+$/, "")}/storage/v1/object/public/${segments}${recherche}`;
}

/** Objet absent : `404` direct, ou le `400` « NoSuchKey » / `statusCode: "404"` de Supabase. */
export async function estObjetAbsent(reponse: Response): Promise<boolean> {
  if (reponse.status === 404) return true;
  if (reponse.status !== 400) return false;
  const corps = await reponse
    .clone()
    .text()
    .catch(() => "");
  try {
    const json = JSON.parse(corps) as { code?: unknown; statusCode?: unknown };
    return json.code === "NoSuchKey" || String(json.statusCode) === "404";
  } catch {
    return false;
  }
}

const CORPS_ABSENT = JSON.stringify({ error: "not_found", message: "Object not found", statusCode: "404" });

export async function relayerObjet(
  requete: Request,
  bucket: string,
  chemin: readonly string[],
  origines: OriginesStockage,
  recuperer: typeof fetch = fetch,
): Promise<Response> {
  const cible = urlAmontObjet(bucket, chemin, new URL(requete.url).search, origines);
  if (!cible) return absent();
  const entetes = new Headers();
  for (const nom of ENTETES_REQUETE) {
    const valeur = requete.headers.get(nom);
    if (valeur) entetes.set(nom, valeur);
  }
  const amont = await recuperer(cible, {
    cache: "no-store",
    headers: entetes,
    method: requete.method === "HEAD" ? "HEAD" : "GET",
    redirect: "follow",
  });
  if (await estObjetAbsent(amont)) {
    await amont.body?.cancel().catch(() => {});
    return absent();
  }
  const sortie = new Headers();
  for (const nom of ENTETES_REPONSE) {
    const valeur = amont.headers.get(nom);
    if (valeur) sortie.set(nom, valeur);
  }
  return new Response(requete.method === "HEAD" ? null : amont.body, { headers: sortie, status: amont.status });
}

function absent(): Response {
  return new Response(CORPS_ABSENT, {
    headers: {
      // Court : un objet peut être téléversé ensuite (affiches de campagne).
      "cache-control": "public, max-age=300",
      "content-type": "application/json; charset=utf-8",
    },
    status: 404,
  });
}
