/**
 * @license
 * Copyright 2026 Rose Griffon
 * SPDX-License-Identifier: Apache-2.0
 */

// Config centralisée des comptes X/Twitter officiels Inazuma Eleven / LEVEL-5.
// Multi-comptes pour ingestion cron + RAG (cf. UNIFIED-RAG-PLAN §4.1 + §8).
//
// Validés via bxc x profile + tweets (2026-06) + bxc x search discovery:
// - inazuma_project : イナズマイレブン公式 (JP, ~260k) — principal
// - inazuma_cross   : イナズマイレブン クロス 公式 (JP, ~46k) — officiel jeu mobile Cross
// - AkihiroHino : 日野晃博 CEO LEVEL-5 (~228k)
// - LEVEL5_times : レベルファイブ officiel (~134k)
// - Azalee_IE : Azalée FR community / relais (~13k)
// - InazumaSeries : Inazuma Eleven Series — officiel global EN (~34k)
// - Level5Hub : Level-5 Hub — news/leaks ES très actif (~3k, fort engagement)
//
// Comptes communauté/news haut-signal découverts via bxc x search (2026-06),
// vérifiés réels, centrés Inazuma Eleven (≠ news jeux généralistes bruyantes) :
// - DartsEnthusiast : EN news/analyse IE (~3.4k, stats DL, INA-DAI, leaks)
// - InazumaNational : EN clips/comparatifs IE (~11k)
// - ShinAngelico    : ES leaker/news IE (~22k, gros engagement trailers/DLC)
// - Braco_Frost     : ES news/leaks IE (~? , annonces DLC/mundial)
//
// Découverts / testés (low activity ou non-officiel principal, conservés pour complétude):
// - InazumaElevenEN (EN, 3 followers, 0 tweets récents)
// - inazuma_eleven (fan/low, ~150)
// - hino_akihiro (low, 2 followers, 0 tweets)
// Non retenus (news jeux GÉNÉRALISTES — timeline trop bruyante pour le RAG IEVR,
// captés à la place par requêtes de recherche dans harvest-search.ts) :
// - gematsu, famitsu, siliconera, NinEverything, RPGSite, GoNintendoTweet…
// Non existants / erreurs UserByScreenName missing result:
// - inazuma_global, LEVEL5_official (pas de compte actif sous ces handles au moment du fetch).
//
// Usage: import { OFFICIAL_X_ACCOUNTS } from "./x-accounts";
// Le crawlTwitter reste additif (même signature), consomme cette liste par défaut.
// La découverte par requêtes (multi-langue, news/communauté) passe par
// crawlTwitterSearch (harvest-search.ts) — complémentaire des timelines ci-dessous.

export const OFFICIAL_X_ACCOUNTS = [
	"inazuma_project", // 公式 JP principal
	"inazuma_cross", // 公式 JP — jeu mobile Inazuma Eleven Cross
	"AkihiroHino", // CEO LEVEL-5
	"LEVEL5_times", // LEVEL-5 officiel
	"Azalee_IE", // FR
	"InazumaSeries", // Series / officiel global EN
	"Level5Hub", // news/leaks ES actif
	// communauté / news haut-signal centrés IE (découverte search bxc 2026-06)
	"DartsEnthusiast", // EN news/analyse
	"InazumaNational", // EN clips/comparatifs
	"ShinAngelico", // ES leaker/news
	"Braco_Frost", // ES news/leaks
	// low / fallback (gardés pour historique / search discovery, peuvent retourner 0)
	"InazumaElevenEN",
	"inazuma_eleven",
	"hino_akihiro",
] as const;

export type OfficialXAccount = (typeof OFFICIAL_X_ACCOUNTS)[number];

/** Comptes prioritaires (fort volume + activité) — pour crawls rapides ou filtrage RAG. */
export const PRIMARY_X_ACCOUNTS: readonly OfficialXAccount[] = [
	"inazuma_project",
	"inazuma_cross",
	"AkihiroHino",
	"LEVEL5_times",
	"Azalee_IE",
	"InazumaSeries",
] as const;

/** Retourne la liste complète (ou primaire si opt-in). */
export function getOfficialXAccounts(primaryOnly = false): readonly string[] {
	return primaryOnly ? PRIMARY_X_ACCOUNTS : OFFICIAL_X_ACCOUNTS;
}

/** Helper: charge cookie bxc xcom.json (si présent) et renvoie "auth_token=..; ct0=.." pour XSession.fromCookieString. */
export function loadBxcXCookieHeader(): string | null {
	try {
		const fs = require("node:fs") as typeof import("node:fs");
		const path = "/home/ubuntu/.bxc/cookies/xcom.json";
		if (!fs.existsSync(path)) return null;
		const cookies = JSON.parse(fs.readFileSync(path, "utf-8")) as Array<{ name: string; value: string }>;
		const auth = cookies.find((c) => c.name === "auth_token");
		const ct0 = cookies.find((c) => c.name === "ct0");
		if (!auth?.value || !ct0?.value) return null;
		return `auth_token=${auth.value}; ct0=${ct0.value}`;
	} catch {
		return null;
	}
}
