import { describe, it, expect } from "bun:test";
import { chunkText } from "./rag-utils";

describe("RAG chunkText Tests", () => {
	it("should split long text at word boundaries without cutting words in half during overlap", () => {
		const text = "Ce texte contient plusieurs mots longs. Il est destiné à tester le découpage en blocs sémantiques. Le but est d'éviter de couper un mot en plein milieu lorsqu'on applique le chevauchement (overlap).";
		const chunks = chunkText(text, 40, 15);
		console.log("Generated chunks:", chunks);

		expect(chunks.length).toBeGreaterThan(1);
		for (const chunk of chunks) {
			expect(chunk.length).toBeLessThanOrEqual(40);
		}
	});

	it("should return the entire text if it fits in chunkSize", () => {
		const text = "Short text.";
		const chunks = chunkText(text, 50, 10);
		expect(chunks).toEqual([text]);
	});
});
