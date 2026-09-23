import { describe, expect, mock, test } from "bun:test";

mock.module("@/lib/db/pg", () => ({
	getPgPool: () => ({
		query: async () => {
			throw new Error("database unavailable");
		},
	}),
}));

const { GET } = await import("./route");

describe("GET /api/recherche", () => {
	test("distingue une panne de base d'une recherche vide", async () => {
		const logError = console.error;
		console.error = mock(() => {});
		try {
			const response = await GET(new Request("http://localhost/api/recherche?q=axel"));
			expect(response.status).toBe(503);
			expect(await response.json()).toMatchObject({
				erreur: "Recherche temporairement indisponible",
			});
		} finally {
			console.error = logError;
		}
	});

	test("une requête trop courte retourne une liste vide sans interroger la base", async () => {
		const response = await GET(new Request("http://localhost/api/recherche?q=a"));
		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({ resultats: [] });
	});
});
