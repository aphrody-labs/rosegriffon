import { test, expect } from "@playwright/test";
import { execSync } from "node:child_process";

const BXC_PATH = "/home/ubuntu/.local/bin/bxc";

test.describe("Bxc Browser Engine Audits", () => {
	test("bxc detect - identifies Next.js on localhost:3000", async () => {
		const stdout = execSync(`${BXC_PATH} detect http://localhost:3000 --json`, { encoding: "utf8" });
		const data = JSON.parse(stdout);
		
		expect(data).toHaveProperty("httpStatus", 200);
		expect(data).toHaveProperty("hostname", "localhost");
		expect(data).toHaveProperty("finalUrl", "http://localhost:3000/");
		
		// Check that Next.js is detected
		const nextJsDetect = data.frontend?.find((tech: any) => tech.name === "Next.js");
		expect(nextJsDetect).toBeDefined();
		expect(nextJsDetect.confidence).toBeGreaterThan(0.5);
	});

	test("bxc recon - audits home page assets and headers", async () => {
		const stdout = execSync(`${BXC_PATH} recon http://localhost:3000 --json`, { encoding: "utf8" });
		const data = JSON.parse(stdout);
		
		expect(data).toHaveProperty("httpStatus", 200);
		expect(data).toHaveProperty("finalUrl", "http://localhost:3000/");
		expect(data.bytes).toBeGreaterThan(0);
		
		// Verify headers
		expect(data.headers).toHaveProperty("contentType");
		expect(data.headers.contentType).toContain("text/html");
		
		// Verify assets are loaded
		expect(Array.isArray(data.assets)).toBe(true);
		expect(data.assets.length).toBeGreaterThan(0);
		
		// Verify there are some CSS selectors scanned
		expect(Array.isArray(data.cssSelectors)).toBe(true);
		expect(data.cssSelectors.length).toBeGreaterThan(0);
	});

	test("bxc recon - audits contact page", async () => {
		const stdout = execSync(`${BXC_PATH} recon http://localhost:3000/contact --json`, { encoding: "utf8" });
		const data = JSON.parse(stdout);
		
		expect(data).toHaveProperty("httpStatus", 200);
		expect(data.bytes).toBeGreaterThan(0);
		expect(data.headers.contentType).toContain("text/html");
	});
});
