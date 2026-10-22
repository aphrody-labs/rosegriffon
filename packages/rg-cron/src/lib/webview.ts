/**
 * @license
 * Copyright 2026 Rose Griffon
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Navigateur headless des tâches cron : `Bun.WebView`, l'API native du runtime.
 *
 * Remplace `@aphrody/agent-browser` (client CDP vers un moteur externe) et le
 * script shell `agent-browser`, absents de l'hôte de production. Sous Linux,
 * `Bun.WebView` pilote le Chrome installé par le Chrome DevTools Protocol, sur
 * un tube : aucun port de débogage n'est ouvert.
 *
 * Chaque vue est un onglet du MÊME Chrome, lancé à la première vue du
 * processus. `rg-core` est un service permanent : le navigateur ne doit pas lui
 * survivre entre deux tâches. Le compteur ci-dessous le tue peu après la
 * fermeture de la dernière vue ouverte par ce module.
 */

/** Réponse de navigation, au format attendu par les crawlers existants (alias : signature d'index implicite). */
export type NavigationResponse = {
  ok: boolean;
  status: number;
  url: string;
};

/** Document chargé et rendu par le navigateur. */
export type DocumentCharge = NavigationResponse & {
  html: string;
  title: string;
};

const DELAI_NAVIGATION_MS = 45_000;

let vuesOuvertes = 0;
const vuesFermees = new WeakSet<Bun.WebView>();

/**
 * Chrome n'est tué qu'après ce délai sans vue ouverte.
 *
 * `Bun.WebView.closeAll()` rend la main avant que Chrome ne soit mort : une vue
 * créée dans la foulée s'accroche au tube mourant et toute navigation échoue
 * (« view is closed », « Chrome process closed the pipe »). C'est exactement
 * l'enchaînement d'`ouvrirVue()`/`fermerVue()` puis `PageWebView.connect()` de
 * `feed:sync`. Différer la fermeture laisse la vue suivante réutiliser le
 * Chrome vivant ; une vue ouverte entre-temps annule la fermeture.
 */
const DELAI_FERMETURE_CHROME_MS = 2_000;
/** Temps laissé à Chrome pour mourir après `closeAll()` avant d'ouvrir une vue (mesuré : 10 ms suffisent). */
const DELAI_APRES_FERMETURE_MS = 100;

let minuteurFermeture: ReturnType<typeof setTimeout> | undefined;
let chromeFermeLe = Number.NEGATIVE_INFINITY;

function fermerChrome(): void {
  minuteurFermeture = undefined;
  if (vuesOuvertes !== 0) return;
  Bun.WebView.closeAll();
  chromeFermeLe = performance.now();
}

/** Attend, si besoin, que le Chrome fermé par `closeAll()` soit vraiment mort. */
async function chromeDisponible(): Promise<void> {
  const reste = chromeFermeLe + DELAI_APRES_FERMETURE_MS - performance.now();
  if (reste > 0) await Bun.sleep(reste);
}

/**
 * Ouvre un onglet headless. `url: false` interdit de se brancher sur un Chrome
 * déjà lancé avec le débogage distant : le cron a toujours son propre
 * navigateur, éphémère.
 */
export function ouvrirVue(options: { largeur?: number; hauteur?: number } = {}): Bun.WebView {
  clearTimeout(minuteurFermeture);
  minuteurFermeture = undefined;
  const vue = new Bun.WebView({
    width: options.largeur ?? 1440,
    height: options.hauteur ?? 900,
    backend: Bun.env.BUN_CHROME_PATH
      ? { type: "chrome", url: false, path: Bun.env.BUN_CHROME_PATH }
      : { type: "chrome", url: false },
  });
  vuesOuvertes++;
  return vue;
}

/** Ferme la vue ; ferme Chrome peu après quand c'était la dernière. Idempotent par vue. */
export function fermerVue(vue: Bun.WebView): void {
  if (vuesFermees.has(vue)) return;
  vuesFermees.add(vue);
  vue.close();
  vuesOuvertes = Math.max(0, vuesOuvertes - 1);
  if (vuesOuvertes === 0 && minuteurFermeture === undefined) {
    minuteurFermeture = setTimeout(fermerChrome, DELAI_FERMETURE_CHROME_MS);
    // Ne retient pas le processus : Bun ferme de toute façon Chrome à la sortie.
    minuteurFermeture.unref?.();
  }
}

/** Code HTTP du document principal (Navigation Timing, `responseStatus`). */
const SCRIPT_STATUT = `performance.getEntriesByType("navigation")[0]?.responseStatus ?? 0`;
const SCRIPT_HTML = `(document.doctype ? "<!DOCTYPE " + document.doctype.name + ">" : "") + document.documentElement.outerHTML`;

