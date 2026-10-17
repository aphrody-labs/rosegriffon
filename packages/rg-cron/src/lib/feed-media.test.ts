/**
 * @license
 * Copyright 2026 Rose Griffon
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import * as zlib from "node:zlib";
import { join } from "node:path";

import {
  afficheVideo,
  cheminVignette,
  dimensionsSortie,
  normaliserVignette,
  rectangleRecadrage,
  sonderVideo,
  telechargerBorne,
  urlAsset,
} from "./feed-media";

/** PNG RGBA minimal (dégradé horizontal) fabriqué sans dépendance : fixture locale, aucun réseau. */
function png(largeur: number, hauteur: number): Uint8Array {
  const brut = new Uint8Array((largeur * 4 + 1) * hauteur);
  for (let y = 0; y < hauteur; y++)
    for (let x = 0; x < largeur; x++) {
      const i = y * (largeur * 4 + 1) + 1 + x * 4;
      brut.set([Math.floor((x / largeur) * 255), 80, 160, 255], i);
    }
  const morceau = (type: string, donnees: Uint8Array) => {
    const sortie = new Uint8Array(12 + donnees.length);
    const vue = new DataView(sortie.buffer);
    vue.setUint32(0, donnees.length);
    sortie.set(new TextEncoder().encode(type), 4);
    sortie.set(donnees, 8);
    vue.setUint32(8 + donnees.length, Bun.hash.crc32(sortie.subarray(4, 8 + donnees.length)));
    return sortie;
  };
  const entete = new Uint8Array(13);
  const v = new DataView(entete.buffer);
  v.setUint32(0, largeur);
  v.setUint32(4, hauteur);
  entete.set([8, 6, 0, 0, 0], 8);
  const parties = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    morceau("IHDR", entete),
    morceau("IDAT", new Uint8Array(zlib.deflateSync(brut))),
    morceau("IEND", new Uint8Array(0)),
  ];
  const sortie = new Uint8Array(parties.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parties) {
    sortie.set(p, o);
    o += p.length;
  }
  return sortie;
}

describe("recadrage", () => {
  test("16:9 depuis une image 4:3 : les bandes haut et bas sont retirées, centré", () => {
    expect(rectangleRecadrage(480, 360, 16 / 9)).toEqual({ left: 0, top: 45, width: 480, height: 270 });
  });

  test("1:1 depuis un paysage, 9:16 depuis un carré", () => {
    expect(rectangleRecadrage(800, 400, 1)).toEqual({ left: 200, top: 0, width: 400, height: 400 });
    const r = rectangleRecadrage(400, 400, 9 / 16);
    expect(r).toMatchObject({ top: 0, height: 400, width: 225 });
    expect(r.left).toBe(87);
  });

  test("le rectangle reste dans l'image et garde le ratio, quelle que soit la source", () => {
    for (const [w, h] of [[1, 1], [3, 1000], [1000, 3], [1080, 1920], [1280, 720]] as const)
      for (const ratio of [16 / 9, 1, 9 / 16]) {
        const r = rectangleRecadrage(w, h, ratio);
        expect(r.left).toBeGreaterThanOrEqual(0);
        expect(r.top).toBeGreaterThanOrEqual(0);
        expect(r.left + r.width).toBeLessThanOrEqual(w);
        expect(r.top + r.height).toBeLessThanOrEqual(h);
        expect(r.width).toBeGreaterThan(0);
        expect(r.height).toBeGreaterThan(0);
      }
  });

  test("dimensions de sortie : largeur bornée, jamais agrandie, hauteur dérivée du ratio", () => {
    expect(dimensionsSortie(1280, { ratio: 16 / 9, largeurMax: 640 })).toEqual({ largeur: 640, hauteur: 360 });
    expect(dimensionsSortie(300, { ratio: 1, largeurMax: 640 })).toEqual({ largeur: 300, hauteur: 300 });
  });
});

