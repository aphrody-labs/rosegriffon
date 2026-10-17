import { describe, expect, test } from "bun:test";

import { estSain, executerBorne } from "./sondes";

describe("executerBorne", () => {
  test("ne dépasse jamais la limite et conserve l'ordre", async () => {
    let actifs = 0;
    let max = 0;
    const sortie = await executerBorne([1, 2, 3, 4, 5, 6, 7, 8, 9], 4, async n => {
      actifs++;
      max = Math.max(max, actifs);
      await Bun.sleep(5);
      actifs--;
      return n * 2;
    });
    expect(max).toBeLessThanOrEqual(4);
    expect(sortie).toEqual([2, 4, 6, 8, 10, 12, 14, 16, 18]);
  });
  test("liste vide", async () => {
    expect(await executerBorne([], 4, async n => n)).toEqual([]);
  });
});

describe("estSain", () => {
  test("seules les 2xx", () => {
    expect(estSain(200)).toBe(true);
    expect(estSain(301)).toBe(false);
    expect(estSain(503)).toBe(false);
    expect(estSain(null)).toBe(false);
  });
});
