// SPDX-License-Identifier: Apache-2.0
import { describe, expect, test } from "bun:test";

import { COMPTES_SOURCE_INSTAGRAM, COMPTES_SOURCE_TIKTOK, COMPTES_SOURCE_X, comptesDuFiltre } from "./comptes";
import { composerFil } from "./fil";
import type { XTweet } from "./live";
import {
  analyserVideoTiktok,
  dateDepuisIdTiktok,
  dateDepuisShortcode,
  decoderCurseur,
  encoderCurseur,
  fusionner,
  postDepuisCreationInstagram,
  postDepuisOembedInstagram,
  postDepuisOembedTiktok,
  postDepuisTweet,
  profilDepuisHtmlTiktok,
} from "./normalisation";
import type { PageSource, ParametresLecture, PostFeed, SourceFeed } from "./types";

const tweet: XTweet = {
  id: "1850000000000000001",
  text: "Nouvelle bande-annonce https://t.co/abc #IE",
  author: { username: "ievrfr", name: "Victory Road FR" },
  created_at: "Sat Oct 12 10:00:00 +0000 2026",
  reply_count: 2,
  retweet_count: 3,
  quote_count: 1,
  like_count: 10,
  view_count: 500,
  media: [
    { type: "photo", url: "https://pbs.twimg.com/a.jpg", width: 100, height: 50 },
    { type: "animated_gif", url: "https://video.twimg.com/b.mp4", preview_url: "https://pbs.twimg.com/b.jpg" },
  ],
};

function post(id: string, reseau: PostFeed["reseau"], date: string): PostFeed {
  return {
    id: `${reseau}:${id}`,
    idOrigine: id,
    reseau,
    auteur: { pseudo: "a", nom: "A", lien: "https://example.test" },
    texte: id,
    medias: [],
    date,
    lien: "https://example.test",
  };
}

const source = (reseau: SourceFeed["reseau"], page: (p: ParametresLecture) => Promise<PageSource>): SourceFeed => ({
  reseau,
  comptes: reseau === "x" ? COMPTES_SOURCE_X : reseau === "instagram" ? COMPTES_SOURCE_INSTAGRAM : COMPTES_SOURCE_TIKTOK,
  lire: page,
});

describe("normalisation X", () => {
  test("tweet vers PostFeed", () => {
    const p = postDepuisTweet(tweet, COMPTES_SOURCE_X.find(c => c.pseudo === "ievrfr"));
    expect(p.id).toBe("x:1850000000000000001");
    expect(p.lien).toBe("https://x.com/ievrfr/status/1850000000000000001");
    expect(p.date).toBe("2026-10-12T10:00:00.000Z");
    expect(p.metriques).toEqual({ reponses: 2, partages: 4, jaime: 10, vues: 500 });
    expect(p.medias.map(m => m.type)).toEqual(["image", "gif"]);
    expect(p.groupe).toBe("Inazuma Eleven");
  });

  test("date invalide : époque, jamais d'exception", () => {
    expect(postDepuisTweet({ ...tweet, created_at: "n'importe quoi" }).date).toBe(new Date(0).toISOString());
  });
});

describe("dates portées par les identifiants", () => {
  test("TikTok : snowflake", () => {
    // Exemple de la documentation TikTok : vidéo de juillet 2019.
    expect(dateDepuisIdTiktok("6718335390845095173")?.slice(0, 7)).toBe("2019-07");
    expect(dateDepuisIdTiktok("abc")).toBeNull();
    expect(dateDepuisIdTiktok("1")).toBeNull();
  });

  test("Instagram : shortcode", () => {
    expect(dateDepuisShortcode("DcUEDDKoTgP")?.slice(0, 4)).toBe("2026");
    expect(dateDepuisShortcode("!!")).toBeNull();
  });
});

