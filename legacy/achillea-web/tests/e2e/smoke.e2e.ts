/**
 * Smoke e2e du dashboard via Puppeteer (navigateur réel, Chrome système).
 *
 * Hors auto-discovery (`.e2e.ts` ≠ `*.test.ts`) → lancé explicitement :
 *   bun test tests/e2e/smoke.e2e.ts        # cible la prod live par défaut
 *   E2E_BASE_URL=http://localhost:4200 bun test tests/e2e/smoke.e2e.ts
 *
 * Réutilise le Chrome déjà présent sur le VPS (PUPPETEER_EXECUTABLE_PATH).
 * Valide le rendu bout-en-bout : homepage, routage SPA (/clans sans 404),
 * et la donnée Supabase exposée via l'API (tiers du classement).
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import puppeteer, { type Browser } from "puppeteer";

const BASE = (process.env.E2E_BASE_URL ?? "https://achillea.rosegriffon.fr").replace(/\/$/, "");
const CHROME =
	process.env.PUPPETEER_EXECUTABLE_PATH ??
	["/usr/local/bin/chromium", "/usr/bin/google-chrome-stable", "/usr/local/bin/google-chrome"].find(
		(p) => {
			try {
				return require("node:fs").existsSync(p);
			} catch {
				return false;
			}
		}
	);

let browser: Browser;

beforeAll(async () => {
	browser = await puppeteer.launch({
		headless: true,
		executablePath: CHROME,
		args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
	});
});

afterAll(async () => {
	await browser?.close();
});

describe(`smoke e2e — ${BASE}`, () => {
	test("la homepage se charge (status < 400, titre non vide)", async () => {
		const page = await browser.newPage();
		const res = await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 30_000 });
		expect(res).not.toBeNull();
		expect(res!.status()).toBeLessThan(400);
		expect((await page.title()).length).toBeGreaterThan(0);
		expect(await page.$("app-root")).not.toBeNull();
		await page.close();
	}, 45_000);

	test("la route SPA /clans rend sans 404 (fallback SPA nginx)", async () => {
		const page = await browser.newPage();
		const res = await page.goto(`${BASE}/clans`, {
			waitUntil: "domcontentloaded",
			timeout: 30_000,
		});
		expect(res!.status()).toBeLessThan(400);
		expect(await page.$("app-root")).not.toBeNull();
		await page.close();
	}, 45_000);

	test("l'API proxifiée renvoie les paliers de classement (donnée Supabase)", async () => {
		const page = await browser.newPage();
		const tiers = await page.evaluate(async (base) => {
			const r = await fetch(`${base}/api/ranked/tiers`);
			return r.ok ? ((await r.json()) as Array<{ key: string }>) : [];
		}, BASE);
		expect(Array.isArray(tiers)).toBe(true);
		expect(tiers.length).toBeGreaterThanOrEqual(8);
		expect(tiers[0]).toHaveProperty("key");
		await page.close();
	}, 45_000);
});
