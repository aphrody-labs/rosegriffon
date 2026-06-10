/**
 * Data layer SERVEUR du hub « Inazuma Eleven Cross » (`/cross/*`).
 *
 * Source = artefacts d'extraction statique trackés sous `data/cross/*` (dump
 * IL2CPP + catalogue Addressables). Petits JSON → import direct (tracé par le
 * build standalone, bundle serveur uniquement). Le gros catalogue (25 328
 * objets) vit en `catalog-index.ndjson.gz` et est matérialisé à part par
 * `lib/cross/catalog.ts` (pattern singleton, comme `lib/cpk`).
 *
 * ⚠ `import "server-only"` — ne pas importer depuis un composant `"use client"`.
 * Les types + helpers purs sont dans `lib/cross/data-shared.ts`.
 */
import "server-only";

import schemaJson from "@/data/cross/masterdata-schema.json";
import enumsJson from "@/data/cross/enums.json";
import statusJson from "@/data/cross/extraction-status.json";
import audioJson from "@/data/cross/audio-manifest.json";
import statsJson from "@/data/cross/catalog-stats.json";
import type {
	CrossAudioManifest,
	CrossEnums,
	CrossExtractionStatus,
	CrossSchema,
	CrossTable,
} from "@/lib/cross/data-shared";
import { tableSlug } from "@/lib/cross/data-shared";

const SCHEMA = schemaJson as unknown as CrossSchema;
const ENUMS = enumsJson as unknown as CrossEnums;

export function getCrossStatus(): CrossExtractionStatus {
	return statusJson as unknown as CrossExtractionStatus;
}

export function getCrossAudio(): CrossAudioManifest {
	return audioJson as unknown as CrossAudioManifest;
}

/** Stats agrégées du catalogue Addressables (totaux/types/localisation/audio). */
export function getCrossCatalogStats(): Record<string, unknown> {
	return statsJson as Record<string, unknown>;
}

/** Une table masterdata enrichie de son nom court. */
export interface CrossTableSummary {
	slug: string;
	short: string;
	fullName: string;
	file: string;
	columnCount: number;
	refCount: number;
	enumCount: number;
	extends: string | null;
}

/** Toutes les tables masterdata (153), triées, en résumé. Filtre `q` optionnel. */
export function getCrossTables(q?: string): CrossTableSummary[] {
	const needle = (q ?? "").trim().toLowerCase();
	const out: CrossTableSummary[] = [];
	for (const [fullName, t] of Object.entries(SCHEMA)) {
		const short = fullName.split(".").pop() ?? fullName;
		if (needle && !short.toLowerCase().includes(needle) && !t.file.toLowerCase().includes(needle))
			continue;
		out.push({
			slug: tableSlug(fullName),
			short,
			fullName,
			file: t.file,
			columnCount: t.columns.length,
			refCount: t.columns.filter((c) => c.kind === "ref").length,
			enumCount: t.columns.filter((c) => c.kind === "enum").length,
			extends: t.extends,
		});
	}
	out.sort((a, b) => a.short.localeCompare(b.short));
	return out;
}

/** Détail d'une table par slug (nom court). `null` si inconnue. */
export function getCrossTable(slug: string): (CrossTable & { short: string }) | null {
	for (const [fullName, t] of Object.entries(SCHEMA)) {
		const short = fullName.split(".").pop() ?? fullName;
		if (short === slug) return { ...t, short };
	}
	return null;
}

/** Les enums (214), triés par nom court. Filtre `q` optionnel. */
export function getCrossEnums(q?: string): { name: string; short: string; members: { name: string; value: number }[] }[] {
	const needle = (q ?? "").trim().toLowerCase();
	const out = Object.entries(ENUMS).map(([name, members]) => ({
		name,
		short: name.split(".").pop() ?? name,
		members,
	}));
	const filtered = needle
		? out.filter((e) => e.short.toLowerCase().includes(needle))
		: out;
	filtered.sort((a, b) => a.short.localeCompare(b.short));
	return filtered;
}

/** Compteurs globaux du modèle de données (pour les en-têtes). */
export function getCrossDataCounts(): {
	tables: number;
	columns: number;
	enums: number;
	refs: number;
} {
	let columns = 0;
	let refs = 0;
	for (const t of Object.values(SCHEMA)) {
		columns += t.columns.length;
		refs += t.columns.filter((c) => c.kind === "ref").length;
	}
	return { tables: Object.keys(SCHEMA).length, columns, enums: Object.keys(ENUMS).length, refs };
}
