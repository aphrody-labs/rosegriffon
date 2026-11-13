import { afterEach, describe, expect, test } from "bun:test";

import { isOptimizedImageSource } from "../image-cdn";
import {
  imageServie,
  sansImagesMortes,
  viderDisponibilite,
} from "./disponibilite";

afterEach(() => viderDisponibilite());

const repondre = (status: number) => () =>
  Promise.resolve(new Response("x", { status }));

describe("imageServie", () => {
  test("2xx et 206 : servie ; 4xx et 5xx : morte", async () => {
    expect(
      await imageServie("https://cdn.test/a.png", { recuperer: repondre(206) }),
    ).toBe(true);
    expect(
      await imageServie("https://cdn.test/b.png", { recuperer: repondre(404) }),
    ).toBe(false);
    expect(
      await imageServie("https://cdn.test/c.png", { recuperer: repondre(502) }),
    ).toBe(false);
  });

  test("réseau en panne ou délai : on laisse sa chance à l'image, sans mémoriser", async () => {
    expect(
      await imageServie("https://cdn.test/d.png", {
        recuperer: () => Promise.reject(new Error("x")),
      }),
    ).toBe(true);
    expect(
      await imageServie("https://cdn.test/d.png", { recuperer: repondre(502) }),
    ).toBe(false);
  });

  test("le verdict est mémorisé", async () => {
    let appels = 0;
    const f = () => (
      appels++,
      Promise.resolve(new Response("x", { status: 502 }))
    );
    await imageServie("https://cdn.test/e.png", { recuperer: f });
    await imageServie("https://cdn.test/e.png", { recuperer: f });
    expect(appels).toBe(1);
  });

  test("chemins locaux et valeurs vides ne sont pas sondés", async () => {
    const jamais = () => Promise.reject(new Error("ne doit pas être appelé"));
    expect(await imageServie("/images/a.webp", { recuperer: jamais })).toBe(
      true,
    );
    expect(await imageServie(null, { recuperer: jamais })).toBe(true);
  });

  test("sansImagesMortes garde l'ordre et vide seulement les images mortes", async () => {
    await imageServie("https://cdn.test/morte.png", {
      recuperer: repondre(502),
    });
    await imageServie("https://cdn.test/vive.png", {
      recuperer: repondre(200),
    });
    const sortie = await sansImagesMortes([
      { id: 1, image: "https://cdn.test/morte.png" },
      { id: 2, image: "https://cdn.test/vive.png" },
      { id: 3, image: null },
    ]);
    expect(sortie).toEqual([
      { id: 1, image: null },
      { id: 2, image: "https://cdn.test/vive.png" },
      { id: 3, image: null },
    ]);
  });
});

describe("isOptimizedImageSource", () => {
  test("un SVG est servi tel quel", () => {
    expect(isOptimizedImageSource("/images/placeholder-news.svg")).toBe(false);
    expect(isOptimizedImageSource("/achillea/logo1.svg?v=2")).toBe(false);
    expect(isOptimizedImageSource("/RG_Logo_V2.5.webp")).toBe(true);
  });
});
