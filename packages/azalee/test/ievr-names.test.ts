import { describe, expect, test } from "bun:test";

import {
  classerEcart,
  normaliserId,
  sansFurigana,
} from "../scripts/ievr-names";

describe("importeur de noms IEVR", () => {
  test("normalise les identifiants hexadécimaux du miroir", () => {
    expect(normaliserId("0xab12cd34")).toBe("0xAB12CD34");
    expect(normaliserId("AB12CD34")).toBe("0xAB12CD34");
  });

  test("retire le balisage de furigana", () => {
    expect(sansFurigana("[円堂/えんどう] [守/まもる]")).toBe("円堂 守");
    expect(sansFurigana("円堂 守")).toBe("円堂 守");
  });

  test("classe les écarts observés dans le miroir", () => {
    expect(classerEcart("Jim Wraith", "Jim Wraith")).toBe("identique");
    expect(classerEcart("Jim Jim", "Jim Wraith")).toBe("mot-double");
    expect(classerEcart("Tim Saunders Timmy", "Tim Saunders")).toBe(
      "surnom-colle",
    );
    expect(classerEcart(null, "Jim Wraith")).toBe("vide");
    expect(classerEcart("Mark Evans", "円堂 守")).toBe("autre");
  });
});
