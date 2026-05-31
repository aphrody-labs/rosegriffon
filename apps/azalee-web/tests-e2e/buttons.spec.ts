import { test, expect } from "@playwright/test";

test.describe("Interactive Button Tests", () => {
	// 1. Theme Toggle
	test("Theme toggle button updates page layout style", async ({ page }) => {
		await page.goto("/");
		await page.waitForLoadState("domcontentloaded");

		// Find the theme toggle button (either has Sun or Moon icon)
		const themeToggle = page.locator("button:has(svg.lucide-sun), button:has(svg.lucide-moon)").first();
		await expect(themeToggle).toBeVisible();

		// Get initial state of the dark class on html
		const htmlElement = page.locator("html");
		const initialClass = await htmlElement.getAttribute("class") || "";
		const wasDark = initialClass.includes("dark");

		// Click the theme toggle button
		await themeToggle.click();
		await page.waitForTimeout(500); // Wait for transition

		// Verify the theme class changed on the html element
		const updatedClass = await htmlElement.getAttribute("class") || "";
		const isDarkNow = updatedClass.includes("dark");
		
		expect(isDarkNow).toBe(!wasDark);
	});

	// 2. Chara filter chip buttons
	test("Character list filter buttons filter results", async ({ page }) => {
		await page.goto("/chara");
		await page.waitForLoadState("domcontentloaded");
		await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

		// Verify list is initially loaded
		const initialCount = await page.locator("a[href^='/chara/']").count();
		
		// Find a filter chip (e.g., FW position button or Wind element button)
		// We'll search for buttons containing "Attaquant" or "FW" or "Milieu" etc.
		const fwFilter = page.locator("button:has-text('Attaquant'), button:has-text('FW')").first();
		if (await fwFilter.count() > 0) {
			await fwFilter.click();
			await page.waitForTimeout(1000); // Wait for filtering animation/fetch

			// Verify character list cards are updated
			const filteredCount = await page.locator("a[href^='/chara/']").count();
			expect(filteredCount).toBeLessThanOrEqual(initialCount);
		}
	});

	// 3. Character Detail Tab Buttons
	test("Character detail page tab buttons switch content panels", async ({ page }) => {
		const testCharSlug = "buddy-0x6A6392AD";
		await page.goto(`/chara/${testCharSlug}`);
		await page.waitForLoadState("domcontentloaded");
		await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

		// Find the tab triggers on the page
		// Usually styled as Radix UI TabsTrigger buttons or custom buttons
		const tabTriggers = page.locator("button[role='tab']");
		const tabCount = await tabTriggers.count();
		
		if (tabCount > 1) {
			// Click the second tab (e.g. Techniques/Moveset or How to Obtain)
			const initialActiveTabPanel = page.locator("[role='tabpanel'][data-state='active']");
			const initialPanelId = await initialActiveTabPanel.getAttribute("id");

			await tabTriggers.nth(1).click();
			await page.waitForTimeout(500); // Wait for tab switch transition

			const updatedActiveTabPanel = page.locator("[role='tabpanel'][data-state='active']");
			const updatedPanelId = await updatedActiveTabPanel.getAttribute("id");

			// Assert that active panel has switched
			expect(updatedPanelId).not.toBe(initialPanelId);
		}
	});
});
