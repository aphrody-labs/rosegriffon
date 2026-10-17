import "server-only";

import { join } from "node:path";

import {
  gardeDepuisSource,
  methodesDepuisSource,
  routeDepuisFichier,
  type GardeRoute,
  type MethodeHttp,
  type RouteDerivee,
} from "./routes";

export interface RouteApi extends RouteDerivee {
  methodes: MethodeHttp[];
  garde: GardeRoute;
}

export interface InventaireRoutes {
  pages: RouteDerivee[];
  api: RouteApi[];
  /** `src` : arborescence lue ; `build` : manifeste Next ; `aucune` : rien de lisible. */
  origine: "src" | "build" | "aucune";
}

const RACINES_APP = [join(process.cwd(), "src", "app"), join(process.cwd(), "apps", "rg-website", "src", "app")];

/** Fichiers `page`/`route` de l'arborescence `app/`, avec leur source pour les routes. */
async function lireSrc(): Promise<{ fichier: string; source: string | null }[] | null> {
  for (const racine of RACINES_APP) {
    const glob = new Bun.Glob("**/{page,route}.{tsx,ts,jsx,js,mdx}");
    const sortie: { fichier: string; source: string | null }[] = [];
    try {
      for await (const fichier of glob.scan({ cwd: racine, onlyFiles: true })) {
        const chemin = fichier.replaceAll("\\", "/");
        const estRoute = /(^|\/)route\.(ts|js)$/.test(chemin);
        sortie.push({ fichier: chemin, source: estRoute ? await Bun.file(join(racine, chemin)).text() : null });
      }
    } catch {
      continue;
    }
    if (sortie.length > 0) return sortie;
  }
  return null;
}

/** Repli en production sans `src/` : le manifeste des chemins produit par `next build`. */
async function lireManifeste(): Promise<{ fichier: string; source: string | null }[] | null> {
  for (const base of [process.cwd(), join(process.cwd(), "apps", "rg-website")]) {
    const fichier = Bun.file(join(base, ".next", "server", "app-paths-manifest.json"));
    if (!(await fichier.exists())) continue;
    try {
      const manifeste = (await fichier.json()) as Record<string, string>;
      const entrees: { fichier: string; source: string | null }[] = [];
      for (const [cle, cible] of Object.entries(manifeste)) {
        const m = /^(.*)\/(page|route)$/.exec(cle);
        if (!m) continue;
        const source = m[2] === "route" ? await Bun.file(join(base, ".next", "server", cible)).text().catch(() => null) : null;
        entrees.push({ fichier: `${m[1]!.replace(/^\//, "")}/${m[2]}.ts`.replace(/^\//, ""), source });
      }
      return entrees;
    } catch {
      continue;
    }
  }
  return null;
}

let memo: { instant: number; valeur: InventaireRoutes } | null = null;

/** Inventaire des routes réelles, mis en mémoire 5 min (le disque ne change pas sans déploiement). */
export async function inventaireRoutes(): Promise<InventaireRoutes> {
  if (memo && Date.now() - memo.instant < 300_000) return memo.valeur;
  let origine: InventaireRoutes["origine"] = "src";
  let entrees = await lireSrc();
  if (!entrees) {
    origine = "build";
    entrees = await lireManifeste();
  }
  const valeur: InventaireRoutes = { pages: [], api: [], origine: entrees ? origine : "aucune" };
  for (const { fichier, source } of entrees ?? []) {
    const route = routeDepuisFichier(fichier);
    if (!route) continue;
    if (route.type === "page") {
      valeur.pages.push(route);
    } else {
      valeur.api.push({
        ...route,
        methodes: source ? methodesDepuisSource(source) : [],
        garde: source ? gardeDepuisSource(source, route.route) : "public",
      });
    }
  }
  valeur.pages.sort((a, b) => a.route.localeCompare(b.route));
  valeur.api.sort((a, b) => a.route.localeCompare(b.route));
  memo = { instant: Date.now(), valeur };
  return valeur;
}
