/**
 * @license
 * Copyright 2026 Rose Griffon
 * SPDX-License-Identifier: Apache-2.0
 */

// Store vectoriel pgvector (Supabase `inagle_rag_chunks` + RPC `rag_hybrid_search`).
// Remplace à terme le vectorStore Redis O(n) (cf. UNIFIED-RAG-PLAN §2/§4.2).
// Le store Redis reste branché en parallèle (compat) ; la prod lit pgvector.

import { createSupabaseServiceClient } from "@rose-griffon/db/service";
import { computeStringHash } from "./rag-utils";
import { chunkBySource, type SourceKind } from "./rag-chunkers";
import { embedBatch, embedOne, RAG_EMBED_DIM, type EmbedBackend } from "./rag-embed";

export interface RagSource {
	/** Identifiant stable de la source parente (doc/entité/fichier). */
	sourceId: string;
	kind: SourceKind;
	/** Contenu brut à découper, OU chunks déjà prêts (web/tweet). */
	raw: string;
	title?: string;
	url?: string;
	lang?: string;
	meta?: Record<string, unknown>;
	buildid?: number;
}

export interface IngestStats {
	sources: number;
	chunks: number;
	skipped: number;
	backend: EmbedBackend;
}

/** Sérialise un vecteur 1024 au format texte pgvector `[a,b,…]`. */
function toPgVector(vec: number[]): string {
	if (vec.length !== RAG_EMBED_DIM) {
		throw new Error(`embedding dim ${vec.length} != ${RAG_EMBED_DIM}`);
	}
	return `[${vec.join(",")}]`;
}

/** Ingestion idempotente d'un lot de sources dans pgvector. */
export async function ingestSources(sources: RagSource[]): Promise<IngestStats> {
	const supabase = createSupabaseServiceClient();
	const stats: IngestStats = { sources: 0, chunks: 0, skipped: 0, backend: "hash" };

	for (const src of sources) {
		const chunks = chunkBySource(src.kind, src.raw).filter((c) => c.content.trim().length >= 20);
		if (chunks.length === 0) {
			stats.skipped++;
			continue;
		}

		const texts = chunks.map((c) => {
			const header = `[${src.kind}] ${src.title ?? src.sourceId}${c.symbol ? ` :: ${c.symbol}` : ""}`;
			return `${header}\n${c.content}`;
		});

		const { backend, vectors } = await embedBatch(texts);
		stats.backend = backend;

		const rows = chunks.map((c, i) => {
			const content = texts[i]!;
			return {
				id: `${src.sourceId}#${c.index}`,
				source_id: src.sourceId,
				source_kind: src.kind,
				title: src.title ?? null,
				url: src.url ?? null,
				lang: src.lang ?? null,
				content,
				embedding: toPgVector(vectors[i]!),
				meta: { ...(src.meta ?? {}), symbol: c.symbol ?? null },
				content_hash: computeStringHash(content),
				buildid: src.buildid ?? null,
			};
		});

		const { error } = await (supabase as any)
			.from("inagle_rag_chunks")
			.upsert(rows, { onConflict: "id" });
		if (error) {
			console.error(`[RAG PG] upsert échec pour ${src.sourceId}:`, error.message);
			stats.skipped++;
			continue;
		}
		stats.sources++;
		stats.chunks += rows.length;
	}
	return stats;
}

export interface RagPgResult {
	id: string;
	source_id: string;
	source_kind: string;
	title: string | null;
	url: string | null;
	lang: string | null;
	content: string;
	meta: Record<string, unknown>;
	score: number;
}

/** Recherche hybride (dense HNSW + lexical tsvector, fusion RRF) via la RPC. */
export async function ragHybridSearch(
	query: string,
	opts: { k?: number; kinds?: SourceKind[] } = {}
): Promise<RagPgResult[]> {
	const supabase = createSupabaseServiceClient();
	const { vector } = await embedOne(query);

	const { data, error } = await (supabase as any).rpc("rag_hybrid_search", {
		q_text: query,
		q_emb: toPgVector(vector),
		k: opts.k ?? 10,
		kinds: opts.kinds ?? null,
	});
	if (error) {
		console.error("[RAG PG] rag_hybrid_search échec:", error.message);
		return [];
	}
	return (data ?? []) as RagPgResult[];
}
