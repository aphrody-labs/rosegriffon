import { describe, expect, test } from "bun:test";

import { isLegacyBcryptHash, verifyLegacyBcrypt } from "./bcrypt-legacy";

// Hashes produits par bcryptjs 3.0.3 (`bcrypt.hashSync`), avant la migration vers Bun.password.
const MOT_DE_PASSE = "Azalée-mot-de-passe!";
const HASH_2A = "$2a$04$cnQ9ca3fQr5ST95zDgi9euWxYvBkmkuccpK3DiXDbvHbEE20.Y9uS";
const HASH_2B = "$2b$10$vfj3Z8Lk.yFYoPZX..wSGOFGnJJK68MlDlSBb9./6goPLGEjm3MKK";
// 50 × « é » = 100 octets UTF-8 : bcryptjs n'en hachait que les 72 premiers.
const LONG = "é".repeat(50);
const HASH_LONG = "$2b$04$iQrBjktSqdHmNg991OM31ePaq61UldNfxBgePHcf0wONyxr0beGie";

describe("hashes bcrypt hérités de bcryptjs", () => {
  test("préfixes reconnus", () => {
    expect(isLegacyBcryptHash(HASH_2A)).toBe(true);
    expect(isLegacyBcryptHash(HASH_2B)).toBe(true);
    expect(isLegacyBcryptHash("$argon2id$v=19$m=65536,t=2,p=1$abc")).toBe(false);
    expect(isLegacyBcryptHash("a1b2c3:d4e5f6")).toBe(false);
  });

  test("$2a$ et $2b$ : bon mot de passe accepté, mauvais refusé", async () => {
    expect(await verifyLegacyBcrypt(MOT_DE_PASSE, HASH_2A)).toBe(true);
    expect(await verifyLegacyBcrypt(MOT_DE_PASSE, HASH_2B)).toBe(true);
    expect(await verifyLegacyBcrypt("azalée-mot-de-passe!", HASH_2A)).toBe(false);
    expect(await verifyLegacyBcrypt("", HASH_2B)).toBe(false);
  });

  test("au-delà de 72 octets : même troncature que bcryptjs", async () => {
    expect(await verifyLegacyBcrypt(LONG, HASH_LONG)).toBe(true);
    expect(await verifyLegacyBcrypt(`${LONG}suffixe ignoré`, HASH_LONG)).toBe(true);
    expect(await verifyLegacyBcrypt("é".repeat(35), HASH_LONG)).toBe(false);
  });
});
