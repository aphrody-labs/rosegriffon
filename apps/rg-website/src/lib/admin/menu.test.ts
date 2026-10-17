import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import { routeDepuisFichier } from "./routes";

/**
 * Non-dérive entre le menu d'administration et les routes réelles : chaque
 * `href` de `AdminSidebar.tsx` doit correspondre à une page de `app/`.
 */
const RACINE = join(import.meta.dir, "..", "..", "app");

async function pagesReelles(): Promise<string[]> {
  const glob = new Bun.Glob("**/page.{tsx,ts,jsx,js,mdx}");
  const pages: string[] = [];
  for await (const fichier of glob.scan({ cwd: RACINE, onlyFiles: true })) {
    const route = routeDepuisFichier(fichier);
    if (route) pages.push(route.route);
  }
  return pages;
}

function correspond(href: string, pages: string[]): boolean {
  const motif = (page: string) =>
    new RegExp(`^${page.replace(/\[\.\.\.[^\]]+\]/g, ".+").replace(/\[[^\]]+\]/g, "[^/]+")}$`);
  return pages.some(page => motif(page).test(href));
}

describe("menu d'administration", () => {
  test("aucun lien mort", async () => {
    const source = await Bun.file(join(import.meta.dir, "..", "..", "components", "admin", "AdminSidebar.tsx")).text();
    const hrefs = [...source.matchAll(/href:\s*"(\/[^"?#]*)"/g)].map(m => m[1]!);
    expect(hrefs.length).toBeGreaterThan(10);
    const pages = await pagesReelles();
    const morts = hrefs.filter(href => !correspond(href, pages));
    expect(morts).toEqual([]);
  });
});
