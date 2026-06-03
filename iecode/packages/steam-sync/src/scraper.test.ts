import { describe, expect, test } from "bun:test";
import {
	decodeEntities,
	parseName,
	parseOg,
	parseReviewSummary,
	parseStoreTags,
	scrapeApp,
} from "./scraper.ts";

const SAMPLE_HTML = `
<html><head>
  <meta property="og:title" content="INAZUMA ELEVEN: Victory Road" />
  <meta property="og:image" content="https://shared.steamstatic.com/header.jpg" />
</head><body>
  <div class="apphub_AppName">INAZUMA ELEVEN: Victory Road</div>
  <span class="game_review_summary positive">Very Positive</span>
  <a href="/tags/1" class="app_tag">RPG</a>
  <a href="/tags/2" class="app_tag"> Sports </a>
  <a href="/tags/2" class="app_tag">Sports</a>
  <a href="/tags/3" class="app_tag">+</a>
  <a href="/tags/4" class="app_tag"><span>Anime</span></a>
</body></html>`;

describe("scraper HTML parsers", () => {
	test("parseStoreTags dedupes, trims, strips inner tags, skips '+'", () => {
		expect(parseStoreTags(SAMPLE_HTML)).toEqual(["RPG", "Sports", "Anime"]);
	});

	test("parseReviewSummary reads the review span", () => {
		expect(parseReviewSummary(SAMPLE_HTML)).toBe("Very Positive");
	});

	test("parseName prefers apphub name", () => {
		expect(parseName(SAMPLE_HTML)).toBe("INAZUMA ELEVEN: Victory Road");
	});

	test("parseName falls back to og:title", () => {
		expect(parseName('<meta property="og:title" content="Fallback Title" />')).toBe(
			"Fallback Title"
		);
	});

	test("parseOg reads image", () => {
		expect(parseOg(SAMPLE_HTML, "image")).toBe("https://shared.steamstatic.com/header.jpg");
	});

	test("decodeEntities unescapes common HTML entities", () => {
		expect(decodeEntities("&quot;Inazuma&quot; &amp; co &#39;11&#39;")).toBe(`"Inazuma" & co '11'`);
	});

	test("parsers return empty/null on junk", () => {
		expect(parseStoreTags("<p>nope</p>")).toEqual([]);
		expect(parseReviewSummary("<p>nope</p>")).toBeNull();
		expect(parseOg("<p>nope</p>", "image")).toBeNull();
	});
});

// Test live (réseau) — opt-in via STEAM_SYNC_LIVE=1 pour éviter la flakiness CI.
describe("scraper live (bxc)", () => {
	test.skipIf(process.env["STEAM_SYNC_LIVE"] !== "1")(
		"scrapes IEVR metadata",
		async () => {
			const meta = await scrapeApp(2_799_860);
			expect(meta.appId).toBe(2_799_860);
			expect(meta.name).toContain("INAZUMA");
			expect(meta.type).toBe("game");
			expect(meta.developers.length).toBeGreaterThan(0);
		},
		60_000
	);
});