describe("Instagram", () => {
  const ligne = {
    shortcode: "DcUEDDKoTgP",
    permalink: "https://www.instagram.com/p/DcUEDDKoTgP/",
    auteur_pseudo: "orphelinalius",
    legende: "Participation #iergday",
    images: [{ chemin: "campagnes/iergday/instagram/DcUEDDKoTgP.jpg", largeur: 640, hauteur: 853 }, { chemin: null }],
    publie_le: "2026-08-21T19:13:55.054Z",
  };

  test("création de la base : seules les images servables sont gardées", () => {
    const p = postDepuisCreationInstagram(ligne, c => `/assets/${c}`);
    expect(p.medias).toEqual([
      { type: "image", url: "/assets/campagnes/iergday/instagram/DcUEDDKoTgP.jpg", largeur: 640, hauteur: 853 },
    ]);
    expect(p.date).toBe("2026-08-21T19:13:55.054Z");
    expect(p.auteur.pseudo).toBe("orphelinalius");
    expect(p.integration).toBeUndefined();
  });

  test("oEmbed : légende, auteur, embed paresseux", () => {
    const p = postDepuisOembedInstagram("DcUEDDKoTgP", {
      title: "Légende",
      author_name: "orphelinalius",
      author_url: "https://www.instagram.com/orphelinalius",
      thumbnail_url: "https://cdn.test/t.jpg",
    });
    expect(p?.auteur.pseudo).toBe("orphelinalius");
    expect(p?.integration?.url).toBe("https://www.instagram.com/p/DcUEDDKoTgP/embed/");
    expect(postDepuisOembedInstagram("!!", {})).toBeNull();
  });
});

describe("TikTok", () => {
  test("analyse de lien : seul tiktok.com est accepté", () => {
    expect(analyserVideoTiktok("https://www.tiktok.com/@rose_griffon/video/6718335390845095173?lang=fr")).toEqual({
      pseudo: "rose_griffon",
      id: "6718335390845095173",
    });
    expect(analyserVideoTiktok("https://tiktok.com.evil.test/@a/video/6718335390845095173")).toBeNull();
    expect(analyserVideoTiktok("https://www.tiktok.com/@a")).toBeNull();
  });

  test("oEmbed vers PostFeed", () => {
    const p = postDepuisOembedTiktok("rose_griffon", "6718335390845095173", {
      title: "Titre",
      author_name: "Rose Griffon",
      thumbnail_url: "https://p16.test/t.jpg",
    });
    expect(p?.id).toBe("tiktok:6718335390845095173");
    expect(p?.medias[0]?.type).toBe("video");
    expect(p?.integration?.url).toBe("https://www.tiktok.com/embed/v2/6718335390845095173");
  });

  test("profil lu dans le JSON de réhydratation", () => {
    const json = JSON.stringify({
      __DEFAULT_SCOPE__: {
        "webapp.user-detail": {
          userInfo: {
            user: { uniqueId: "rose_griffon", nickname: "Rose Griffon", signature: "Association", verified: false, bioLink: { link: "www.rosegriffon.fr" } },
            stats: { followerCount: 1551, followingCount: 841, videoCount: 78 },
          },
        },
      },
    });
    const html = `<html><script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">${json}</script></html>`;
    const p = profilDepuisHtmlTiktok(html, "Rose_Griffon");
    expect(p?.abonnes).toBe(1551);
    expect(p?.site?.url).toBe("https://www.rosegriffon.fr");
    expect(profilDepuisHtmlTiktok(html, "autre")).toBeNull();
    expect(profilDepuisHtmlTiktok("<html></html>", "rose_griffon")).toBeNull();
  });
});

