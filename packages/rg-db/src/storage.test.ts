import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAssetUrl } from "./storage";

describe("getAssetUrl", () => {
	const originalEnv = process.env;

	beforeEach(() => {
		process.env = { ...originalEnv };
		process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
	});

	it("should return empty string if path is empty", () => {
		expect(getAssetUrl("")).toBe("");
	});

	it("should return absolute URLs as-is", () => {
		const url = "https://example.com/image.png";
		expect(getAssetUrl(url)).toBe(url);
	});

	it("should return data URLs as-is", () => {
		const url = "data:image/png;base64,123";
		expect(getAssetUrl(url)).toBe(url);
	});

	it("should construct Supabase storage URL for relative paths", () => {
		expect(getAssetUrl("logo.png")).toBe(
			"https://test.supabase.co/storage/v1/object/public/assets/logo.png"
		);
	});

	it("should handle leading slashes in relative paths", () => {
		expect(getAssetUrl("/avatars/user.png")).toBe(
			"https://test.supabase.co/storage/v1/object/public/assets/avatars/user.png"
		);
	});

	it("should return path as-is if NEXT_PUBLIC_SUPABASE_URL is missing", () => {
		delete process.env.NEXT_PUBLIC_SUPABASE_URL;
		expect(getAssetUrl("logo.png")).toBe("logo.png");
	});
});
