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
  moteurVideo,
  rectangleRecadrage,
  sonderMp4,
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

/** Boîte ISO-BMFF : taille (4), type (4), contenu. */
function boite(type: string, ...contenus: Uint8Array[]): Uint8Array {
  const taille = 8 + contenus.reduce((n, c) => n + c.byteLength, 0);
  const sortie = new Uint8Array(taille);
  new DataView(sortie.buffer).setUint32(0, taille);
  sortie.set(new TextEncoder().encode(type), 4);
  let p = 8;
  for (const c of contenus) {
    sortie.set(c, p);
    p += c.byteLength;
  }
  return sortie;
}

function octets(taille: number, ecrire: (v: DataView) => void = () => undefined): Uint8Array {
  const sortie = new Uint8Array(taille);
  ecrire(new DataView(sortie.buffer));
  return sortie;
}

/** MP4 minimal (en-têtes seuls, aucune image) : `moov` en fin de fichier, comme ceux de TikTok. */
function mp4Factice(o: { largeur: number; hauteur: number; echelle: number; duree: number; codec: string }): Uint8Array {
  const mvhd = boite("mvhd", octets(100, v => {
    v.setUint32(12, o.echelle); // version 0 : flags(4) creation(4) modification(4) timescale(4) duration(4)
    v.setUint32(16, o.duree);
  }));
  const piste = (genre: string, largeur: number, hauteur: number, codec: string) => {
    const tkhd = boite("tkhd", octets(84, v => {
      v.setUint32(76, largeur << 16);
      v.setUint32(80, hauteur << 16);
    }));
    const hdlr = boite("hdlr", octets(24, v => new TextEncoder().encode(genre).forEach((c, i) => v.setUint8(8 + i, c))));
    const stsd = boite("stsd", octets(8, v => v.setUint32(4, 1)), boite(codec, new Uint8Array(70)));
    return boite("trak", tkhd, boite("mdia", hdlr, boite("minf", boite("stbl", stsd))));
  };
  return new Uint8Array([
    ...boite("ftyp", new TextEncoder().encode("isom\0\0\0\0isom")),
    ...boite("mdat", new Uint8Array(32)),
    ...boite("moov", mvhd, piste("soun", 0, 0, "mp4a"), piste("vide", o.largeur, o.hauteur, o.codec)),
  ]);
}

describe("sondage sans Bun.Video (Bun 1.4.5 du VPS)", () => {
  const clip = mp4Factice({ largeur: 576, hauteur: 1024, echelle: 1000, duree: 12_345, codec: "avc1" });

  test("moteurVideo ne lève jamais, que le runtime ait Bun.Video ou non", () => {
    expect(() => moteurVideo()).not.toThrow();
    const moteur = moteurVideo();
    if (moteur) expect(moteur.available).toBe(true);
  });

  test("en-tête MP4 : durée (mvhd), dimensions de la piste vidéo (tkhd), codec (stsd)", () => {
    expect(sonderMp4(clip)).toEqual({ duree: 12.3, largeur: 576, hauteur: 1024, codec: "avc1" });
    expect(sonderMp4(mp4Factice({ largeur: 1080, hauteur: 1920, echelle: 90_000, duree: 0, codec: "hvc1" }))).toEqual({
      duree: undefined,
      largeur: 1080,
      hauteur: 1920,
      codec: "hvc1",
    });
  });

  test("fichier illisible, tronqué ou sans piste vidéo : null, sans exception", () => {
    expect(sonderMp4(new Uint8Array([0, 1, 2, 3]))).toBeNull();
    expect(sonderMp4(clip.subarray(0, clip.byteLength - 40))).toBeNull();
    expect(sonderMp4(boite("moov", boite("mvhd", new Uint8Array(100))))).toBeNull();
  });

  test("sans moteur : sonderVideo retombe sur l'en-tête, afficheVideo rend null", async () => {
    expect(await sonderVideo(clip, undefined)).toEqual({ duree: 12.3, largeur: 576, hauteur: 1024, codec: "avc1" });
    expect(await afficheVideo(clip, { ratio: 9 / 16, largeurMax: 360 }, 1, undefined)).toBeNull();
  });

  test("moteur qui échoue (codec non décodé) : repli sur l'en-tête", async () => {
    const enPanne = class {
      static available = true;
      metadata(): Promise<never> {
        return Promise.reject(new Error("codec non pris en charge"));
      }
    } as unknown as NonNullable<ReturnType<typeof moteurVideo>>;
    expect(await sonderVideo(clip, enPanne)).toMatchObject({ largeur: 576, hauteur: 1024 });
    expect(await afficheVideo(clip, { ratio: 9 / 16, largeurMax: 360 }, 1, enPanne)).toBeNull();
  });

  const ffmpeg = Bun.which("ffmpeg");
  test.skipIf(!ffmpeg)("MP4 réel (ffmpeg) : l'en-tête donne les mêmes mesures que Bun.Video", async () => {
    const dossier = mkdtempSync(join(tmpdir(), "feed-mp4-"));
    try {
      const fichier = join(dossier, "clip.mp4");
      const code = Bun.spawnSync([
        ffmpeg!, "-v", "error", "-f", "lavfi", "-i", "testsrc=size=288x512:rate=10:duration=2",
        "-pix_fmt", "yuv420p", fichier,
      ]).exitCode;
      if (code !== 0) return;
      const mesures = sonderMp4(new Uint8Array(await Bun.file(fichier).arrayBuffer()));
      expect(mesures).toMatchObject({ largeur: 288, hauteur: 512 });
      expect(mesures!.duree).toBeCloseTo(2, 0);
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
