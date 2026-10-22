import { describe, expect, test } from "bun:test";

import { PREFIXE_MORT, nomObjet, typeImage, urlCible } from "./migrer-images-legacy";

describe("migration des images Achilléa", () => {
  test("extrait le nom d'objet d'une URL morte, refuse le reste", () => {
    expect(nomObjet(`${PREFIXE_MORT}3TTlIgH3.png`)).toBe("3TTlIgH3.png");
    expect(nomObjet(`${PREFIXE_MORT}clans/a%20b.webp?v=2`)).toBe("clans/a b.webp");
    expect(nomObjet("https://cdn.discordapp.com/x.png")).toBeNull();
    expect(nomObjet(`${PREFIXE_MORT}../secret`)).toBeNull();
    expect(nomObjet(PREFIXE_MORT)).toBeNull();
  });

  test("URL publique dans le projet courant, chemin encodé", () => {
    expect(urlCible("https://p.supabase.co/", "clans/a b.webp")).toBe(
      "https://p.supabase.co/storage/v1/object/public/images/clans/a%20b.webp",
    );
  });

  test("reconnaît les images par leurs premiers octets", () => {
    expect(typeImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d]))).toBe("image/png");
    expect(typeImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(typeImage(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39]))).toBe("image/gif");
    expect(typeImage(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8"))).toBe("image/webp");
    expect(typeImage(new TextEncoder().encode("<!doctype html>"))).toBeNull();
  });
});
