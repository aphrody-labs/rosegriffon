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
// - AkihiroHino : 日野晃博 CEO LEVEL-5 (~228k)
// - LEVEL5_times : レベルファイブ officiel (~134k)
// - Azalee_IE : Azalée FR community / relais (~13k)
// - InazumaSeries : Inazuma Eleven Series (~34k)
// - Level5Hub : Level-5 Hub secondaire (~3k)
//
// Découverts / testés (low activity ou non-officiel principal, conservés pour complétude):
// - InazumaElevenEN (EN, 3 followers, 0 tweets récents)
// - inazuma_eleven (fan/low, ~150)
// - hino_akihiro (low, 2 followers, 0 tweets)
// Non existants / erreurs UserByScreenName missing result:
// - inazuma_global, LEVEL5_official (pas de compte actif sous ces handles au moment du fetch).
//
// Usage: import { OFFICIAL_X_ACCOUNTS } from "./x-accounts";
// Le crawlTwitter reste additif (même signature), consomme cette liste par défaut.

export const OFFICIAL_X_ACCOUNTS = [
	"inazuma_project", // 公式 JP principal
	"AkihiroHino", // CEO LEVEL-5
	"LEVEL5_times", // LEVEL-5 officiel
	"Azalee_IE", // FR
	"InazumaSeries", // Series / EN-ish
	"Level5Hub", // Hub secondaire
	// low / fallback (gardés pour historique / search discovery, peuvent retourner 0)
	"InazumaElevenEN",
	"inazuma_eleven",
	"hino_akihiro",
] as const;

export type OfficialXAccount = (typeof OFFICIAL_X_ACCOUNTS)[number];

/** Comptes prioritaires (fort volume + activité) — pour crawls rapides ou filtrage RAG. */
export const PRIMARY_X_ACCOUNTS: readonly OfficialXAccount[] = [
	"inazuma_project",
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
