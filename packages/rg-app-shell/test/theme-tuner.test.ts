import { describe, expect, test } from "bun:test";

import { clampAdjustments, DEFAULT_ADJUSTMENTS } from "@rosegriffon/ui/lib/color-engine";

import { CURSEURS } from "../src/components/ThemeTuner";

describe("ThemeTuner sliders", () => {
  test("cover the three adjustments within the engine bounds", () => {
    expect(CURSEURS.map(c => c.cle)).toEqual(["hueShift", "chroma", "contrast"]);
    for (const c of CURSEURS) {
      expect(clampAdjustments({ [c.cle]: c.min })[c.cle]).toBe(c.min);
      expect(clampAdjustments({ [c.cle]: c.max })[c.cle]).toBe(c.max);
      const defaut = DEFAULT_ADJUSTMENTS[c.cle];
      expect((defaut - c.min) / c.pas).toBeCloseTo(Math.round((defaut - c.min) / c.pas), 9);
    }
  });

  test("format visible values", () => {
    const [teinte, chroma, contraste] = CURSEURS;
    expect(teinte!.format(-30)).toBe("−30°");
    expect(teinte!.format(0)).toBe("0°");
    expect(chroma!.format(1.25)).toBe("125 %");
    expect(contraste!.format(0)).toBe("Standard");
    expect(contraste!.format(0.5)).toBe("+50 %");
  });
});
