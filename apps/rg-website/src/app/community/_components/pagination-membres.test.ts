import { describe, expect, test } from "bun:test";

import { lirePage, trancherSections } from "./pagination-membres";

const section = (id: string, n: number) => ({ id, membres: Array.from({ length: n }, (_, i) => i) });

describe("trancherSections", () => {
  const sections = [section("a", 3), section("b", 5), section("c", 4)];

  test("première page : sections entières puis la coupure", () => {
    expect(trancherSections(sections, 1, 6).map(t => [t.section.id, t.debut, t.fin])).toEqual([
      ["a", 0, 3],
      ["b", 0, 3],
    ]);
  });

  test("page suivante : reprend au milieu de la section coupée", () => {
    expect(trancherSections(sections, 2, 6).map(t => [t.section.id, t.debut, t.fin])).toEqual([
      ["b", 3, 5],
      ["c", 0, 4],
    ]);
  });

  test("au-delà de la fin : rien", () => {
    expect(trancherSections(sections, 3, 6)).toEqual([]);
  });

  test("chaque membre apparaît une et une seule fois", () => {
    const vus = [1, 2].flatMap(page =>
      trancherSections(sections, page, 6).flatMap(t => t.section.membres.slice(t.debut, t.fin).map(m => `${t.section.id}${m}`)),
    );
    expect(new Set(vus).size).toBe(12);
    expect(vus.length).toBe(12);
  });
});

describe("lirePage", () => {
  test("borne et normalise", () => {
    expect(lirePage(undefined, 100, 60)).toBe(1);
    expect(lirePage("abc", 100, 60)).toBe(1);
    expect(lirePage("0", 100, 60)).toBe(1);
    expect(lirePage("2", 100, 60)).toBe(2);
    expect(lirePage("99", 100, 60)).toBe(2);
    expect(lirePage("3", 0, 60)).toBe(1);
  });
});
