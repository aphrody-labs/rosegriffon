/**
 * @license
 * Copyright 2026 Rose Griffon
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Tâche `website:qa` — QA navigateur read-only de rosegriffon.fr. MANUELLE.
 *
 * Portage en TypeScript du workflow shell `agent-browser-rg.sh` (schéma 1) sur
 * les API natives : `fetch` pour les statuts HTTP, robots.txt et sitemaps,
 * `Bun.WebView` pour le rendu (titre, canonical, liens, débordement mobile,
 * erreurs console et exceptions, capture). Aucun binaire externe.
 *
 * Rapport : `<RG_BROWSER_CRON_OUT_DIR | RG_CRON_SHARED_ROOT/website-qa>/<run>/`
 * (`report.json`, `report.md`, `pages.jsonl`, `api.jsonl`, `urls.txt`, captures
 * JPEG). Seules les dernières passes sont conservées.
 */

import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { cronSharedPath } from "../../lib/shared-path";
import { fermerVue, naviguer, ouvrirVue } from "../../lib/webview";

const VERSION_WORKFLOW = "2.0.0";
const VERSION_SCHEMA = 1;
const PASSES_CONSERVEES = 5;

export interface WebsiteQaResult {
  success: boolean;
  reportDir?: string;
  report?: string;
  error?: string;
  stats?: Record<string, number>;
}

interface Sonde {
  url: string;
  effectiveUrl: string;
  status: number;
  timeSeconds: number;
}

interface RapportPage {
  url: string;
  effectiveUrl: string;
  status: number;
  openOk: boolean;
  title: string;
  metadata: Record<string, unknown>;
  errors: string[];
  console: string[];
  layout: {
    mobileScrollWidth?: number;
    mobileClientWidth?: number;
    horizontalOverflow?: boolean;
  };
}

function entier(nom: string, defaut: number): number {
  const valeur = Number.parseInt(Bun.env[nom] ?? "", 10);
  return Number.isFinite(valeur) && valeur > 0 ? valeur : defaut;
}

async function sonder(url: string): Promise<Sonde> {
  const debut = performance.now();
  try {
    const reponse = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(25_000),
    });
    await reponse.arrayBuffer();
    return {
      url,
      effectiveUrl: reponse.url,
      status: reponse.status,
      timeSeconds: (performance.now() - debut) / 1000,
    };
  } catch {
    return {
      url,
      effectiveUrl: "",
      status: 0,
      timeSeconds: (performance.now() - debut) / 1000,
    };
  }
}

async function texte(url: string): Promise<string> {
  try {
    const reponse = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    return reponse.ok ? await reponse.text() : "";
  } catch {
    return "";
  }
}

