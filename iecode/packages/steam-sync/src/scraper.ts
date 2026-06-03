/**
 * Scraper Steam Store dédié, bâti **sur le package bxc** (`@aphrody-code/bxc`).
 *
 * Récupère tout via bxc (profil `http` = curl-impersonate, TLS-fingerprinté) :
 *  - l'API officielle `appdetails` (JSON structuré : type, prix, devs, genres…) ;
 *  - le HTML de la page store (tags communautaires + résumé des évaluations).
 * Gère le bypass de l'age-gate (cookies maturité) et l'injection d'un cookie jar.
 *
 * @example
 *   import { SteamStoreScraper } from "@rose-griffon/iecode-steam-sync/scraper";
 *   const meta = await new SteamStoreScraper().scrapeApp(2799860);
 *   console.log(meta.name, meta.price?.formatted, meta.tags.slice(0, 5));
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { impersonateFetch, isLibAvailable } from "@aphrody-code/bxc/ffi/curl-impersonate";
import type { SteamAppMetadata, SteamScraperOptions } from "./types.ts";

const STORE = "https://store.steampowered.com";
const CHROME_UA =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** Cookies (paires "k=v") pour passer l'age-gate des jeux classés mature. */
const MATURE_COOKIES = [
	"wants_mature_content=1",
	"birthtime=568022401",
	"lastagecheckage=1-January-1980",
];

/**
 * Localise la lib native libcurl-impersonate de bxc si elle n'est pas déjà
 * pointée par `LIBCURL_IMPERSONATE_PATH`, en sondant l'install standard du CLI
 * bxc (`~/.bxc/bin/`) puis un checkout source. Renvoie sa disponibilité.
 */
let _libEnsured = false;
function bxcEngineAvailable(): boolean {
	if (!_libEnsured) {
		_libEnsured = true;
		if (!process.env["LIBCURL_IMPERSONATE_PATH"]) {
			const home = process.env["HOME"] ?? "";
			const lib =
				process.platform === "darwin" ? "libcurl-impersonate.dylib" : "libcurl-impersonate.so";
			for (const candidate of [
				join(home, ".bxc", "bin", lib),
				join(home, "bxc", "vendor", "curl-impersonate", lib),
			]) {
				if (existsSync(candidate)) {
					process.env["LIBCURL_IMPERSONATE_PATH"] = candidate;
					break;
				}
			}
		}
	}
	return isLibAvailable();
}

export class SteamStoreScraper {
	private readonly language: string;
	private readonly cc: string;
	private readonly cookiesPath?: string;
	private readonly insecure: boolean;
	private readonly log: (msg: string) => void;

	constructor(opts: SteamScraperOptions = {}) {
		this.language = opts.language ?? "english";
		this.cc = opts.countryCode ?? "us";
		this.cookiesPath = opts.cookiesPath;
		this.insecure = opts.insecure ?? true;
		this.log = opts.onLog ?? (() => {});
	}

	/** Scrape les métadonnées agrégées d'une app. */
	async scrapeApp(appId: number): Promise<SteamAppMetadata> {
		this.log(`scrape app ${appId}…`);
		const [details, html] = await Promise.all([
			this.fetchAppDetails(appId).catch((error) => {
				this.log(`API appdetails indisponible (${(error as Error).message}).`);
				return null;
			}),
			this.fetchStoreHtml(appId).catch((error) => {
				this.log(`HTML store indisponible (${(error as Error).message}) — métadonnées API seules.`);
				return "";
			}),
		]);

		const d = details ?? {};
		const price = d.price_overview
			? {
					currency: String(d.price_overview.currency ?? ""),
					discountPercent: Number(d.price_overview.discount_percent ?? 0),
					final: Number(d.price_overview.final ?? 0),
					formatted: String(d.price_overview.final_formatted ?? ""),
					initial: Number(d.price_overview.initial ?? 0),
				}
			: null;

		return {
			appId,
			categories: Array.isArray(d.categories)
				? d.categories.map((c: { description: string }) => String(c.description))
				: [],
			comingSoon: Boolean(d.release_date?.coming_soon ?? false),
			developers: Array.isArray(d.developers) ? d.developers.map(String) : [],
			genres: Array.isArray(d.genres)
				? d.genres.map((g: { description: string }) => String(g.description))
				: [],
			headerImage: d.header_image ? String(d.header_image) : parseOg(html, "image"),
			isFree: Boolean(d.is_free ?? false),
			metacritic: d.metacritic?.score != null ? Number(d.metacritic.score) : null,
			name: decodeEntities(String(d.name ?? parseName(html) ?? `app ${appId}`)),
			platforms: {
				linux: Boolean(d.platforms?.linux ?? false),
				mac: Boolean(d.platforms?.mac ?? false),
				windows: Boolean(d.platforms?.windows ?? false),
			},
			price,
			publishers: Array.isArray(d.publishers) ? d.publishers.map(String) : [],
			releaseDate: d.release_date?.date ? String(d.release_date.date) : null,
			reviewSummary: parseReviewSummary(html),
			shortDescription: decodeEntities(String(d.short_description ?? "").trim()),
			storeUrl: `${STORE}/app/${appId}/`,
			tags: parseStoreTags(html),
			type: String(d.type ?? "unknown"),
			website: d.website ? String(d.website) : null,
		};
	}

