import { describe, expect, test } from "bun:test";

import {
  gardeDepuisSource,
  methodesDepuisSource,
  pagesPubliques,
  routeDepuisFichier,
  type RouteDerivee,
} from "./routes";

describe("routeDepuisFichier", () => {
  test("page racine et groupes de routes", () => {
    expect(routeDepuisFichier("page.tsx")?.route).toBe("/");
    expect(routeDepuisFichier("(sousdossiers)/a-propos/page.tsx")?.route).toBe("/a-propos");
  });
  test("segments dynamiques et séparateurs Windows", () => {
    const r = routeDepuisFichier(["api", "admin", "users", "[id]", "route.ts"].join("\\"));
    expect(r).toMatchObject({ route: "/api/admin/users/[id]", type: "route", dynamique: true });
  });
  test("ignore dossiers privés, parallèles et autres fichiers", () => {
    expect(routeDepuisFichier("admin/_components/page.tsx")).toBeNull();
    expect(routeDepuisFichier("@modal/photo/page.tsx")).toBeNull();
    expect(routeDepuisFichier("admin/layout.tsx")).toBeNull();
  });
});

describe("methodesDepuisSource", () => {
  test("fonctions, constantes et export groupé", () => {
    const src = `export async function GET() {}\nexport const POST = async () => {};\nconst h = 1; export { h as DELETE };`;
    expect(methodesDepuisSource(src)).toEqual(["GET", "POST", "DELETE"]);
  });
  test("ne confond pas avec un nom proche", () => {
    expect(methodesDepuisSource("export function GETTER() {}")).toEqual([]);
  });
});

describe("gardeDepuisSource", () => {
  test("du plus restrictif au plus ouvert", () => {
    expect(gardeDepuisSource("await requireApiAdmin();")).toBe("admin");
    expect(gardeDepuisSource("await requireApiPatreonCreator();")).toBe("createur");
    expect(gardeDepuisSource("await requireApiAuth();")).toBe("session");
    expect(gardeDepuisSource("if (process.env.CRON_SECRET) {}")).toBe("cle");
    expect(gardeDepuisSource("return Response.json({ ok: true })")).toBe("public");
  });
  test("admin l'emporte sur clé", () => {
    expect(gardeDepuisSource("requireApiAdmin(); CRON_SECRET")).toBe("admin");
  });
});

describe("pagesPubliques", () => {
  const fixtures: RouteDerivee[] = [
    "page.tsx",
    "news/page.tsx",
    "news/[slug]/page.tsx",
    "admin/page.tsx",
    "dashboard/page.tsx",
    "api/health/route.ts",
    "(x)/a-propos/page.tsx",
  ].map(f => routeDepuisFichier(f)!);
  test("garde les pages statiques publiques, triées", () => {
    expect(pagesPubliques(fixtures)).toEqual(["/", "/a-propos", "/news"]);
  });
});