function nomFichier(chemin: string): string {
  return chemin.replace(/^\//, "").replaceAll(/[^A-Za-z0-9._-]/g, "_") || "home";
}

const SCRIPT_METADONNEES = `({
  title: document.title,
  canonical: document.querySelector("link[rel=canonical]")?.href || null,
  lang: document.documentElement.lang || null,
  headings: [...document.querySelectorAll("h1,h2")].map(x => x.innerText.trim()).filter(Boolean),
  links: [...document.querySelectorAll("a[href]")].map(a => a.href),
  scripts: document.scripts.length,
  stylesheets: document.styleSheets.length,
  landmarks: [...document.querySelectorAll("main,nav,header,footer,aside")].map(x => x.tagName.toLowerCase()),
  layout: {
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight,
  },
})`;

const SCRIPT_MOBILE = `({
  mobileScrollWidth: document.documentElement.scrollWidth,
  mobileClientWidth: document.documentElement.clientWidth,
  horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
})`;

/** Ne garde que les dernières passes : le répertoire vit sur le disque d'état du service. */
async function elaguer(racine: string): Promise<void> {
  const passes = (await readdir(racine, { withFileTypes: true }))
    .filter(e => e.isDirectory() && /^\d{8}T\d{6}Z/.test(e.name))
    .map(e => e.name)
    .sort();
  for (const ancienne of passes.slice(0, Math.max(0, passes.length - PASSES_CONSERVEES))) {
    await rm(join(racine, ancienne), { recursive: true, force: true });
  }
}

export async function runWebsiteQa(): Promise<WebsiteQaResult> {
  const base = (Bun.env.RG_BROWSER_BASE_URL ?? "https://rosegriffon.fr").replace(/\/+$/, "");
  const baseApi = (Bun.env.RG_BROWSER_API_BASE_URL ?? "https://api.rosegriffon.fr").replace(/\/+$/, "");
  const maxPages = entier("RG_BROWSER_MAX_PAGES", 40);
  const racine = Bun.env.RG_BROWSER_CRON_OUT_DIR ?? cronSharedPath("website-qa");
  const runId = `${new Date()
    .toISOString()
    .replaceAll(/[-:]/g, "")
    .replace(/\.\d+Z$/, "Z")}-${process.pid}`;
  const dossier = join(racine, runId);
  await mkdir(dossier, { recursive: true });

  const hoteBase = new URL(base).hostname;
  const normaliser = (brut: string): string | null => {
    try {
      const url = new URL(brut, `${base}/`);
      url.hash = "";
      if (url.hostname === `www.${hoteBase}`) url.hostname = hoteBase;
      return url.hostname === hoteBase && url.protocol === "https:" ? url.href : null;
    } catch {
      return null;
    }
  };

  // 1. URLs : sitemaps déclarés dans robots.txt, la racine, puis les liens de l'accueil.
  const robots = await texte(`${base}/robots.txt`);
  const sitemaps = [...robots.matchAll(/^\s*Sitemap:\s*(\S+)/gim)].map(m => m[1]!);
  const urls = new Set<string>();
  for (const sitemap of sitemaps) {
    for (const m of (await texte(sitemap)).matchAll(/<loc>([^<]+)<\/loc>/g)) {
      const url = normaliser(m[1]!.trim());
      if (url && urls.size < maxPages) urls.add(url);
    }
  }
  urls.add(`${base}/`);

  const erreursPage: string[] = [];
  const consolePage: string[] = [];
  const vue = ouvrirVue();
  const pages: RapportPage[] = [];
  try {
    vue.addEventListener("Runtime.exceptionThrown", evenement => {
      const details = (
        evenement as MessageEvent<{
          exceptionDetails?: {
            text?: string;
            exception?: { description?: string };
          };
        }>
      ).data?.exceptionDetails;
      erreursPage.push(details?.exception?.description ?? details?.text ?? "exception");
    });
    try {
      await naviguer(vue, `${base}/`);
      const liens = (await vue.evaluate(`[...document.querySelectorAll("a[href]")].map(a => a.href)`)) as string[];
      for (const lien of liens) {
        const url = normaliser(lien);
        if (url && urls.size < maxPages) urls.add(url);
      }
    } catch (err) {
      console.warn("[website:qa] liens de l'accueil illisibles :", err instanceof Error ? err.message : err);
    }
    await vue.cdp("Runtime.enable").catch(() => undefined);
    await vue.cdp("Log.enable").catch(() => undefined);
    vue.addEventListener("Log.entryAdded", evenement => {
      const entree = (evenement as MessageEvent<{ entry?: { level?: string; text?: string } }>).data?.entry;
      if (entree?.level === "error") consolePage.push(entree.text ?? "erreur");
    });
    vue.addEventListener("Runtime.consoleAPICalled", evenement => {
      const appel = (
        evenement as MessageEvent<{
          type?: string;
          args?: { value?: unknown; description?: string }[];
        }>
      ).data;
      if (appel?.type === "error") {
        consolePage.push((appel.args ?? []).map(a => String(a.value ?? a.description ?? "")).join(" "));
      }
    });

    const liste = [...urls].sort().slice(0, maxPages);
    await writeFile(join(dossier, "urls.txt"), `${liste.join("\n")}\n`);

    // 2. Chaque page : statut HTTP, rendu, métadonnées, débordement mobile, capture.
    for (const url of liste) {
      const sonde = await sonder(url);
      erreursPage.length = 0;
      consolePage.length = 0;
      const page: RapportPage = {
        url,
        effectiveUrl: sonde.effectiveUrl || url,
        status: sonde.status,
        openOk: false,
        title: "",
        metadata: {},
        errors: [],
        console: [],
        layout: {},
      };
      if (sonde.status >= 200 && sonde.status < 400) {
        try {
          await vue.resize(1440, 900);
          await naviguer(vue, url);
          page.openOk = true;
          page.effectiveUrl = vue.url;
          page.metadata = (await vue.evaluate(SCRIPT_METADONNEES)) as Record<string, unknown>;
          page.title = String(page.metadata.title ?? "");
          await vue.resize(390, 844);
          page.layout = (await vue.evaluate(SCRIPT_MOBILE)) as RapportPage["layout"];
          await vue.resize(1440, 900);
          const capture = await vue.screenshot({
            format: "jpeg",
            quality: 60,
            encoding: "buffer",
          });
          await Bun.write(join(dossier, `${nomFichier(new URL(url).pathname)}.jpg`), capture);
        } catch (err) {
          page.errors.push(err instanceof Error ? err.message : String(err));
        }
      }
      page.errors.push(...erreursPage);
      page.console.push(...consolePage);
      pages.push(page);
    }
  } finally {
    fermerVue(vue);
  }

  // 3. Points d'API.
  const sondesApi = await Promise.all(
    (
      [
        [base, "/api/health", true],
        [base, "/api/auth/get-session", true],
        [baseApi, "/v1/auth/get-session", true],
        [baseApi, "/v1/auth/agent-configuration", true],
        [baseApi, "/.well-known/agent-configuration", false],
      ] as const
    ).map(async ([origine, chemin, requis]) => ({
      origin: origine,
      path: chemin,
      required: requis,
      ...(await sonder(`${origine}${chemin}`)),
    })),
  );

  const enEchec = (status: number) => status < 200 || status >= 400;
  const resume = {
    pagesTotal: pages.length,
    pagesBad: pages.filter(p => enEchec(p.status) || !p.openOk).length,
    horizontalOverflow: pages.filter(p => p.layout.horizontalOverflow === true).length,
    consoleOrRuntimeErrors: pages.filter(p => p.errors.length > 0 || p.console.length > 0).length,
    apiBad: sondesApi.filter(a => a.required && enEchec(a.status)).length,
  };
  const echouer = (nom: string) => Bun.env[nom] === "1";
  const statut =
    resume.pagesBad === 0 &&
    resume.horizontalOverflow === 0 &&
    resume.apiBad === 0 &&
    !(echouer("RG_BROWSER_FAIL_ON_ERRORS") && resume.consoleOrRuntimeErrors > 0)
      ? "ok"
      : "failed";

  const rapport = {
    workflowVersion: VERSION_WORKFLOW,
    schemaVersion: VERSION_SCHEMA,
    runId,
    baseUrl: base,
    status: statut,
    summary: resume,
  };
  const cheminRapport = join(dossier, "report.json");
  await writeFile(cheminRapport, `${JSON.stringify(rapport, null, 2)}\n`);
  await writeFile(join(dossier, "pages.jsonl"), pages.map(p => JSON.stringify(p)).join("\n") + "\n");
  await writeFile(join(dossier, "api.jsonl"), sondesApi.map(a => JSON.stringify(a)).join("\n") + "\n");
  const enDefaut = [
    ...pages.filter(p => enEchec(p.status) || !p.openOk).map(p => `- HTTP ${p.status} ${p.url}`),
    ...pages.filter(p => p.layout.horizontalOverflow).map(p => `- débordement mobile ${p.url}`),
    ...sondesApi.filter(a => a.required && enEchec(a.status)).map(a => `- API HTTP ${a.status} ${a.origin}${a.path}`),
  ];
  await writeFile(
    join(dossier, "report.md"),
    [
      `# RG browser QA ${runId}`,
      "",
      `- Status: **${statut}**`,
      `- Workflow: \`${VERSION_WORKFLOW}\` / schema \`${VERSION_SCHEMA}\` (Bun.WebView)`,
      `- Base URL: ${base}`,
      `- Pages: ${resume.pagesTotal}, HTTP/open failures: ${resume.pagesBad}`,
      `- Horizontal overflows: ${resume.horizontalOverflow}`,
      `- API failures: ${resume.apiBad}`,
      `- Pages with console/runtime errors: ${resume.consoleOrRuntimeErrors}`,
      "",
      ...enDefaut,
      "",
    ].join("\n"),
  );
  await elaguer(racine).catch(() => undefined);

  console.log(`[website:qa] ${statut} : ${JSON.stringify(resume)} → ${cheminRapport}`);
  if (statut !== "ok") {
    return {
      success: false,
      reportDir: dossier,
      report: cheminRapport,
      stats: resume,
      error: `QA en échec : ${enDefaut.slice(0, 8).join(" ; ").replaceAll("- ", "") || JSON.stringify(resume)}`,
    };
  }
  return {
    success: true,
    reportDir: dossier,
    report: cheminRapport,
    stats: resume,
  };
}
