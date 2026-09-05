/**
 * Data layer serveur de l'index de texte de jeu IEVR — résout un `hashId` (ou
 * une catégorie) vers le VRAI texte du jeu (noms perso/objet/technique,
 * descriptions, dialogues…) dans les 3 langues décodées (fr/en/ja).
 *
 * Source : NDJSON gzippés trackés `data/game-text-names.ndjson.gz` (43+ dicts
 * racine, ~3,5 Mo) + `data/game-text-dialogue.ndjson.gz` (event/map/phase/purpose,
 * ~2,1 Mo), générés par `scripts/build-game-text-index.ts` depuis le dump via
 * `@rosegriffon/inagle`. Au premier accès on MATÉRIALISE la table `text` dans un
 * SQLite de cache (singleton process-local) puis on requête en O(log n).
 *
 * ⚠ module **serveur** : ne JAMAIS importer ce module depuis un composant
 * `"use client"` (il touche `bun:sqlite` / Node fs). Les types + helpers purs
 * vivent dans `lib/game-text/shared.ts`, client-safe.
 */

import type { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";
import { getCacheDir, resolveDataFile } from "../config";
import { gunzipSync } from "node:zlib";
import { buildSqliteFromEntries, type TextEntry } from "./materialize";
import {
	type GameText,
	type GameTextLocale,
	type GameTextLocalized,
	normalizeHashId,
} from "./shared";

export type { GameText, GameTextLocalized } from "./shared";
export { normalizeHashId, pickLocale } from "./shared";

// --- Localisation des artefacts source (NDJSON gz) -------------------------

const ARTEFACTS = ["game-text-names.ndjson.gz", "game-text-dialogue.ndjson.gz"];

function resolveSourcePaths(): string[] {
	// `GAME_TEXT_DATA_DIR` reste prioritaire (compat) ; sinon la résolution
	// commune de `config.ts`.
	const pinnedRoot = process.env.GAME_TEXT_DATA_DIR;
	const found: string[] = [];
	for (const name of ARTEFACTS) {
		if (pinnedRoot) {
			const pinned = path.join(pinnedRoot, name);
			if (existsSync(pinned)) {
				found.push(pinned);
				continue;
			}
		}
		const resolved = resolveDataFile(name);
		if (resolved) found.push(resolved);
	}
	return found;
}

// --- Chargement / matérialisation (singleton) ------------------------------

let _db: Database | null = null;

type DatabaseConstructor = typeof import("bun:sqlite").Database;

function readEntries(srcPath: string): TextEntry[] {
	const gz = readFileSync(srcPath);
	const ndjson = gunzipSync(gz).toString("utf8");
	const entries: TextEntry[] = [];
	for (const line of ndjson.split("\n")) {
		if (!line) continue;
		const parsed = JSON.parse(line) as TextEntry;
		if (Array.isArray(parsed) && parsed.length === 4) entries.push(parsed);
	}
	return entries;
}

/**
 * Versionne le cache sur les artefacts réellement lus. Plusieurs workers
 * peuvent ainsi préparer la même version dans des fichiers distincts sans se
 * verrouiller mutuellement ; un cache publié ne sera jamais reconstruit en
 * place sous un lecteur actif.
 */
function cachePath(cacheDir: string, sources: string[]): string {
	const fingerprint = createHash("sha256")
		.update(
			sources
				.map((source) => {
					const stat = statSync(source);
					return `${source}\0${stat.size}\0${stat.mtimeMs}`;
				})
				.join("\n")
		)
		.digest("hex")
		.slice(0, 20);
	return path.join(cacheDir, `game-text-${fingerprint}.sqlite`);
}

function openReadyCache(DatabaseConstructor: DatabaseConstructor, dbPath: string): Database | null {
	if (!existsSync(dbPath)) return null;
	let db: Database | null = null;
	try {
		db = new DatabaseConstructor(dbPath, { readonly: true });
		const ready = db
			.query<{ name: string }, []>(
				"SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'text' LIMIT 1"
			)
			.get();
		if (!ready) {
			db.close();
			return null;
		}
		db.exec("PRAGMA temp_store = MEMORY");
		return db;
	} catch {
		db?.close();
		return null;
	}
}

function removeCacheArtifact(filePath: string): void {
	try {
		unlinkSync(filePath);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
	}
}

/** Ouvre (ou matérialise) le SQLite de l'index de texte. Singleton process-local. */
function getDb(): Database {
	if (_db) return _db;
	// Import dynamique : `bun:sqlite` n'est résolu que côté serveur Bun.
	const { Database } = require("bun:sqlite") as typeof import("bun:sqlite");

	const sources = resolveSourcePaths();
	if (sources.length === 0) {
		throw new Error(
			"[game-text] aucun artefact game-text-*.ndjson.gz trouvé (lancer scripts/build-game-text-index.ts)"
		);
	}

	const cacheDir = getCacheDir("azalee-game-text");
	mkdirSync(cacheDir, { recursive: true });
	const DBConstructor = require("bun:sqlite").Database as DatabaseConstructor;
	const dbPath = cachePath(cacheDir, sources);
	const cached = openReadyCache(DBConstructor, dbPath);
	if (cached) {
		_db = cached;
		return cached;
	}

	const buildPath = `${dbPath}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;
	let db: Database | null = null;
	const all: TextEntry[] = [];
	try {
		db = new DBConstructor(buildPath, { create: true });
		for (const src of sources) all.push(...readEntries(src));
		buildSqliteFromEntries(db, all);
		db.close();
		db = null;

		// Le premier worker publie ; les suivants conservent le cache complet
		// déjà publié et suppriment uniquement leur fichier temporaire.
		if (!existsSync(dbPath)) {
			try {
				renameSync(buildPath, dbPath);
			} catch (error) {
				if (!existsSync(dbPath)) throw error;
			}
		}

		const ready = openReadyCache(DBConstructor, dbPath);
		if (!ready) throw new Error("[game-text] le cache SQLite matérialisé est illisible");
		_db = ready;
		return ready;
	} finally {
		if (db) db.close();
		removeCacheArtifact(buildPath);
		removeCacheArtifact(`${buildPath}-wal`);
		removeCacheArtifact(`${buildPath}-shm`);
	}
}

// --- API de lecture --------------------------------------------------------

/** Résout un hashId vers ses textes fr/en/ja (+ catégorie). `undefined` si inconnu. */
export function getText(hashId: string | number): GameTextLocalized | undefined {
	const key = normalizeHashId(hashId);
	const rows = getDb()
		.query<{ locale: string; category: string; value: string }, [string]>(
			"SELECT locale, category, value FROM text WHERE hashId = ?"
		)
		.all(key);
	if (rows.length === 0) return undefined;
	const out: GameTextLocalized = { hashId: key, category: rows[0]?.category };
	for (const r of rows) {
		if (r.locale === "fr") out.fr = r.value;
		else if (r.locale === "en") out.en = r.value;
		else if (r.locale === "ja") out.ja = r.value;
	}
	return out;
}

/** Résout un hashId dans une langue précise (avec repli fr → en → ja). */
export function getTextLocale(
	hashId: string | number,
	locale: GameTextLocale = "fr"
): string | undefined {
	const t = getText(hashId);
	if (!t) return undefined;
	return t[locale] ?? t.fr ?? t.en ?? t.ja;
}

/** Résout plusieurs hashIds d'un coup (1 requête par lot de 500). */
export function getTexts(hashIds: Array<string | number>): Map<string, GameTextLocalized> {
	const out = new Map<string, GameTextLocalized>();
	const keys = [...new Set(hashIds.map(normalizeHashId))];
	const db = getDb();
	for (let i = 0; i < keys.length; i += 500) {
		const batch = keys.slice(i, i + 500);
		const placeholders = batch.map(() => "?").join(",");
		const rows = db
			.query<{ hashId: string; locale: string; category: string; value: string }, string[]>(
				`SELECT hashId, locale, category, value FROM text WHERE hashId IN (${placeholders})`
			)
			.all(...batch);
		for (const r of rows) {
			let entry = out.get(r.hashId);
			if (!entry) {
				entry = { hashId: r.hashId, category: r.category };
				out.set(r.hashId, entry);
			}
			if (r.locale === "fr") entry.fr = r.value;
			else if (r.locale === "en") entry.en = r.value;
			else if (r.locale === "ja") entry.ja = r.value;
		}
	}
	return out;
}

/** Liste les entrées d'une catégorie pour une langue (pagination simple). */
export function listCategory(
	category: string,
	locale: GameTextLocale = "fr",
	limit = 200,
	offset = 0
): GameText[] {
	return getDb()
		.query<GameText, [string, string, number, number]>(
			"SELECT hashId, locale, category, value FROM text WHERE category = ? AND locale = ? ORDER BY hashId LIMIT ? OFFSET ?"
		)
		.all(category, locale, limit, offset);
}

/** Recherche plein-texte naïve (`value LIKE %q%`) dans une langue. */
export function searchText(query: string, locale: GameTextLocale = "fr", limit = 50): GameText[] {
	return getDb()
		.query<GameText, [string, string, number]>(
			"SELECT hashId, locale, category, value FROM text WHERE locale = ? AND value LIKE ? LIMIT ?"
		)
		.all(locale, `%${query}%`, limit);
}

/** Stats : nombre d'entrées par catégorie (langue fr). */
export function categoryStats(): Array<{ category: string; count: number }> {
	return getDb()
		.query<{ category: string; count: number }, [string]>(
			"SELECT category, COUNT(*) as count FROM text WHERE locale = ? GROUP BY category ORDER BY count DESC"
		)
		.all("fr");
}
