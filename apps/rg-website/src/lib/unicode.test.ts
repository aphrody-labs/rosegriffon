import { describe, expect, it } from "bun:test";

import { postDepuisTweet } from "./feed/normalisation";
import { clampText } from "./seo";
import { initiale, sansCaracteresIllisibles, tronquerUnicode } from "./unicode";

const FFFD = String.fromCharCode(0xfffd);
/** Une moitié de paire isolée devient U+FFFD à l'encodage UTF-8 de la page. */
const bienForme = (s: string) =>
  new TextDecoder().decode(new TextEncoder().encode(s)) === s &&
  !s.includes(FFFD);

describe("initiale", () => {
  it("takes the first grapheme, not half of a surrogate pair", () => {
    // Noms d'auteurs X réels vus sur /feed (avatar sans image).
    expect(initiale("👑シベリアチャンネル👑")).toBe("👑");
    expect(initiale("🥕沙々希🥕Ω")).toBe("🥕");
    expect(bienForme(initiale("👑シベリア"))).toBe(true);
    // L'ancien code : `nom.charAt(0)` rendait la moitié haute seule.
    expect(bienForme("👑シベリア".charAt(0))).toBe(false);
  });

  it("keeps whole flag and ZWJ sequences, uppercases letters, falls back on empty", () => {
    expect(initiale("🇫🇷 France")).toBe("🇫🇷");
    expect(initiale("👩‍💻 dev")).toBe("👩‍💻");
    expect(initiale("  éloïse")).toBe("É");
    expect(initiale("   ")).toBe("?");
    expect(initiale(undefined, "-")).toBe("-");
  });
});

describe("tronquerUnicode / clampText", () => {
  it("never ends on a lone high surrogate", () => {
    expect(tronquerUnicode("ab😀cd", 3)).toBe("ab");
    expect(tronquerUnicode("ab😀cd", 4)).toBe("ab😀");
    for (let n = 1; n < 40; n++) {
      expect(bienForme(clampText("Victoire 😀 ".repeat(5), n))).toBe(true);
    }
  });
});

describe("sansCaracteresIllisibles", () => {
  it("drops U+FFFD and lone surrogates, keeps valid pairs", () => {
    // Tweet réel d'@InazumaCrossFR rendu sur /feed?groupe=Inazuma+Eleven.
    const brut = `ℹ️ Gabriel Garcia - Raimon GO\n\n#イナイレクロス${FFFD}  #InazumaEleven`;
    expect(sansCaracteresIllisibles(brut)).toBe(
      "ℹ️ Gabriel Garcia - Raimon GO\n\n#イナイレクロス  #InazumaEleven",
    );
    expect(sansCaracteresIllisibles(`a${String.fromCharCode(0xd83d)}b`)).toBe(
      "ab",
    );
    expect(sansCaracteresIllisibles(`a${String.fromCharCode(0xde00)}b`)).toBe(
      "ab",
    );
    expect(sansCaracteresIllisibles("ok 😀 ok")).toBe("ok 😀 ok");
  });

  it("is applied to X posts at normalisation", () => {
    const post = postDepuisTweet({
      author: { name: "IE Cross FR", username: "InazumaCrossFR" },
      created_at: "2026-08-14T07:00:55.000Z",
      id: "2087773224943657113",
      text: `#イナイレクロス${FFFD} #InazumaEleven`,
    });
    expect(post.texte).toBe("#イナイレクロス #InazumaEleven");
  });
});
