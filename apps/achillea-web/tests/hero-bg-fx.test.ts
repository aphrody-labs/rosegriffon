import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	HERO_UI_HIT_SELECTOR,
	canSpawnFx,
	capParticles,
	clampParallax,
	createBurstParticles,
	isHeroUiTarget,
	lerp,
	stepParticles,
	type HeroParticle,
} from "../src/app/core/helpers/hero-bg-fx";

describe("isHeroUiTarget", () => {
	test("null / non-element → false", () => {
		expect(isHeroUiTarget(null)).toBe(false);
		expect(isHeroUiTarget(undefined as unknown as EventTarget)).toBe(false);
	});

	test("plain div on hero is not UI", () => {
		const hero = document.createElement("section");
		hero.className = "hero";
		const dead = document.createElement("div");
		dead.className = "hero-bg";
		hero.appendChild(dead);
		document.body.appendChild(hero);
		expect(isHeroUiTarget(dead)).toBe(false);
		hero.remove();
	});

	test("link / button / featured-card are UI", () => {
		const wrap = document.createElement("div");
		wrap.innerHTML = `
			<a class="featured-card" href="#"><span class="inner">x</span></a>
			<button type="button">go</button>
			<div class="home-card"><span>clans</span></div>
			<input class="p-inputtext" />
		`;
		document.body.appendChild(wrap);
		const a = wrap.querySelector(".inner")!;
		const btn = wrap.querySelector("button")!;
		const card = wrap.querySelector(".home-card span")!;
		const input = wrap.querySelector("input")!;
		expect(isHeroUiTarget(a)).toBe(true);
		expect(isHeroUiTarget(btn)).toBe(true);
		expect(isHeroUiTarget(card)).toBe(true);
		expect(isHeroUiTarget(input)).toBe(true);
		wrap.remove();
	});
});

describe("clampParallax", () => {
	test("center → 0", () => {
		expect(clampParallax(0, 0)).toEqual({ x: 0, y: 0 });
	});

	test("clamps extremes and inverts", () => {
		const p = clampParallax(1, -1, 12, 8);
		expect(p.x).toBeCloseTo(-6); // 0.5 * -12
		expect(p.y).toBeCloseTo(4); // -0.5 * -8
	});
});

describe("canSpawnFx", () => {
	test("respects cooldown", () => {
		expect(canSpawnFx(1000, 900, 120)).toBe(false);
		expect(canSpawnFx(1000, 880, 120)).toBe(true);
		expect(canSpawnFx(100, 0, 0)).toBe(true);
	});
});

describe("createBurstParticles / step / cap", () => {
	test("creates fixed count with deterministic rng", () => {
		let i = 0;
		const seq = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
		const rng = () => seq[i++ % seq.length]!;
		const parts = createBurstParticles(50, 60, [[255, 0, 0]], 5, rng);
		expect(parts).toHaveLength(5);
		for (const p of parts) {
			expect(p.x).toBe(50);
			expect(p.y).toBe(60);
			expect(p.life).toBeGreaterThan(0);
			expect(p.maxLife).toBe(p.life);
		}
	});

	test("step reduces life and removes dead", () => {
		const p: HeroParticle = {
			x: 0,
			y: 0,
			vx: 1,
			vy: 0,
			life: 2,
			maxLife: 2,
			size: 2,
			r: 255,
			g: 255,
			b: 255,
		};
		const arr = [p];
		stepParticles(arr, 0);
		expect(arr).toHaveLength(1);
		expect(arr[0]!.x).toBe(1);
		expect(arr[0]!.life).toBe(1);
		stepParticles(arr, 0);
		expect(arr).toHaveLength(0);
	});

	test("cap drops oldest", () => {
		const parts = createBurstParticles(0, 0, [[1, 2, 3]], 10, () => 0.5);
		capParticles(parts, 4);
		expect(parts).toHaveLength(4);
	});
});

describe("lerp", () => {
	test("moves toward target and snaps near", () => {
		expect(lerp(0, 10, 0.5)).toBe(5);
		expect(lerp(0, 0.01, 0.5)).toBe(0.01);
	});
});

describe("homepage hero structure (shipped sources)", () => {
	const root = join(import.meta.dir, "..");

	test("template has decorative bg layer + canvas + content above", () => {
		const html = readFileSync(join(root, "src/app/views/homepage/homepage.html"), "utf8");
		expect(html).toContain('class="hero-bg"');
		expect(html).toContain('class="hero-bg__img"');
		expect(html).toContain("#fxCanvas");
		expect(html).toContain('class="hero-bg__fx"');
		expect(html).toContain('(click)="onHeroClick($event)"');
		expect(html).toContain('(pointermove)="onHeroPointerMove($event)"');
		expect(html).toContain('aria-hidden="true"');
		// Interactive content still present
		expect(html).toContain("app-searchbar");
		expect(html).toContain("featured-card");
		expect(html).toContain("home-card");
	});

	test("styles.css no longer paints homepage art on whole .hero", () => {
		const css = readFileSync(join(root, "src/styles.css"), "utf8");
		// Layer receives the art
		expect(css).toMatch(/\.hero-bg__img[\s\S]*site_bg_dark_home\.png/);
		expect(css).toMatch(/\.p-light \.hero-bg__img[\s\S]*site_bg_light_home\.png/);
		// Whole hero must not own the homepage art url
		const heroBlock = css.match(/\.p-dark \.hero,\s*\.hero\s*\{[^}]+\}/);
		expect(heroBlock?.[0] ?? "").not.toContain("site_bg_dark_home");
		expect(heroBlock?.[0] ?? "").toMatch(/background:\s*none/);
	});

	test("UI hit selector covers featured + cards + search", () => {
		expect(HERO_UI_HIT_SELECTOR).toContain(".featured-card");
		expect(HERO_UI_HIT_SELECTOR).toContain(".home-card");
		expect(HERO_UI_HIT_SELECTOR).toContain("app-searchbar");
		expect(HERO_UI_HIT_SELECTOR).toContain(".playlist-card");
	});
});
