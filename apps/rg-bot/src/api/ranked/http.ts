/**
 * Routeur HTTP minimal des routes REST du ranked, servi par le `Bun.serve` de Colyseus.
 *
 * Remplace la couche Express (`bun-serve-express`) en gardant sa sémantique là où les
 * routes en dépendent : chemins insensibles à la casse et à la barre finale, paramètres
 * `:nom` décodés, `HEAD` servi par la route `GET`, corps JSON analysé avant la route
 * (`express.json`, 100 ko, objets et tableaux seulement), corps texte à la demande
 * (`express.text`), erreurs converties en JSON (413 → `too_large`, sinon `bad_request`).
 * Contrairement à Express, le corps arrive intact (octets bruts de la requête Bun).
 */

export interface RequeteRanked {
  method: string;
  /** Chemin et requête, tels que reçus (`/api/x?y=1`). */
  originalUrl: string;
  /** En-têtes, noms en minuscules. */
  headers: Record<string, string | undefined>;
  params: Record<string, string>;
  query: Record<string, string | undefined>;
  /** Objet JSON analysé, texte (route `texte`) ou `undefined`. */
  body: unknown;
}

export class ReponseRanked {
  readonly headers = new Headers();
  headersSent = false;
  #status = 200;
  #corps: string | Uint8Array | null = null;

  status(code: number): this {
    this.#status = code;
    return this;
  }

  setHeader(nom: string, valeur: string): this {
    this.headers.set(nom, valeur);
    return this;
  }

  json(valeur: unknown): this {
    if (!this.headers.has("content-type")) this.headers.set("content-type", "application/json; charset=utf-8");
    return this.send(JSON.stringify(valeur));
  }

  send(corps: string | Uint8Array): this {
    this.#corps = corps;
    this.headersSent = true;
    return this;
  }

  end(): this {
    this.headersSent = true;
    return this;
  }

