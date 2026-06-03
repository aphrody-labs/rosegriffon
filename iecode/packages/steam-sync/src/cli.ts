#!/usr/bin/env bun
// oxlint-disable no-console -- point d'entrée CLI : stdout est la sortie attendue
/**
 * CLI `steam-sync` — scrape store (bxc) et/ou synchro native IEVR (download + dump).
 *
 * Usage :
 *   steam-sync [appId]                 scrape les métadonnées store (défaut: IEVR)
 *   steam-sync [appId] --out <dir>     scrape + download + dump
 *   steam-sync --scrape-only --json    métadonnées en JSON sur stdout
 *
 * Options : --out/-o, --install, --preset, --user, --password, --guard,
 *           --token-store, --branch, --os, --scrape-only, --skip-download,
 *           --skip-dump, --json, --cookies, --lang, --cc
 *
 * Identifiants via env : STEAM_USER, STEAM_PASSWORD, STEAM_GUARD_CODE.
 */
import { parseArgs } from "node:util";
import { SteamStoreScraper } from "./scraper.ts";
import { IEVR_APP_ID, listDepots, syncApp } from "./sync.ts";

const { values, positionals } = parseArgs({
	allowPositionals: true,
	args: Bun.argv.slice(2),
	options: {
		branch: { type: "string" },
		cc: { type: "string" },
		cookies: { type: "string" },
		guard: { type: "string" },
		install: { type: "string" },
		json: { type: "boolean" },
		lang: { type: "string" },
		list: { type: "boolean" },
		os: { type: "string" },
		out: { short: "o", type: "string" },
		password: { type: "string" },
		preset: { short: "p", type: "string" },
		"scrape-only": { type: "boolean" },
		"skip-download": { type: "boolean" },
		"skip-dump": { type: "boolean" },
		"token-store": { type: "string" },
		user: { short: "u", type: "string" },
	},
});

const appId = positionals[0] ? Number(positionals[0]) : IEVR_APP_ID;

// Inspection : liste les depots/manifests/tailles (login requis, aucun téléchargement).
if (values.list) {
	await listDepots(appId, {
		guardCode: values.guard,
		password: values.password,
		tokenStore: values["token-store"],
		user: values.user,
	});
}
// Scrape seul si pas de --out, ou --scrape-only explicite.
else if (values["scrape-only"] || !values.out) {
	const meta = await new SteamStoreScraper({
		cookiesPath: values.cookies,
		countryCode: values.cc,
		language: values.lang,
		onLog: values.json ? undefined : (m) => console.error(`  ${m}`),
	}).scrapeApp(appId);

	if (values.json) {
		console.log(JSON.stringify(meta, null, 2));
	} else {
		console.log(`\n${meta.name}  (app ${meta.appId})`);
		console.log(`  type        ${meta.type}${meta.isFree ? " (gratuit)" : ""}`);
		console.log(`  prix        ${meta.price?.formatted ?? "n/a"}`);
		console.log(`  sortie      ${meta.releaseDate ?? "?"}${meta.comingSoon ? " (à venir)" : ""}`);
		console.log(`  dev/éditeur ${meta.developers.join(", ")} / ${meta.publishers.join(", ")}`);
		console.log(
			`  plateformes ${[meta.platforms.windows && "Win", meta.platforms.mac && "Mac", meta.platforms.linux && "Linux"].filter(Boolean).join(", ")}`
		);
		if (meta.reviewSummary) {
			console.log(`  évaluations ${meta.reviewSummary}`);
		}
		if (meta.genres.length) {
			console.log(`  genres      ${meta.genres.join(", ")}`);
		}
		if (meta.tags.length) {
			console.log(`  tags        ${meta.tags.slice(0, 12).join(", ")}`);
		}
		if (meta.shortDescription) {
			console.log(`\n  ${meta.shortDescription}`);
		}
	}
} else {
	await syncApp({
		appId,
		branch: values.branch,
		dumpOut: values.out,
		guardCode: values.guard,
		installDir: values.install,
		os: values.os,
		password: values.password,
		preset: values.preset,
		skipDownload: values["skip-download"],
		skipDump: values["skip-dump"],
		tokenStore: values["token-store"],
		user: values.user,
	});
}
