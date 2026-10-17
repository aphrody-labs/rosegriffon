/**
 * Dérivation des routes du site depuis l'arborescence `app/` — module PUR.
 *
 * Aucune E/S : il reçoit des chemins de fichiers (et, au besoin, leur source)
 * et rend des routes. La lecture du disque vit dans `routes-systeme.ts`, ce qui
 * permet de tester la dérivation avec des fixtures locales.
 */

export type GardeRoute = "public" | "session" | "admin" | "cle" | "createur";

export const METHODES_HTTP = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;
export type MethodeHttp = (typeof METHODES_HTTP)[number];

export interface RouteDerivee {
  /** Chemin d'URL, ex. `/api/admin/users/[id]`. */
  route: string;
  type: "page" | "route";
  /** Fichier source relatif à `app/`. */
  fichier: string;
  dynamique: boolean;
}

/**
 * Route d'URL d'un fichier `page.tsx` / `route.ts`, ou `null` pour tout autre
 * fichier. Les groupes `(x)` disparaissent de l'URL ; les dossiers privés
 * `_x` et les routes parallèles `@x` n'en forment pas.
 */
export function routeDepuisFichier(fichier: string): RouteDerivee | null {
  const normalise = fichier.replaceAll("\\", "/").replace(/^\/+/, "");
  const correspondance = /^(.*?)\/?(page\.(?:tsx|ts|jsx|js|mdx)|route\.(?:ts|js))$/.exec(normalise);
  if (!correspondance) return null;
  const segments = (correspondance[1] ?? "").split("/").filter(Boolean);
  if (segments.some(s => s.startsWith("_") || s.startsWith("@"))) return null;
  const visibles = segments.filter(s => !/^\(.*\)$/.test(s));
  const route = `/${visibles.join("/")}`;
  return {
    route,
    type: correspondance[2]!.startsWith("page.") ? "page" : "route",
    fichier: normalise,
    dynamique: visibles.some(s => s.includes("[")),
  };
}

/** Méthodes HTTP exportées par un fichier `route.ts`. */
export function methodesDepuisSource(source: string): MethodeHttp[] {
  const trouvees = new Set<MethodeHttp>();
  for (const m of source.matchAll(/export\s+(?:async\s+)?(?:function|const)\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g)) {
    trouvees.add(m[1] as MethodeHttp);
  }
  for (const m of source.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const nom of m[1]!.split(",")) {
      const brut = nom.trim().split(/\s+as\s+/).pop()!;
      if ((METHODES_HTTP as readonly string[]).includes(brut)) trouvees.add(brut as MethodeHttp);
    }
  }
  return METHODES_HTTP.filter(m => trouvees.has(m));
}

/**
 * Garde d'une route, déduite de sa source. C'est une heuristique, volontairement
 * prudente : l'ordre va du plus restrictif au plus ouvert, et une route qui
 * n'appelle aucune garde connue est déclarée « public ».
 */
export function gardeDepuisSource(source: string, route = ""): GardeRoute {
  if (/requireApiAdmin|requireAdmin(?:OrFail)?\b|requireEditorOrFail|isAdmin\(/.test(source)) return "admin";
  if (/requireApiPatreonCreator|requirePatreonCreator/.test(source)) return "createur";
  if (/requireApiAuth|requireAuth(?:OrFail)?\b|getServerSession|getServerUser|auth\.api\.getSession/.test(source)) {
    return "session";
  }
  if (
    /CRON_SECRET|CLAUDE_API_KEY|[A-Z_]*API_KEY|WEBHOOK_SECRET|SIGNING_SECRET|timingSafeEqual|["']authorization["']|["']x-[a-z-]*(?:secret|signature|token)["']/i.test(
      source,
    )
  ) {
    return "cle";
  }
  // Better Auth gère lui-même l'authentification de ses sous-routes.
  if (route.startsWith("/api/auth/")) return "public";
  return "public";
}

export const LIBELLES_GARDE: Record<GardeRoute, string> = {
  admin: "Admin",
  cle: "Clé / secret",
  createur: "Créateur Patreon",
  public: "Public",
  session: "Session",
};

/** Préfixes de pages qui ne sont jamais des pages publiques à sonder. */
const PREFIXES_NON_PUBLICS = ["/admin", "/dashboard", "/api", "/auth", "/profil", "/settings", "/login", "/onboarding"];

/** Pages statiques (sans segment dynamique) accessibles sans connexion. */
export function pagesPubliques(routes: readonly RouteDerivee[]): string[] {
  const chemins = new Set<string>();
  for (const r of routes) {
    if (r.type !== "page" || r.dynamique) continue;
    if (PREFIXES_NON_PUBLICS.some(p => r.route === p || r.route.startsWith(`${p}/`))) continue;
    chemins.add(r.route);
  }
  return [...chemins].sort();
}
