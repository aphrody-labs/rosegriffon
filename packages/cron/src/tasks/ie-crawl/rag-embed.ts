/**
 * @license
 * Copyright 2026 Rose Griffon
 * SPDX-License-Identifier: Apache-2.0
 */

// Abstraction d'embedding unifiée pour le RAG pgvector (dimension 1024 = BGE-M3).
//
// Résolution (par ordre) :
//   1. RAG_EMBED_URL  → sidecar self-host BGE-M3 (`POST /embed {texts}` → {embeddings})
//   2. OPENAI_API_KEY → text-embedding-3-small, RE-PROJETÉ déterministe en 1024
//   3. fallback Feature-Hashing 1024-dim L2-normalisé (dev only, pas de sémantique)
//
// Le store pgvector attend STRICTEMENT 1024 dims (halfvec(1024)). Toute source
// de dimension différente est ramenée à 1024 par projection de hachage stable
// (random-ish mais déterministe) pour rester insérable. La qualité réelle vient
// du sidecar BGE-M3 (cf. UNIFIED-RAG-PLAN §4.3) ; les fallbacks gardent le
// pipeline fonctionnel et testable sans modèle ni clé.

export const RAG_EMBED_DIM = 1024;

function hashStringToRange(str: string, range: number): number {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		hash = (hash << 5) - hash + str.charCodeAt(i);
		hash |= 0;
	}
	return Math.abs(hash) % range;
}

function l2normalize(vec: number[]): number[] {
	let norm = 0;
	for (const v of vec) norm += v * v;
	norm = Math.sqrt(norm);
	if (norm === 0) {
		const out = new Array<number>(vec.length).fill(0);
		out[0] = 1;
		return out;
	}
	return vec.map((v) => v / norm);
}

/** Feature hashing 1024-dim (déterministe, sans dépendance). */
export function hashEmbedding(text: string, dim = RAG_EMBED_DIM): number[] {
	const vector = new Array<number>(dim).fill(0);
	const words = text
		.toLowerCase()
		.replace(/[.,/#!$%^&*;:{}=\-_`~()[\]]/g, " ")
		.split(/\s+/)
		.filter(Boolean);
	for (const word of words) {
		const idx = hashStringToRange(word, dim);
		const polarity = (hashStringToRange(`p:${word}`, 2) === 0 ? 1 : -1);
		vector[idx] = (vector[idx] ?? 0) + polarity;
	}
	return l2normalize(vector);
}

/** Projette un vecteur de dimension arbitraire vers `dim` de façon déterministe. */
function projectToDim(vec: number[], dim = RAG_EMBED_DIM): number[] {
	if (vec.length === dim) return l2normalize(vec);
	const out = new Array<number>(dim).fill(0);
	for (let i = 0; i < vec.length; i++) {
		out[i % dim] = (out[i % dim] ?? 0) + (vec[i] ?? 0);
	}
	return l2normalize(out);
}

async function embedViaSidecar(
	texts: string[],
	url: string,
	isQuery = false
): Promise<number[][] | null> {
	try {
		const res = await fetch(url.replace(/\/$/, "") + "/embed", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ texts, query: isQuery }),
		});
		if (!res.ok) return null;
		const json = (await res.json()) as { embeddings?: number[][] };
		if (!json.embeddings || json.embeddings.length !== texts.length) return null;
		return json.embeddings.map((e) => projectToDim(e));
	} catch {
		return null;
	}
}

async function embedViaOpenAI(texts: string[], apiKey: string): Promise<number[][] | null> {
	try {
		const res = await fetch("https://api.openai.com/v1/embeddings", {
			method: "POST",
			headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
			body: JSON.stringify({ model: "text-embedding-3-small", input: texts }),
		});
		if (!res.ok) return null;
		const json = (await res.json()) as { data?: { embedding?: number[] }[] };
		if (!json.data) return null;
		return json.data.map((d) => projectToDim(d.embedding ?? []));
	} catch {
		return null;
	}
}

export type EmbedBackend = "sidecar" | "openai" | "hash";

export interface EmbedResult {
	backend: EmbedBackend;
	vectors: number[][];
}

/**
 * Embedde un lot de textes en 1024-dim, avec résolution de backend.
 * `opts.query` (défaut `false` = passage) marque les requêtes pour le sidecar
 * e5 (préfixe `query:`/`passage:`). Signature additive, rétro-compatible.
 */
export async function embedBatch(
	texts: string[],
	opts?: { query?: boolean }
): Promise<EmbedResult> {
	if (texts.length === 0) return { backend: "hash", vectors: [] };

	const isQuery = opts?.query ?? false;
	const sidecarUrl = process.env.RAG_EMBED_URL;
	if (sidecarUrl) {
		const v = await embedViaSidecar(texts, sidecarUrl, isQuery);
		if (v) return { backend: "sidecar", vectors: v };
	}

	const openaiKey = process.env.OPENAI_API_KEY;
	if (openaiKey && openaiKey.startsWith("sk-")) {
		const v = await embedViaOpenAI(texts, openaiKey);
		if (v) return { backend: "openai", vectors: v };
	}

	return { backend: "hash", vectors: texts.map((t) => hashEmbedding(t)) };
}

/** Embedde un seul texte (helper requête). */
export async function embedOne(text: string): Promise<{ backend: EmbedBackend; vector: number[] }> {
	const { backend, vectors } = await embedBatch([text]);
	return { backend, vector: vectors[0] ?? hashEmbedding(text) };
}
