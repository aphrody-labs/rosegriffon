import { test, expect, type Page } from "@playwright/test";

async function waitForLoadingFinished(page: Page) {
	// Wait for any next.js transition loader to disappear
	await page.locator("text=Chargement...").waitFor({ state: "detached", timeout: 10000 }).catch(() => {});
	// Wait for any temporary pointer-events-none overlays to clear
	await page.locator(".pointer-events-none").waitFor({ state: "detached", timeout: 5000 }).catch(() => {});
	await page.waitForTimeout(500); // Safety buffer for UI state synchronization
}

async function verifyPageState(page: Page) {
	// Assert no obvious next.js error overlays or blank screen
	await expect(page.locator("body")).toBeVisible();
	await expect(page.locator("text=An error occurred")).not.toBeVisible();
	await expect(page.locator("text=Application error")).not.toBeVisible();

	// Check that we either have character rows or the empty state message
	const tableExists = await page.locator("table").count() > 0;
	const cardsExist = await page.locator("div.grid.grid-cols-1.sm\\:grid-cols-2.gap-4.md\\:hidden > div").count() > 0;
	const noResultsExist = await page.locator("text=Aucun joueur ne correspond à ces critères").count() > 0;

	expect(tableExists || cardsExist || noResultsExist).toBe(true);
}

