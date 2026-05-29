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
	}, 60000);

	it("should fetch Inazuma Eleven Victory Road topics index", async () => {
		const profile = process.env.BXC_PROFILE || "stealth";
		console.log(`[Test BXC] Connexion à l'index des topics avec profil : ${profile}`);

		const page = (await Browser.newPage({
			profile: profile as "stealth" | "max" | "static" | "fast" | "http",
		})) as Page;

		try {
			const url = "https://www.inazuma.jp/victory-road/topics/";
			console.log(`[Test BXC] Navigation vers ${url}...`);
			await page.goto(url);
			await page.waitForSelector("body", 15000).catch(() => {});

			const content = await page.content();
			expect(content).toContain("victory-road");
			console.log("[Test BXC] Index Inazuma Eleven validé avec succès.");
		} finally {
			await page.close();
		}
	}, 60000);

	it("should fetch awesome-markdown raw README", async () => {
		console.log("[Test BXC] Fetching raw awesome-markdown README...");
		const res = await fetch(
			"https://raw.githubusercontent.com/mundimark/awesome-markdown/master/README.md"
		);
		expect(res.status).toBe(200);
		const text = await res.text();
		expect(text).toContain("Awesome Markdown");
		console.log("[Test BXC] awesome-markdown README validé avec succès.");
	}, 20000);

	it("should fetch Bun markdown docs raw source", async () => {
		console.log("[Test BXC] Fetching raw Bun markdown MDX...");
		const res = await fetch(
			"https://raw.githubusercontent.com/oven-sh/bun/main/docs/runtime/markdown.mdx"
		);
		expect(res.status).toBe(200);
		const text = await res.text();
		expect(text).toContain("Bun.markdown");
		console.log("[Test BXC] Bun markdown docs raw source validé avec succès.");
	}, 20000);
});