/** Navigue avec une échéance : `navigate()` ne borne pas lui-même son attente. */
export async function naviguer(
  vue: Bun.WebView,
  url: string,
  delaiMs = DELAI_NAVIGATION_MS,
): Promise<NavigationResponse> {
  let minuteur: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      vue.navigate(url),
      new Promise<never>((_, rejeter) => {
        minuteur = setTimeout(() => rejeter(new Error(`Navigation trop longue (${delaiMs} ms) : ${url}`)), delaiMs);
      }),
    ]);
  } finally {
    clearTimeout(minuteur);
  }
  const status = Number(await vue.evaluate(SCRIPT_STATUT)) || 200;
  return { ok: status >= 200 && status < 400, status, url: vue.url };
}

/** Charge une page dans un onglet dédié et rend son HTML après exécution des scripts. */
export async function chargerDocument(url: string, delaiMs = DELAI_NAVIGATION_MS): Promise<DocumentCharge> {
  await chromeDisponible();
  const vue = ouvrirVue();
  try {
    const reponse = await naviguer(vue, url, delaiMs);
    const html = String(await vue.evaluate(SCRIPT_HTML));
    return { ...reponse, html, title: vue.title };
  } finally {
    fermerVue(vue);
  }
}

/**
 * Page au contrat des crawlers historiques (`goto`/`evaluate`/`content`/`close`,
 * celui de `@aphrody/agent-browser/cdp` et de `@rosegriffon/inagle/zukan/web-cdp`).
 */
export class PageWebView {
  readonly #vue: Bun.WebView;
  /** Chargement complet de la dernière navigation : la vue n'en accepte pas une nouvelle avant sa fin. */
  #navigation: Promise<unknown> = Promise.resolve();

  private constructor(vue: Bun.WebView) {
    this.#vue = vue;
  }

  /** L'argument (point de terminaison CDP) n'existe plus : Bun lance son navigateur. */
  static async connect(_endpoint?: string): Promise<PageWebView> {
    await chromeDisponible();
    return new PageWebView(ouvrirVue());
  }

  /**
   * Rend la main dès que le document est interactif (DOMContentLoaded), sans attendre les
   * images et polices : les crawlers attendent ensuite leurs sélecteurs, et une page lourde
   * (zukan, 200 cartes) dépassait l'échéance du chargement complet.
   */
  async goto(url: string, _waitUntil?: string): Promise<NavigationResponse> {
    const vue = this.#vue;
    await Promise.race([this.#navigation, Bun.sleep(DELAI_NAVIGATION_MS)]);
    // Repère posé sur l'ancien document : il disparaît quand le nouveau prend la place.
    await vue.evaluate("window.__rgNav = 1").catch(() => undefined);
    this.#navigation = vue.navigate(url).catch(() => undefined);
    const echeance = Date.now() + DELAI_NAVIGATION_MS;
    // Une seule évaluation à la fois : la vue refuse la seconde tant que la première attend.
    let attente: Promise<string> | null = null;
    while (Date.now() < echeance) {
      attente ??= vue
        .evaluate("JSON.stringify([document.readyState, window.__rgNav === 1])")
        .then(String)
        .catch(() => "");
      const reponse = await Promise.race([attente, Bun.sleep(250).then(() => null)]);
      if (reponse === null) continue;
      attente = null;
      try {
        const [etat, ancien] = JSON.parse(reponse) as [string, boolean];
        if ((etat === "interactive" || etat === "complete") && !ancien && vue.url && vue.url !== "about:blank") break;
      } catch {
        // Document en cours de remplacement : on réessaie.
      }
      await Bun.sleep(150);
    }
    if (Date.now() >= echeance) throw new Error(`Navigation trop longue (${DELAI_NAVIGATION_MS} ms) : ${url}`);
    const status = Number(await vue.evaluate(SCRIPT_STATUT)) || 200;
    return { ok: status >= 200 && status < 400, status, url: vue.url };
  }

  async evaluate<T = unknown>(script: string): Promise<T> {
    return (await this.#vue.evaluate(script)) as T;
  }

  async content(): Promise<string> {
    return String(await this.#vue.evaluate(SCRIPT_HTML));
  }

  async title(): Promise<string> {
    return this.#vue.title;
  }

  /** Cookies au format CDP (`Network.CookieParam`) ; la session CDP naît à la première navigation. */
  async addCookies(cookies: Array<Record<string, unknown>>): Promise<void> {
    if (!this.#vue.url) await this.#vue.navigate("about:blank");
    await this.#vue.cdp("Network.setCookies", { cookies });
  }

  async close(): Promise<void> {
    fermerVue(this.#vue);
  }
}

/** Service Web de `@rosegriffon/inagle/zukan` (`ZukanWebService`) sur `Bun.WebView`. */
export const serviceWebNatif = {
  async response(url: string, options: { maxBytes?: number } = {}) {
    const document = await chargerDocument(url);
    const taille = Buffer.byteLength(document.html);
    return {
      status: document.status,
      truncated: options.maxBytes !== undefined && taille > options.maxBytes,
      body: document.html,
    };
  },
  async bytes(url: string): Promise<Uint8Array> {
    const reponse = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (!reponse.ok) throw new Error(`HTTP ${reponse.status} : ${url}`);
    return new Uint8Array(await reponse.arrayBuffer());
  },
};
