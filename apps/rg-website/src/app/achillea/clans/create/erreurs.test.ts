import { describe, expect, test } from "bun:test";

import { erreurLogo, lireCofondateurs, messageErreurCreation } from "./erreurs";

describe("création de clan — règles du formulaire", () => {
  test("lit les co-fondateurs séparés par virgules ou espaces, sans doublon", () => {
    expect(lireCofondateurs("111111111111111111, 222222222222222222 111111111111111111")).toEqual([
      "111111111111111111",
      "222222222222222222",
    ]);
    expect(lireCofondateurs("pseudo")).toBeNull();
  });

  test("exige un logo image de 256 Ko au plus", () => {
    expect(erreurLogo(null)).toContain("Choisis un logo");
    expect(erreurLogo({ type: "image/svg+xml", size: 10 })).toContain("PNG");
    expect(erreurLogo({ type: "image/png", size: 300 * 1024 })).toContain("256 Ko");
    expect(erreurLogo({ type: "image/png", size: 10 * 1024 })).toBeNull();
  });

  test("une 409 donne un message lisible, pas « HTTP 409 »", () => {
    const message = messageErreurCreation({ kind: "http", status: 409 });
    expect(message).toContain("déjà utilisé");
    expect(message).not.toContain("HTTP");
    expect(messageErreurCreation({ kind: "unreachable" })).toContain("injoignable");
  });
});
