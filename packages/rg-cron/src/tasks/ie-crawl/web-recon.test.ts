// SPDX-License-Identifier: Apache-2.0
import { describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type CrawlOptions, type CrawlReport, WebService } from "@aphrody/agent-browser/service";
import { crawlWebRecon } from "./web-recon";

/** Réponses du faux `aphrody-web` : découverte (rendue) puis sondes (`maxDepth: 0`). */
function rapport(probes: boolean): CrawlReport {
  const pages = probes
    ? [{ url: "https://example.test/data.json", status: 200, contentType: "application/json", html: '{"value":42}' }]
    : [
        {
          url: "https://example.test/target/",
          status: 206,
          contentType: "text/html",
          html: '<html><a href="/data.json">Data</a></html>',
        },
      ];
  return { schema: "aphrody-web.crawl/1", pages, errors: [], stats: {} } as unknown as CrawlReport;
}

async function avecDossier<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "aphrody-web-recon-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("recon delegates bounded discovery and probes to the crawl owner without inventing status", async () => {
  await avecDossier(async dir => {
    const appels: Array<{ seeds: readonly string[]; options: CrawlOptions }> = [];
    const service = {
      async crawl(seeds: readonly string[], options: CrawlOptions = {}) {
        appels.push({ seeds, options });
        return rapport(options.maxDepth === 0);
      },
    };
    const result = await crawlWebRecon({ rootUrl: "https://example.test/target/", outDir: join(dir, "out"), service });

    expect(appels).toHaveLength(2);
    const [decouverte, sondes] = appels;
    expect(decouverte?.seeds).toEqual(["https://example.test/target/"]);
    expect(decouverte?.options.render).toBe(true);
    expect(decouverte?.options.includeUrlRegex?.length).toBeGreaterThan(0);
    expect(decouverte?.options.excludeUrlRegex?.length).toBeGreaterThan(0);
    expect(sondes?.options.render).toBeUndefined();
    expect(sondes?.options.maxDepth).toBe(0);
    expect(sondes?.seeds).toEqual(["https://example.test/data.json"]);
    // Le statut est celui du moteur (206), jamais un 200 supposé.
    expect(result.endpoints.find(entry => entry.kind === "page")?.status).toBe(206);
    expect(result.endpoints.find(entry => entry.url.endsWith("data.json"))?.kind).toBe("json");
    expect(JSON.parse(await Bun.file(join(dir, "out/json/example.test_data.json.json")).text())).toEqual({ value: 42 });
  });
});

/**
 * Le contrat en ligne de commande passe par le vrai `WebService`, qui lance le
 * binaire via le runtime natif YOLO (`aphrody_ffi`). Sauté seulement si ce
 * runtime est absent (message exact du SDK) ou sous Windows, où un script à
 * shebang n'est pas exécutable ; toute autre erreur de la sonde fait échouer.
 */
async function lancementNatifIndisponible(): Promise<string | null> {
  if (process.platform === "win32") return "un script à shebang n'est pas exécutable sous Windows";
  try {
    await new WebService({ binary: process.execPath }).version();
    return null;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/runtime library not found/i.test(message)) return message.split(".")[0] ?? message;
    throw err;
  }
}

const natifAbsent = await lancementNatifIndisponible();
if (natifAbsent) console.warn(`[WebRecon] contrat CLI sauté : ${natifAbsent}.`);

describe("aphrody-web CLI contract", () => {
  test.skipIf(natifAbsent !== null)("discovery renders and filters, probes stay at depth 0", async () => {
    await avecDossier(async dir => {
      const binary = join(dir, "aphrody-web");
      const calls = join(dir, "calls.jsonl");
      await writeFile(
        binary,
        `#!/usr/bin/env bun
const args = process.argv.slice(2);
await Bun.write(Bun.file(${JSON.stringify(calls)}), (await Bun.file(${JSON.stringify(calls)}).exists() ? await Bun.file(${JSON.stringify(calls)}).text() : "") + JSON.stringify(args) + "\\n");
const probes = args.includes("--max-depth") && args[args.indexOf("--max-depth") + 1] === "0";
console.log(JSON.stringify(probes ? ${JSON.stringify(rapport(true))} : ${JSON.stringify(rapport(false))}));
`,
        { mode: 0o700 },
      );
      const result = await crawlWebRecon({
        rootUrl: "https://example.test/target/",
        outDir: join(dir, "out"),
        service: new WebService({ binary }),
      });
      const argv = (await Bun.file(calls).text())
        .trim()
        .split("\n")
        .map(line => JSON.parse(line) as string[]);
      expect(argv).toHaveLength(2);
      expect(argv.every(args => args[0] === "crawl")).toBe(true);
      expect(argv[0]).toContain("--render");
      expect(argv[1]).not.toContain("--render");
      expect(argv[0]).toContain("--include-url-regex");
      expect(argv[0]).toContain("--exclude-url-regex");
      expect(argv[1]?.[argv[1].indexOf("--max-depth") + 1]).toBe("0");
      expect(result.endpoints.find(entry => entry.kind === "page")?.status).toBe(206);
    });
  });
});
