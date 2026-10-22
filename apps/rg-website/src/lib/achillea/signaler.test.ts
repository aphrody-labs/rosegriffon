import { describe, expect, spyOn, test } from "bun:test";

import { signalerEchec } from "./signaler";

describe("signalerEchec", () => {
  spyOn(console, "error").mockImplementation(() => {});

  test("montre le message de l'API quand elle en donne un", () => {
    expect(
      signalerEchec("santé", { ok: false, kind: "http", status: 503, message: "Bot Discord Achilléa indisponible : ECONNREFUSED" }),
    ).toBe("Bot Discord Achilléa indisponible : ECONNREFUSED");
  });

  test("un service injoignable est nommé comme tel", () => {
    expect(signalerEchec("liste", { ok: false, kind: "unreachable", detail: "fetch failed" })).toBe(
      "Service momentanément injoignable.",
    );
  });

  test("401 invite à se connecter, 403 sans message parle du rôle", () => {
    expect(signalerEchec("x", { ok: false, kind: "http", status: 401, message: "Authentication required" })).toBe(
      "Connecte-toi pour voir ces données.",
    );
    expect(signalerEchec("x", { ok: false, kind: "http", status: 403 })).toBe("Ton rôle ne permet pas cette action.");
  });
});