  versResponse(sansCorps = false): Response {
    // 204/205/304 n'admettent pas de corps (le constructeur `Response` lèverait).
    const corpsInterdit = sansCorps || this.#status === 204 || this.#status === 205 || this.#status === 304;
    return new Response(corpsInterdit ? null : this.#corps, { status: this.#status, headers: this.headers });
  }
}

/** Erreur HTTP levée avant ou pendant une route (équivalent des erreurs body-parser). */
export class ErreurHttp extends Error {
  constructor(
    readonly status: number,
    readonly type?: string,
  ) {
    super(type ?? `HTTP ${status}`);
  }
}

/** Renvoyé par un gestionnaire pour laisser la requête aux routes suivantes (`next()`). */
export const PASSER = Symbol("passer");

export type Gestionnaire = (req: RequeteRanked, res: ReponseRanked) => unknown;

interface OptionsRoute {
  /** Corps lu en texte (`express.text`), plafonné à `limite` octets. */
  texte?: { limite: number };
}

interface Route {
  methode: string | null;
  segments: string[];
  prefixe: boolean;
  options: OptionsRoute;
  gestionnaire: Gestionnaire;
}

const LIMITE_JSON = 100 * 1024;

function segmentsDe(chemin: string): string[] {
  return chemin.replace(/\/+$/, "").split("/").slice(1);
}

function correspondre(route: Route, segments: string[]): Record<string, string> | null {
  if (route.prefixe ? segments.length < route.segments.length : segments.length !== route.segments.length) return null;
  const params: Record<string, string> = {};
  for (const [i, attendu] of route.segments.entries()) {
    const recu = segments[i] ?? "";
    if (attendu.startsWith(":")) {
      if (!recu) return null;
      try {
        params[attendu.slice(1)] = decodeURIComponent(recu);
      } catch {
        throw new ErreurHttp(400, "param.decode.failed");
      }
    } else if (attendu.toLowerCase() !== recu.toLowerCase()) {
      return null;
    }
  }
  return params;
}

function typeMedia(contentType: string | null): { type: string; charset: string | undefined } {
  const [type = "", ...params] = (contentType ?? "").split(";");
  const charset = params
    .map(p => p.trim().split("="))
    .find(([k]) => k?.toLowerCase() === "charset")?.[1]
    ?.replace(/^"|"$/g, "")
    .toLowerCase();
  return { type: type.trim().toLowerCase(), charset };
}

async function lireCorps(requete: Request, limite: number): Promise<Uint8Array> {
  const annonce = Number(requete.headers.get("content-length"));
  if (Number.isFinite(annonce) && annonce > limite) throw new ErreurHttp(413, "entity.too.large");
  const octets = new Uint8Array(await requete.arrayBuffer());
  if (octets.byteLength > limite) throw new ErreurHttp(413, "entity.too.large");
  return octets;
}

/** Corps analysé comme le faisaient `express.json` (global) puis `express.text` (route). */
async function analyserCorps(requete: Request, options: OptionsRoute): Promise<unknown> {
  if (requete.method === "GET" || requete.method === "HEAD" || requete.body === null) return undefined;
  const { type, charset } = typeMedia(requete.headers.get("content-type"));
  if (type === "application/json") {
    if (charset && !charset.startsWith("utf-")) throw new ErreurHttp(415, "charset.unsupported");
    const texte = new TextDecoder().decode(await lireCorps(requete, LIMITE_JSON));
    if (texte.length === 0) return {};
    if (!/^[\s]*[[{]/.test(texte)) throw new ErreurHttp(400, "entity.parse.failed");
    try {
      return JSON.parse(texte) as unknown;
    } catch {
      throw new ErreurHttp(400, "entity.parse.failed");
    }
  }
  if (!options.texte) return undefined;
  const octets = await lireCorps(requete, options.texte.limite);
  try {
    return new TextDecoder((charset ?? "utf-8") as ConstructorParameters<typeof TextDecoder>[0]).decode(octets);
  } catch {
    throw new ErreurHttp(415, "charset.unsupported");
  }
}

function enTetes(headers: Headers): Record<string, string | undefined> {
  const sortie: Record<string, string | undefined> = {};
  headers.forEach((valeur, nom) => {
    sortie[nom] = valeur;
  });
  return sortie;
}

export interface OptionsRouteur {
  /** En-têtes posés avant toute route (CORS de Colyseus, puis le middleware CORS du ranked). */
  preparer?: (req: RequeteRanked, res: ReponseRanked, requete: Request) => void;
  /** Journal des erreurs converties en réponse JSON. */
  surErreur?: (erreur: unknown) => void;
}

export class RouteurRanked {
  readonly #routes: Route[] = [];

  constructor(private readonly options: OptionsRouteur = {}) {}

  #ajouter(methode: string | null, chemin: string, prefixe: boolean, args: [OptionsRoute, Gestionnaire] | [Gestionnaire]) {
    const [options, gestionnaire] = args.length === 2 ? args : [{}, args[0]];
    this.#routes.push({ methode, segments: segmentsDe(chemin), prefixe, options, gestionnaire });
  }

  get(chemin: string, ...args: [OptionsRoute, Gestionnaire] | [Gestionnaire]): void {
    this.#ajouter("GET", chemin, false, args);
  }

  post(chemin: string, ...args: [OptionsRoute, Gestionnaire] | [Gestionnaire]): void {
    this.#ajouter("POST", chemin, false, args);
  }

  patch(chemin: string, ...args: [OptionsRoute, Gestionnaire] | [Gestionnaire]): void {
    this.#ajouter("PATCH", chemin, false, args);
  }

  delete(chemin: string, ...args: [OptionsRoute, Gestionnaire] | [Gestionnaire]): void {
    this.#ajouter("DELETE", chemin, false, args);
  }

  /** Toute méthode, tout chemin sous `prefixe` (`app.use(prefixe, …)`). */
  use(prefixe: string, gestionnaire: Gestionnaire): void {
    this.#ajouter(null, prefixe, true, [gestionnaire]);
  }

  /** Réponse de la première route qui traite la requête, ou `undefined` (laissée à Colyseus). */
  async servir(requete: Request): Promise<Response | undefined> {
    const url = new URL(requete.url);
    const segments = segmentsDe(url.pathname);
    const methode = requete.method === "HEAD" ? "GET" : requete.method;
    const res = new ReponseRanked();
    let req: RequeteRanked | null = null;
    try {
      for (const route of this.#routes) {
        if (route.methode !== null && route.methode !== methode) continue;
        const params = correspondre(route, segments);
        if (!params) continue;
        if (!req) {
          req = {
            method: requete.method,
            originalUrl: url.pathname + url.search,
            headers: enTetes(requete.headers),
            params: {},
            query: Object.fromEntries(url.searchParams),
            body: undefined,
          };
          this.options.preparer?.(req, res, requete);
          req.body = await analyserCorps(requete, route.options);
        } else if (route.options.texte && req.body === undefined && !requete.bodyUsed) {
          req.body = await analyserCorps(requete, route.options);
        }
        req.params = params;
        if ((await route.gestionnaire(req, res)) === PASSER) continue;
        return res.versResponse(requete.method === "HEAD");
      }
    } catch (erreur) {
      this.options.surErreur?.(erreur);
      if (res.headersSent) return res.versResponse(requete.method === "HEAD");
      const e = erreur instanceof ErreurHttp ? erreur : null;
      const status = e?.status ?? 500;
      const tropGros = e?.type === "entity.too.large" || status === 413;
      return res
        .status(tropGros ? 413 : status >= 400 && status < 600 ? status : 500)
        .json({ error: tropGros ? "too_large" : "bad_request" })
        .versResponse(requete.method === "HEAD");
    }
    return undefined;
  }
}