test("Test all character filters and combinations on desktop and mobile viewports", async ({ page }) => {
	// Go to character list page
	await page.goto("/chara");
	await page.waitForLoadState("domcontentloaded");
	
	// Wait for networkidle on initial load to guarantee page hydration
	await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
	await page.waitForTimeout(1500); // Safety buffer for full hydration

	// Verify page state & initial load
	await verifyPageState(page);
	const initialCountText = await page.locator("span.tabular-nums:visible").first().textContent();
	console.log(`Page loaded successfully. Initial character count: ${initialCountText}`);
	expect(initialCountText).toContain("personnage");

	// Determine if we are on a mobile viewport by checking if the mobile-only trigger button is visible
	const mobileFilterBtn = page.locator("button:has-text('Filtres'):visible").first();
	const isMobile = await mobileFilterBtn.isVisible();
	console.log(`Running in ${isMobile ? "MOBILE" : "DESKTOP"} viewport mode`);

	// Helper to open filters drawer on mobile with retry mechanism for hydration safety
	const openFiltersIfNeeded = async () => {
		if (isMobile) {
			console.log("Mobile: Opening filters drawer");
			let attempts = 0;
			while (attempts < 3) {
				const drawerTitle = page.locator("text=Filtres avancés:visible").first();
				if (await drawerTitle.isVisible()) {
					break;
				}
				await mobileFilterBtn.click().catch(() => {});
				await page.waitForTimeout(1000);
				attempts++;
			}
			await expect(page.locator("text=Filtres avancés:visible").first()).toBeVisible();
		}
	};

	// Helper to close filters drawer on mobile
	const closeFiltersIfNeeded = async () => {
		if (isMobile) {
			console.log("Mobile: Closing filters drawer via 'Appliquer les filtres'");
			const applyBtn = page.locator("button:has-text('Appliquer les filtres'):visible").first();
			await expect(applyBtn).toBeVisible();
			await applyBtn.click();
			// Wait for drawer to close
			await page.locator("text=Filtres avancés").waitFor({ state: "detached", timeout: 5000 });
			await waitForLoadingFinished(page);
		}
	};

	// Helper to dynamically get the active visible filter buttons
	const getFilterBtn = (val: string, type: "title" | "text" = "title") => {
		return type === "title"
			? page.locator(`button[title='${val}']:visible`).first()
			: page.locator(`button:has-text('${val}'):visible`).first();
	};

	// --- OPTIMIZED CHAINED FILTER TESTING ---
	// To prevent global timeouts on the VPS dev server, we apply the filters sequentially
	// in a single chained transition flow, verifying the cumulative parameters in the URL.

	// 1. Click Element filter: Feu
	console.log("Adding Element filter: Feu");
	await openFiltersIfNeeded();
	await getFilterBtn("Feu", "title").click();
	await expect(page).toHaveURL(/element=Fire/);
	await waitForLoadingFinished(page);

	// 2. Click Position filter: GAR
	console.log("Adding Position filter: GAR");
	await openFiltersIfNeeded();
	await getFilterBtn("GAR", "title").click();
	await expect(page).toHaveURL(/position=GK/);
	await waitForLoadingFinished(page);

	// 3. Click Gender filter: Garçon
	console.log("Adding Gender filter: Garçon");
	await openFiltersIfNeeded();
	await getFilterBtn("Garçon", "title").click();
	await expect(page).toHaveURL(/gender=1/);
	await waitForLoadingFinished(page);

	// 4. Click Playstyle filter: Lien
	console.log("Adding Playstyle filter: Lien");
	await openFiltersIfNeeded();
	await getFilterBtn("Lien", "title").click();
	await expect(page).toHaveURL(/playstyle=Bond/);
	await waitForLoadingFinished(page);

	// 5. Click Rarity filter: Normal
	console.log("Adding Rarity filter: Normal");
	await openFiltersIfNeeded();
	await getFilterBtn("Normal", "text").click();
	await expect(page).toHaveURL(/rarity=Normal/);
	await waitForLoadingFinished(page);

	// 6. Click Role filter: Coordinateur
	console.log("Adding Role filter: Coordinateur");
	await openFiltersIfNeeded();
	await getFilterBtn("Coordinateur", "text").click();
	await expect(page).toHaveURL(/role=Coordinator/);
	await waitForLoadingFinished(page);

	// 7. Click Series filter: Victory Road
	console.log("Adding Series filter: Victory Road");
	await openFiltersIfNeeded();
	await getFilterBtn("Victory Road", "text").click();
	await closeFiltersIfNeeded();
	await expect(page).toHaveURL(/series=Victory/);
	await waitForLoadingFinished(page);
	await verifyPageState(page);

	// 8. Test resetting/clearing all filters
	console.log("Clearing all chained filters");
	if (isMobile) {
		await openFiltersIfNeeded();
		const resetBtn = page.locator("button:has-text('Réinitialiser'):visible").first();
		await expect(resetBtn).toBeVisible();
		await resetBtn.click();
		await closeFiltersIfNeeded();
	} else {
		const clearAllBtn = page.locator("button:has-text('Tout effacer'):visible").first();
		await expect(clearAllBtn).toBeVisible();
		await clearAllBtn.click();
	}
	await expect(page).not.toHaveURL(/element=/);
	await expect(page).not.toHaveURL(/position=/);
	await expect(page).not.toHaveURL(/gender=/);
	await expect(page).not.toHaveURL(/playstyle=/);
	await expect(page).not.toHaveURL(/rarity=/);
	await expect(page).not.toHaveURL(/role=/);
	await expect(page).not.toHaveURL(/series=/);
	await waitForLoadingFinished(page);
	await verifyPageState(page);

	// 9. Test Team Filter individually
	console.log("Testing Team Filter selection");
	await openFiltersIfNeeded();
	const combobox = page.locator("button[role='combobox']:visible").first();
	await expect(combobox).toBeVisible();
	await combobox.click();
	await page.waitForTimeout(500);

	// Select first option in the team selector list
	const firstTeamOption = page.locator("div[role='option']:visible").first();
	await expect(firstTeamOption).toBeVisible();
	const teamName = await firstTeamOption.locator("span").textContent();
	console.log(`Selecting team in combobox: ${teamName}`);
	await firstTeamOption.click();
	await closeFiltersIfNeeded();
	await expect(page).toHaveURL(/team=/);
	await waitForLoadingFinished(page);
	await verifyPageState(page);

	// Clear team filter
	if (isMobile) {
		await openFiltersIfNeeded();
		const resetBtn = page.locator("button:has-text('Réinitialiser'):visible").first();
		await expect(resetBtn).toBeVisible();
		await resetBtn.click();
		await closeFiltersIfNeeded();
	} else {
		const teamChip = page.locator("div").filter({ hasText: "Filtres actifs :" }).locator("button").filter({ hasText: teamName }).first();
		await expect(teamChip).toBeVisible();
		await teamChip.click();
	}
	await expect(page).not.toHaveURL(/team=/);
	await waitForLoadingFinished(page);

	// 10. Verification of alternative combination: Forêt + ATT + BASARA
	console.log("Combination: Forêt + ATT + BASARA");
	await openFiltersIfNeeded();
	await getFilterBtn("Forêt", "title").click();
	await getFilterBtn("ATT", "title").click();
	await getFilterBtn("BASARA", "text").click();
	await closeFiltersIfNeeded();
	await expect(page).toHaveURL(/element=Forest/);
	await expect(page).toHaveURL(/position=FW/);
	await expect(page).toHaveURL(/rarity=BASARA/);
	await waitForLoadingFinished(page);
	await verifyPageState(page);

	console.log("All filters and combinations tested successfully!");
});
