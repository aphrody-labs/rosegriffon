import { expect, test } from "bun:test";
import { envBool, envInt, envString, rgDefaultUrl, rgUrl } from "../rg-urls.ts";

test("defaults match the former inline literals", () => {
  expect(rgUrl({}, "site", "WEBSITE_URL")).toBe("https://rosegriffon.fr");
  expect(rgUrl({}, "api", "PUBLIC_API_URL")).toBe("https://api.rosegriffon.fr");
  expect(rgUrl({}, "rankedApi", "ACHILLEA_PUBLIC_API_URL")).toBe(
    "https://ranked.rosegriffon.fr/api",
  );
  expect(rgUrl({}, "cdn", "RG_MEDIA_PUBLIC_ORIGIN")).toBe(
    "https://cdn.rosegriffon.fr",
  );
});

test("the call-site variable wins with ?? semantics", () => {
  expect(rgUrl({ WEBSITE_URL: "http://x/" }, "site", "WEBSITE_URL")).toBe(
    "http://x/",
  );
  expect(rgUrl({ WEBSITE_URL: "" }, "site", "WEBSITE_URL")).toBe("");
});

test("RG_DOMAIN moves every default", () => {
  expect(rgDefaultUrl({ RG_DOMAIN: "example.test" }, "api")).toBe(
    "https://api.example.test",
  );
  expect(rgDefaultUrl({ RG_DOMAIN: "example.test" }, "site")).toBe(
    "https://example.test",
  );
});

test("typed env parsing", () => {
  expect(envString({ A: " v " }, "A", "d")).toBe("v");
  expect(envString({}, "A", "d")).toBe("d");
  expect(envInt({ P: "8810" }, "P", 1)).toBe(8810);
  expect(() => envInt({ P: "x" }, "P", 1)).toThrow();
  expect(envBool({ B: "0" }, "B", true)).toBe(false);
  expect(envBool({}, "B", true)).toBe(true);
});
