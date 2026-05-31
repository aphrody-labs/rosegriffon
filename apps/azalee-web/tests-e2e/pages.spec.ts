import { test, expect, type Page } from "@playwright/test";

async function waitForPageImages(page: Page) {
	await page.waitForLoadState("domcontentloaded");
	await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
	await page.evaluate(async () => {
		const imgs = Array.from(document.querySelectorAll("img"));
		await Promise.all(
			imgs.map((img) => {
				if (img.complete) return Promise.resolve();
				return new Promise((resolve) => {
					const timeout = setTimeout(() => resolve(null), 2000);
					img.addEventListener("load", () => {
						clearTimeout(timeout);
						resolve(null);
					});
					img.addEventListener("error", () => {
						clearTimeout(timeout);
						resolve(null);
					});
				});
			})
		);
	});
	// Wait a tiny bit for layout animations or fonts to stabilize
	await page.waitForTimeout(1000);
}

// Live database IDs fetched from Supabase
const TEST_SLUGS = {
	character: "buddy-0x6A6392AD",
	skill: "bcps10001",
	item: "0x5F0F1EAC",
	tactic: "0x790F3F39",
	auraCategory: "esprits-guerriers",
	auraId: "keshin_0x0181A884",
	news: "welcome",
	patchNote: "ps-steam_ver_1_4_2",
};

test.describe("Visual Regression - Static Pages", () => {
	const staticPages = [
		{ name: "home", path: "/" },
		{ name: "contact", path: "/contact" },
		{ name: "soutenir", path: "/soutenir" },
		{ name: "passive", path: "/passive" },
		{ name: "search", path: "/search" },
		{ name: "tools", path: "/tools" },
		{ name: "tools-translator", path: "/tools/translator" },
		{ name: "tools-random-team", path: "/tools/random-team" },
		{ name: "tools-compare", path: "/tools/compare" },
		{ name: "tactic-list", path: "/tactic" },
		{ name: "chara-list", path: "/chara" },
		{ name: "charte", path: "/charte" },
		{ name: "item-list", path: "/item" },
		{ name: "legal-cgu", path: "/legal/cgu" },
		{ name: "legal-mentions-legales", path: "/legal/mentions-legales" },
		{ name: "legal-confidentialite", path: "/legal/confidentialite" },
		{ name: "aura-list", path: "/aura" },
		{ name: "news-list", path: "/news" },
		{ name: "login", path: "/login" },
		{ name: "maintenance", path: "/maintenance" },
		{ name: "skill-list", path: "/skill" },
	];

	for (const pageInfo of staticPages) {
		test(`page - ${pageInfo.name}`, async ({ page }) => {
			await page.goto(pageInfo.path);
			await waitForPageImages(page);

			// Assert page screenshot matches baseline
			await expect(page).toHaveScreenshot(`${pageInfo.name}.png`, {
				fullPage: true,
				mask: [page.locator(".animate-pulse")], // Mask elements with animations to prevent diffs
				maxDiffPixelRatio: 0.05,
			});
		});
	}
});

test.describe("Visual Regression - Dynamic Detail Pages", () => {
	const dynamicPages = [
		{ name: "character-detail", path: `/chara/${TEST_SLUGS.character}` },
		{ name: "skill-detail", path: `/skill/${TEST_SLUGS.skill}` },
		{ name: "item-detail", path: `/item/${TEST_SLUGS.item}` },
		{ name: "tactic-detail", path: `/tactic/${TEST_SLUGS.tactic}` },
		{ name: "aura-detail", path: `/aura/${TEST_SLUGS.auraCategory}/${TEST_SLUGS.auraId}` },
		{ name: "news-detail", path: `/news/${TEST_SLUGS.news}` },
		{ name: "patch-notes-detail", path: `/patch-notes/${TEST_SLUGS.patchNote}` },
	];

	for (const pageInfo of dynamicPages) {
		test(`page - ${pageInfo.name}`, async ({ page }) => {
			await page.goto(pageInfo.path);
			await waitForPageImages(page);

			await expect(page).toHaveScreenshot(`${pageInfo.name}.png`, {
				fullPage: true,
				mask: [page.locator(".animate-pulse")],
				maxDiffPixelRatio: 0.05,
			});
		});
	}
});
