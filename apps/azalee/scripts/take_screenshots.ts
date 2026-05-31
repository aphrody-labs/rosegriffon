import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const PAGES = {
	overview: "https://azalee.rosegriffon.fr/tools",
	compare: "https://azalee.rosegriffon.fr/tools/compare",
	"random-team": "https://azalee.rosegriffon.fr/tools/random-team",
	translator: "https://azalee.rosegriffon.fr/tools/translator",
	"my-team": "https://azalee.rosegriffon.fr/tools/my-team"
};

const ARTIFACT_DIR = "/home/ubuntu/.gemini/antigravity-cli/brain/cf1246db-3048-496d-9e7d-ea01996a0644/screenshots";
const DOCS_DIR = "/home/ubuntu/rg/docs/tools/screenshots";

mkdirSync(ARTIFACT_DIR, { recursive: true });
mkdirSync(DOCS_DIR, { recursive: true });

async function main() {
	console.log("Launching Chromium...");
	const browser = await chromium.launch({ headless: true });
	const context = await browser.newContext({
		viewport: { width: 1280, height: 800 },
		deviceScaleFactor: 1.5,
		locale: "fr-FR",
		timezoneId: "Europe/Paris"
	});

	const page = await context.newPage();

	for (const [name, url] of Object.entries(PAGES)) {
		console.log(`Navigating to ${url}...`);
		try {
			await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
			// Additional wait for Next.js hydration or animations
			await page.waitForTimeout(3000);

			const filename = `${name}.png`;
			const artifactPath = join(ARTIFACT_DIR, filename);
			const docsPath = join(DOCS_DIR, filename);

			console.log(`Taking screenshot: ${filename}`);
			await page.screenshot({ path: artifactPath, fullPage: false });
			await page.screenshot({ path: docsPath, fullPage: false });
		} catch (error) {
			console.error(`Failed to capture ${name}:`, error);
		}
	}

	await browser.close();
	console.log("Done!");
}

main().catch(console.error);
