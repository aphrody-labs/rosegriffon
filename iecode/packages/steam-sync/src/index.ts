/**
 * @rose-griffon/iecode-steam-sync — sync IEVR depuis Steam.
 *
 * Deux briques :
 *  - **scraper store dédié** bâti sur le package bxc (`@aphrody-code/bxc`) :
 *    métadonnées d'une app (prix, devs, genres, tags, plateformes…) ;
 *  - **synchro native** (download + extraction CPK) via le CLI `iecode`
 *    (@rose-griffon/iecode-core, SteamKit2) — sans steamcmd.
 *
 * @example
 *   import { scrapeApp, syncApp } from "@rose-griffon/iecode-steam-sync";
 *   const meta = await scrapeApp(2799860);
 *   await syncApp({ dumpOut: "~/iecode-dump" }); // creds via env STEAM_*
 */
export type * from "./types.ts";
export {
	SteamStoreScraper,
	scrapeApp,
	parseName,
	parseStoreTags,
	parseReviewSummary,
	parseOg,
	decodeEntities,
} from "./scraper.ts";
export { syncApp, listDepots, IEVR_APP_ID, DEFAULT_TOKEN_STORE, resolveIecodeCli } from "./sync.ts";
