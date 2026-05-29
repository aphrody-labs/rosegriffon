import { describe, it, expect, beforeAll } from "bun:test";
import { Browser, Page } from "@aphrody-code/bxc";

describe("BXC Engine Integration Tests", () => {
	beforeAll(() => {
		// Forcer l'utilisation du profil max pour les tests comme requis
		process.env.BXC_PROFILE = "max";
	});

	it("should boot browser with max profile and fetch example.com content", async () => {
		const profile = process.env.BXC_PROFILE || "stealth";
		console.log(`[Test BXC] Démarrage du navigateur (Profil: ${profile})...`);

		const page = (await Browser.newPage({
			profile: profile as "stealth" | "max" | "static" | "fast" | "http",
		})) as Page;

		expect(page).toBeDefined();

		try {
			console.log("[Test BXC] Navigation vers https://example.com...");
			await page.goto("https://example.com");
			await page.waitForSelector("h1", 10000).catch(() => {});

			const content = await page.content();
			expect(content).toContain("Example Domain");

			const title = await page.evaluate(
				() => (globalThis as unknown as { document: { title: string } }).document.title
			);
			console.log(`[Test BXC] Titre récupéré avec succès : "${title}"`);
			expect(title).toBe("Example Domain");
		} finally {
			await page.close();
		}
	}, 60000); // Grand timeout pour le démarrage à froid de Camoufox
});