describe("Bun.Image : vignette normalisée", () => {
  test("recadre au ratio, borne la largeur et encode en WebP", async () => {
    const sortie = await normaliserVignette(png(480, 360), { ratio: 16 / 9, largeurMax: 320 });
    expect(sortie).toMatchObject({ largeur: 320, hauteur: 180 });
    const meta = await new Bun.Image(sortie.octets).metadata();
    expect(meta).toMatchObject({ width: 320, height: 180, format: "webp" });
  });

  test("source portrait → carré", async () => {
    const sortie = await normaliserVignette(png(200, 400), { ratio: 1, largeurMax: 640 });
    expect(sortie).toMatchObject({ largeur: 200, hauteur: 200 });
  });

  test("octets illisibles : la promesse est rejetée (l'appelant garde alors l'ancienne vignette)", async () => {
    await expect(normaliserVignette(new Uint8Array([1, 2, 3, 4]), { ratio: 1, largeurMax: 100 })).rejects.toThrow();
  });
});

describe("Bun.Video : sondage", () => {
  test("octets qui ne sont pas un MP4 : null, sans exception", async () => {
    expect(await sonderVideo(new Uint8Array([0, 1, 2, 3]))).toBeNull();
    expect(await afficheVideo(new Uint8Array([0, 1, 2, 3]), { ratio: 9 / 16, largeurMax: 360 })).toBeNull();
  });

  const ffmpeg = Bun.which("ffmpeg");
  test.skipIf(!ffmpeg || !Bun.Video.available)("MP4 H.264 : durée, dimensions et affiche WebP", async () => {
    const dossier = mkdtempSync(join(tmpdir(), "feed-video-"));
    try {
      const fichier = join(dossier, "clip.mp4");
      const code = Bun.spawnSync([
        ffmpeg!, "-v", "error", "-f", "lavfi", "-i", "testsrc=size=288x512:rate=10:duration=2",
        "-pix_fmt", "yuv420p", "-c:v", "libx264", fichier,
      ]).exitCode;
      if (code !== 0) return; // pas de libx264 sur cette machine : rien à mesurer
      const mp4 = new Uint8Array(await Bun.file(fichier).arrayBuffer());
      const mesures = await sonderVideo(mp4);
      expect(mesures).toMatchObject({ largeur: 288, hauteur: 512 });
      expect(mesures!.duree).toBeCloseTo(2, 0);
      const affiche = await afficheVideo(mp4, { ratio: 9 / 16, largeurMax: 144 });
      expect(affiche).toMatchObject({ largeur: 144, hauteur: 256 });
      expect((await new Bun.Image(affiche!.octets).metadata()).format).toBe("webp");
    } finally {
      rmSync(dossier, { recursive: true, force: true });
    }
  });
});

describe("chemins et téléchargement borné", () => {
  test("chemin de vignette déterministe et assaini", () => {
    expect(cheminVignette("instagram", "Dc_UEDD-KoTgP")).toBe("feed/vignettes/instagram/Dc_UEDD-KoTgP.webp");
    expect(cheminVignette("../x", "../../etc/passwd")).toBe("feed/vignettes/x/etcpasswd.webp");
    expect(urlAsset("feed/a.webp")).toBe("/storage/v1/object/public/assets/feed/a.webp");
  });

  test("téléchargement : refuse au-delà de la borne, que l'en-tête la déclare ou non", async () => {
    const serveur = Bun.serve({
      port: 0,
      fetch(req) {
        const { pathname } = new URL(req.url);
        if (pathname === "/ok") return new Response(new Uint8Array(10));
        if (pathname === "/404") return new Response("non", { status: 404 });
        return new Response(new Uint8Array(5000));
      },
    });
    try {
      const base = `http://localhost:${serveur.port}`;
      expect((await telechargerBorne(`${base}/ok`, 100)).byteLength).toBe(10);
      await expect(telechargerBorne(`${base}/gros`, 1000)).rejects.toThrow(/trop gros/);
      await expect(telechargerBorne(`${base}/404`, 100)).rejects.toThrow(/404/);
    } finally {
      serveur.stop(true);
    }
  });
});