describe("fusion et curseur", () => {
  test("dédoublonne et trie du plus récent au plus ancien", () => {
    const fusion = fusionner([
      [post("1", "x", "2026-10-01T00:00:00Z"), post("2", "x", "2026-10-03T00:00:00Z")],
      [post("1", "x", "2026-10-01T00:00:00Z"), post("3", "tiktok", "2026-10-02T00:00:00Z")],
    ]);
    expect(fusion.map(p => p.id)).toEqual(["x:2", "tiktok:3", "x:1"]);
    expect(fusionner([[post("1", "x", "2026-10-01T00:00:00Z"), post("2", "x", "2026-10-03T00:00:00Z")]], 1)).toHaveLength(1);
  });

  test("curseur composite : aller-retour et rejet des valeurs invalides", () => {
    const c = encoderCurseur({ x: '{"a":"b"}', instagram: undefined });
    expect(decoderCurseur(c)).toEqual({ x: '{"a":"b"}' });
    expect(encoderCurseur({})).toBeUndefined();
    expect(decoderCurseur("%%%")).toBeNull();
    expect(decoderCurseur(Buffer.from("[1]").toString("base64url"))).toBeNull();
  });
});

describe("filtres de comptes", () => {
  test("par réseau, groupe et compte", () => {
    expect(comptesDuFiltre({ reseau: "tiktok" }).map(c => c.pseudo)).toEqual(["rose_griffon"]);
    expect(comptesDuFiltre({ groupe: "LEVEL-5" }).every(c => c.reseau === "x")).toBe(true);
    expect(comptesDuFiltre({ compte: "AZALEE_IE" })).toHaveLength(1);
    expect(comptesDuFiltre({ reseau: "instagram", groupe: "LEVEL-5" })).toHaveLength(0);
  });
});

describe("fil unifié", () => {
  const pageX: PageSource = {
    posts: [post("1", "x", "2026-10-01T00:00:00Z"), post("2", "x", "2026-10-05T00:00:00Z")],
    profils: [],
    curseur: '{"rose_griffon":"abc"}',
    statut: { reseau: "x", etat: "ok" },
  };
  const pageTt: PageSource = {
    posts: [post("9", "tiktok", "2026-10-03T00:00:00Z")],
    profils: [],
    statut: { reseau: "tiktok", etat: "ok" },
  };

  test("fusionne les sources, trie par date et expose le curseur de X", async () => {
    const fil = await composerFil(
      [source("x", async () => pageX), source("tiktok", async () => pageTt), source("instagram", async () => ({ posts: [], profils: [], statut: { reseau: "instagram", etat: "vide" } }))],
      {},
    );
    expect(fil.posts.map(p => p.id)).toEqual(["x:2", "tiktok:9", "x:1"]);
    expect(fil.sources.map(s => s.etat).sort()).toEqual(["ok", "ok", "vide"]);
    expect(decoderCurseur(fil.curseur)).toEqual({ x: '{"rose_griffon":"abc"}' });
  });

  test("une source en panne n'empêche pas les autres", async () => {
    const fil = await composerFil(
      [
        source("x", async () => {
          throw new Error("X en panne");
        }),
        source("tiktok", async () => pageTt),
      ],
      {},
    );
    expect(fil.posts.map(p => p.id)).toEqual(["tiktok:9"]);
    expect(fil.sources.find(s => s.reseau === "x")?.etat).toBe("indisponible");
  });

  test("le filtre de réseau n'interroge que ce réseau", async () => {
    let appels = 0;
    const fil = await composerFil(
      [
        source("x", async () => {
          appels++;
          return pageX;
        }),
        source("tiktok", async () => pageTt),
      ],
      { reseau: "tiktok" },
    );
    expect(appels).toBe(0);
    expect(fil.posts).toHaveLength(1);
  });

  test("page suivante : seules les sources avec curseur sont relues", async () => {
    const recus: Array<string | undefined> = [];
    let appelsTt = 0;
    const fil = await composerFil(
      [
        source("x", async ({ curseur }) => {
          recus.push(curseur);
          return { posts: [post("0", "x", "2026-09-01T00:00:00Z")], profils: [], statut: { reseau: "x", etat: "ok" } };
        }),
        source("tiktok", async () => {
          appelsTt++;
          return pageTt;
        }),
      ],
      {},
      encoderCurseur({ x: '{"rose_griffon":"abc"}' }),
    );
    expect(recus).toEqual(['{"rose_griffon":"abc"}']);
    expect(appelsTt).toBe(0);
    expect(fil.curseur).toBeUndefined();
  });
});
