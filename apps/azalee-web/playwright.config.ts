import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E and Visual Regression Testing Configuration
 */
export default defineConfig({
	testDir: "./tests-e2e",
	fullyParallel: false, // Turn off fullyParallel to prevent massive CPU compilation spike
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: 1, // Max 1 parallel compilation processes to avoid CPU overload
	timeout: 180000, // 3 minutes per test
	reporter: [
		["html", { outputFolder: "playwright-report", open: "never" }],
		["list"]
	],
	use: {
		baseURL: "http://localhost:3000",
		trace: "on-first-retry",
		screenshot: "only-on-failure",
		video: "off",
		actionTimeout: 120000, // 120s action timeout
		navigationTimeout: 120000, // 120s navigation timeout
	},
	/* Configure projects for major browsers and viewport sizes */
	projects: [
		{
			name: "Desktop-Chrome",
			use: {
				...devices["Desktop Chrome"],
				viewport: { width: 1280, height: 720 },
				launchOptions: {
					executablePath: "/usr/local/bin/google-chrome",
					args: ["--no-sandbox", "--disable-setuid-sandbox"],
				},
			},
		},
		{
			name: "Mobile-Chrome",
			use: {
				...devices["Pixel 5"],
				launchOptions: {
					executablePath: "/usr/local/bin/google-chrome",
					args: ["--no-sandbox", "--disable-setuid-sandbox"],
				},
			},
		},
	],
	/* Run local dev server before starting the tests */
	webServer: {
		command: "bun run dev",
		url: "http://localhost:3000",
		reuseExistingServer: !process.env.CI,
		timeout: 180000, // 3 minutes
	},
	/* Output configuration */
	outputDir: "test-results/",
	snapshotPathTemplate: "{testDir}/__snapshots__/{testFilePath}/{projectName}/{arg}{ext}",
});
