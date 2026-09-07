/// <reference lib="dom" />
/**
 * Test DOM via happy-dom (bun:test) — `document` / `window` fournis par le preload.
 * https://bun.com/docs/test/dom
 *
 * Run : bun test tests/dom.test.ts
 */
import { describe, expect, test } from "bun:test";

describe("DOM (happy-dom)", () => {
	test("rend et interroge un fragment HTML", () => {
		document.body.innerHTML = `<a class="brand" href="/">Achillea</a>`;
		const link = document.querySelector("a.brand");
		expect(link).not.toBeNull();
		expect(link?.textContent).toBe("Achillea");
		expect(link?.getAttribute("href")).toBe("/");
	});

	test("manipule classList et attributs", () => {
		const el = document.createElement("div");
		el.classList.add("tier", "active");
		el.dataset["rank"] = "diamond";
		expect(el.classList.contains("active")).toBe(true);
		expect(el.dataset["rank"]).toBe("diamond");
	});

	test("window est disponible globalement", () => {
		expect(typeof window).toBe("object");
		expect(typeof window.location.href).toBe("string");
	});
});
