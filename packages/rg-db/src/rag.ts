/**
 * @license
 * Copyright 2026 Rose Griffon
 * SPDX-License-Identifier: Apache-2.0
 */

// RAG unifié pgvector — couche partagée (db) consommable par azalee (GraphQL /
// REST / server actions) ET le cron. Recherche hybride dense (HNSW cosine) +
// lexical (tsvector) fusionnée par RRF via la RPC Postgres `rag_hybrid_search`.
// Voir iecode/re/rag/UNIFIED-RAG-PLAN.md.
//
// Additif : ne remplace PAS `getEmbedding`/`vectorStore` de ./redis. Le store
// Redis reste branché ; cette voie lit `inagle_rag_chunks` (pgvector).

export const RAG_EMBED_DIM = 1024;

export type RagSourceKind =
	| "lua"
	| "cfg"
	| "json"
	| "ts"
	| "sqlite"
	| "code"
	| "web"
	| "tweet"
	| "doc"
	| "asset";

/**
 * Format enrichi tweet pour chunk RAG (auteur + date + métriques + texte).
 * Utilisé par ingestion cron (x/tweets) pour brancher sur pgvector avec contexte complet.
 * Additif (ne change pas ragSearch/embed).
 */
export function formatTweetForRag(t: {
	id: string;
	author_username?: string | null;
	author_name?: string | null;
	text?: string | null;
	created_at?: string | null;
	metrics?: unknown;
	media?: unknown;
}): string {
	const u = t.author_username ? `@${t.author_username}` : "unknown";
	const n = t.author_name ? ` (${t.author_name})` : "";
	const d = t.created_at ? ` ${String(t.created_at).slice(0, 10)}` : "";
	let m = "";
	if (t.metrics && typeof t.metrics === "object") {
		const mm = t.metrics as Record<string, unknown>;
		m = ` metrics:${Object.entries(mm)
			.map(([k, v]) => `${k}=${v}`)
			.join(" ")}`;
	}
	const mediaNote = Array.isArray(t.media) && (t.media as any[]).length > 0 ? " [media]" : "";
	return `[tweet ${t.id}] ${u}${n}${d}${m}${mediaNote}\n${t.text || ""}`.trim();
}

export interface RagChunkResult {
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

/** Client Supabase minimal requis (service ou anon). */
export interface RagSupabaseClient {
	rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
}

function hashStringToRange(str: string, range: number): number {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		hash = (hash << 5) - hash + str.charCodeAt(i);
		hash |= 0;
	}
	return Math.abs(hash) % range;
}

/**
 * Embedding requête 1024-dim. Résolution : sidecar BGE-M3 (`RAG_EMBED_URL`) →
 * OpenAI text-embedding-3-small (re-projeté) → Feature-Hashing déterministe.
 * Doit rester aligné sur `cron/.../rag-embed.ts` (même algorithme de hashing).
 */
export async function ragEmbedQuery(text: string): Promise<number[]> {
	const dim = RAG_EMBED_DIM;

	const sidecar = process.env.RAG_EMBED_URL;
	if (sidecar) {
		try {
			const res = await fetch(sidecar.replace(/\/$/, "") + "/embed", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ texts: [text] }),
			});
			if (res.ok) {
				const json = (await res.json()) as { embeddings?: number[][] };
				const e = json.embeddings?.[0];
				if (e) return projectAndNormalize(e, dim);
			}
		} catch {
			/* fallback */
		}
	}

	const key = process.env.OPENAI_API_KEY;
	if (key && key.startsWith("sk-")) {
		try {
			const res = await fetch("https://api.openai.com/v1/embeddings", {
				method: "POST",
				headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
				body: JSON.stringify({ model: "text-embedding-3-small", input: text }),
			});
			if (res.ok) {
				const json = (await res.json()) as { data?: { embedding?: number[] }[] };
				const e = json.data?.[0]?.embedding;
				if (e) return projectAndNormalize(e, dim);
			}
		} catch {
			/* fallback */
		}
	}

	// Feature hashing 1024-dim.
	const vector = new Array<number>(dim).fill(0);
	const words = text
		.toLowerCase()
		.replace(/[.,/#!$%^&*;:{}=\-_`~()[\]]/g, " ")
		.split(/\s+/)
		.filter(Boolean);
	for (const word of words) {
		const idx = hashStringToRange(word, dim);
		const polarity = hashStringToRange(`p:${word}`, 2) === 0 ? 1 : -1;
		vector[idx] = (vector[idx] ?? 0) + polarity;
	}
	return normalize(vector, dim);
}

function projectAndNormalize(vec: number[], dim: number): number[] {
	if (vec.length === dim) return normalize(vec, dim);
	const out = new Array<number>(dim).fill(0);
	for (let i = 0; i < vec.length; i++) out[i % dim] = (out[i % dim] ?? 0) + (vec[i] ?? 0);
	return normalize(out, dim);
}

function normalize(vec: number[], dim: number): number[] {
	let norm = 0;
	for (const v of vec) norm += v * v;
	norm = Math.sqrt(norm);
	if (norm === 0) {
		const out = new Array<number>(dim).fill(0);
		out[0] = 1;
		return out;
	}
	return vec.map((v) => v / norm);
}

function toPgVector(vec: number[]): string {
	return `[${vec.join(",")}]`;
}

/** Recherche RAG hybride (dense + lexical, RRF) sur `inagle_rag_chunks`. */
export async function ragSearch(
	supabase: RagSupabaseClient,
	query: string,
	opts: { k?: number; kinds?: RagSourceKind[] } = {}
): Promise<RagChunkResult[]> {
	if (!query || query.trim().length < 2) return [];
	const emb = await ragEmbedQuery(query);
	const { data, error } = await supabase.rpc("rag_hybrid_search", {
		q_text: query,
		q_emb: toPgVector(emb),
		k: opts.k ?? 10,
		kinds: opts.kinds ?? null,
	});
	if (error) {
		console.warn("[db/rag] rag_hybrid_search échec:", (error as { message?: string })?.message);
		return [];
	}
	return (data as RagChunkResult[]) ?? [];
}