	/** Données brutes de l'API officielle `appdetails` (ou `null` si échec). */
	// Biome-ignore lint: structure dynamique de l'API Steam
	async fetchAppDetails(appId: number): Promise<any | null> {
		const url = `${STORE}/api/appdetails?appids=${appId}&l=${this.language}&cc=${this.cc}`;
		const body = await this.fetch(url, /* Mature */ false);
		try {
			const json = JSON.parse(body);
			const entry = json?.[String(appId)];
			return entry?.success ? entry.data : null;
		} catch {
			return null;
		}
	}

	/** HTML de la page store (age-gate contourné). */
	async fetchStoreHtml(appId: number): Promise<string> {
		const url = `${STORE}/app/${appId}/?l=${this.language}&cc=${this.cc}`;
		return this.fetch(url, /* Mature */ true);
	}

	/**
	 * GET via le moteur HTTP de bxc (curl-impersonate, TLS-fingerprinté). Si la
	 * lib native de bxc est absente, repli sur le `fetch` natif (UA Chrome).
	 */
	private async fetch(url: string, mature: boolean): Promise<string> {
		const parts = mature ? [...MATURE_COOKIES] : [];
		if (this.cookiesPath) {
			parts.push(...(await this.loadJarPairs(this.cookiesPath)));
		}
		const cookie = parts.join("; ");

		if (bxcEngineAvailable()) {
			const res = await impersonateFetch(url, {
				followRedirects: true,
				insecure: this.insecure,
				...(cookie ? { cookies: cookie } : {}),
			});
			if (!res.ok && res.status !== 0) {
				throw new Error(`HTTP ${res.status} sur ${url}`);
			}
			return await res.text();
		}

		this.log("libcurl-impersonate indisponible — fallback fetch natif.");
		const res = await fetch(url, {
			headers: { "User-Agent": CHROME_UA, ...(cookie ? { Cookie: cookie } : {}) },
			redirect: "follow",
		});
		if (!res.ok) {
			throw new Error(`HTTP ${res.status} sur ${url}`);
		}
		return await res.text();
	}

	/** Lit un cookie jar JSON (array ou `{cookies:[…]}`) en paires "name=value". */
	private async loadJarPairs(path: string): Promise<string[]> {
		try {
			const raw = (await Bun.file(path).json()) as unknown;
			const arr = (Array.isArray(raw) ? raw : (raw as { cookies?: unknown[] }).cookies) ?? [];
			return (arr as { name?: string; value?: string }[])
				.filter((c) => typeof c?.name === "string")
				.map((c) => `${c.name}=${c.value ?? ""}`);
		} catch (error) {
			this.log(`cookie jar ignoré (${(error as Error).message}).`);
			return [];
		}
	}
}

/** Raccourci : scrape une app sans instancier la classe. */
export function scrapeApp(appId: number, opts?: SteamScraperOptions): Promise<SteamAppMetadata> {
	return new SteamStoreScraper(opts).scrapeApp(appId);
}

// ─── Parsers HTML purs (regex légères, pas de dépendance DOM) — testables ───

/** Décode les entités HTML courantes (l'API Steam échappe `&quot;`, `&amp;`, …). */
export function decodeEntities(s: string): string {
	return s
		.replace(/&quot;/g, '"')
		.replace(/&#0?39;|&apos;/g, "'")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&");
}

function match1(html: string, re: RegExp): string | null {
	const v = re.exec(html)?.[1];
	return v != null ? v.trim() : null;
}

/** Nom de l'app depuis le HTML store (fallback sur og:title). */
export function parseName(html: string): string | null {
	return (
		match1(html, /<div[^>]*class="apphub_AppName"[^>]*>([^<]+)<\/div>/i) ?? parseOg(html, "title")
	);
}

/** Tags communautaires (`<a class="app_tag">`), dédupliqués, ordre = popularité. */
export function parseStoreTags(html: string): string[] {
	const tags: string[] = [];
	const re = /<a[^>]*class="app_tag"[^>]*>([\s\S]*?)<\/a>/gi;
	let m: RegExpExecArray | null;
	while ((m = re.exec(html)) !== null) {
		const tag = (m[1] ?? "").replace(/<[^>]+>/g, "").trim();
		if (tag && tag !== "+") {
			tags.push(tag);
		}
	}
	return [...new Set(tags)];
}

/** Résumé des évaluations Steam (ex. "Very Positive"). */
export function parseReviewSummary(html: string): string | null {
	return match1(html, /class="game_review_summary[^"]*"[^>]*>([^<]+)<\/span>/i);
}

/** Valeur d'une balise Open Graph (`property=` ou `name=`). */
export function parseOg(html: string, prop: "image" | "title" | "description"): string | null {
	return (
		match1(html, new RegExp(`<meta\\s+property="og:${prop}"\\s+content="([^"]*)"`, "i")) ??
		match1(html, new RegExp(`<meta\\s+name="og:${prop}"\\s+content="([^"]*)"`, "i"))
	);
}
