// SPDX-License-Identifier: Apache-2.0
import { describe, expect, test } from "bun:test";

import { CHEMIN_SNAPSHOT, lireSnapshot } from "./feed";
import type { CompteSource, SnapshotFeed } from "./feed";
import { COMPTES_SOURCE_INSTAGRAM, COMPTES_SOURCE_TIKTOK, COMPTES_SOURCE_YOUTUBE, comptesDuFiltre, lienCompte } from "./feed-comptes";
import {
  cookiesDepuisEnv,
  dateDepuisIdTiktok,
  dateDepuisShortcode,
  lireEmbedTiktok,
  nombreAbrege,
  postDepuisGrilleInstagram,
  postsDepuisFluxYoutube,
  postsDepuisItemListTiktok,
  profilDepuisPageInstagram,
} from "./feed-normalisation";

const youtube: CompteSource = COMPTES_SOURCE_YOUTUBE[0]!;
const tiktok: CompteSource = COMPTES_SOURCE_TIKTOK[0]!;
const instagram: CompteSource = COMPTES_SOURCE_INSTAGRAM[0]!;

// ── Fixtures locales (formes relevées le 17/10/2026, textes raccourcis) ─────

const FLUX_YOUTUBE = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
 <yt:channelId>leqt3V_yTgxY6XLZeEFV8g</yt:channelId>
 <title>Rose Griffon TV</title>
 <author><name>Rose Griffon TV</name><uri>https://www.youtube.com/channel/UCleqt3V_yTgxY6XLZeEFV8g</uri></author>
 <entry>
  <id>yt:video:zKQdYDd4Lkc</id>
  <yt:videoId>zKQdYDd4Lkc</yt:videoId>
  <title>Raimon serait boosté ?</title>
  <link rel="alternate" href="https://www.youtube.com/shorts/zKQdYDd4Lkc"/>
  <author><name>Rose Griffon TV</name></author>
  <published>2026-01-20T18:05:43+00:00</published>
  <media:group>
   <media:title>Raimon serait boosté ?</media:title>
   <media:thumbnail url="https://i3.ytimg.com/vi/zKQdYDd4Lkc/hqdefault.jpg" width="480" height="360"/>
   <media:description>Plus d'infos sur le Discord !</media:description>
   <media:community><media:statistics views="1865"/></media:community>
  </media:group>
 </entry>
 <entry>
  <id>yt:video:7OaJUnpJ9i0</id>
  <yt:videoId>7OaJUnpJ9i0</yt:videoId>
  <title>Guide</title>
  <link rel="alternate" href="https://www.youtube.com/watch?v=7OaJUnpJ9i0"/>
  <published>2026-10-17T09:02:32+00:00</published>
  <media:group>
   <media:thumbnail url="https://i4.ytimg.com/vi/7OaJUnpJ9i0/hqdefault.jpg" width="480" height="360"/>
   <media:community><media:statistics views="10475"/></media:community>
  </media:group>
 </entry>
 <entry><id>yt:video:x</id><yt:videoId>court</yt:videoId><published>2026-01-01T00:00:00+00:00</published></entry>
</feed>`;

const EMBED_TIKTOK = (videos: unknown[]) =>
  `<html><script id="__FRONTITY_CONNECT_STATE__" type="application/json">${JSON.stringify({
    source: {
      data: {
        "/embed/@rose_griffon": {
          videoList: videos,
          userInfo: { uniqueId: "rose_griffon", nickname: "Rose Griffon", followerCount: "1551", followingCount: "841", verified: "False", signature: "Association" },
        },
      },
    },
  })}</script></html>`;

const VIDEO_TIKTOK = {
  id: "7597505622657010977",
  desc: "Raimon serait boosté ? #inazumaeleven",
  width: "576",
  height: "1024",
  coverUrl: "https://p16.example.test/cover.png?x-expires=1",
  playAddr: "https://v45.example.test/video.mp4?sig=1",
  playCount: "5662",
  privateItem: "False",
  authorUniqueId: "rose_griffon",
};

describe("YouTube", () => {
  test("flux Atom → posts : dates, vues, vignette, embed, Short en vertical", () => {
    const { posts, profil } = postsDepuisFluxYoutube(Bun.XML.parse(FLUX_YOUTUBE), youtube);
    expect(posts.map(p => p.id)).toEqual(["youtube:zKQdYDd4Lkc", "youtube:7OaJUnpJ9i0"]);
    const [court, long] = posts;
    expect(court!.date).toBe("2026-01-20T18:05:43.000Z");
    expect(court!.metriques?.vues).toBe(1865);
    expect(court!.texte).toBe("Raimon serait boosté ?\n\nPlus d'infos sur le Discord !");
    expect(court!.integration?.url).toBe("https://www.youtube-nocookie.com/embed/zKQdYDd4Lkc");
    expect(court!.integration?.ratio).toBeCloseTo(9 / 16);
    expect(long!.integration?.ratio).toBeCloseTo(16 / 9);
    expect(long!.medias[0]).toMatchObject({ type: "video", apercu: "https://i4.ytimg.com/vi/7OaJUnpJ9i0/hqdefault.jpg", largeur: 480 });
    expect(long!.auteur.lien).toBe("https://www.youtube.com/channel/UCleqt3V_yTgxY6XLZeEFV8g");
    expect(long!.groupe).toBe("Rose Griffon");
    expect(profil?.nom).toBe("Rose Griffon TV");
  });

  test("une seule entrée (objet et non tableau) et un flux vide", () => {
    const un = FLUX_YOUTUBE.replace(/<entry>[\s\S]*<\/entry>\s*<entry><id>yt:video:x[\s\S]*<\/entry>/, FLUX_YOUTUBE.match(/<entry>[\s\S]*?<\/entry>/)![0]);
    expect(postsDepuisFluxYoutube(Bun.XML.parse(un), youtube).posts).toHaveLength(1);
    expect(postsDepuisFluxYoutube({}, youtube).posts).toEqual([]);
    expect(postsDepuisFluxYoutube(null, youtube).profil).toBeNull();
  });

  test("les chaînes listées sont des identifiants UC… et leurs liens publics", () => {
    for (const c of COMPTES_SOURCE_YOUTUBE) expect(c.pseudo).toMatch(/^UC[A-Za-z0-9_-]{22}$/);
    expect(lienCompte(youtube)).toBe("https://www.youtube.com/channel/UCleqt3V_yTgxY6XLZeEFV8g");
    expect(comptesDuFiltre({ reseau: "youtube", groupe: "LEVEL-5" })).toHaveLength(1);
  });
});

describe("TikTok : page d'embed du créateur", () => {
  test("vidéos, vues, date exacte, lien MP4 mis à part", () => {
    const lu = lireEmbedTiktok(EMBED_TIKTOK([VIDEO_TIKTOK]), tiktok);
    expect(lu?.posts).toHaveLength(1);
    const p = lu!.posts[0]!;
    expect(p.id).toBe("tiktok:7597505622657010977");
    expect(p.date).toBe(dateDepuisIdTiktok("7597505622657010977")!);
    expect(p.metriques?.vues).toBe(5662);
    expect(p.medias[0]).toMatchObject({ type: "video", apercu: VIDEO_TIKTOK.coverUrl, largeur: 576, hauteur: 1024 });
    expect(p.integration?.url).toBe("https://www.tiktok.com/embed/v2/7597505622657010977");
    expect(p.integration!.ratio).toBeCloseTo(0.5625);
    // Le MP4 signé n'entre jamais dans le post (il expire) : il est rendu à part.
    expect(JSON.stringify(p)).not.toContain("video.mp4");
    expect(lu!.lectures["7597505622657010977"]).toContain("video.mp4");
    expect(lu!.profil).toMatchObject({ pseudo: "rose_griffon", abonnes: 1551, abonnements: 841, certifie: false });
  });

  test("vidéos privées ou sans date valide ignorées ; page illisible → null", () => {
    const lu = lireEmbedTiktok(EMBED_TIKTOK([{ ...VIDEO_TIKTOK, privateItem: "True" }, { id: "12" }, { desc: "sans id" }]), tiktok);
    expect(lu?.posts).toEqual([]);
    expect(lireEmbedTiktok("<html></html>", tiktok)).toBeNull();
    expect(lireEmbedTiktok(`<script id="__FRONTITY_CONNECT_STATE__">{pas du json</script>`, tiktok)).toBeNull();
  });
});

describe("TikTok : item_list capté avec une session (fixture de la forme de l'API web)", () => {
  test("posts avec likes, commentaires, durée", () => {
    const { posts, lectures } = postsDepuisItemListTiktok(
      {
        itemList: [
          {
            id: "7597505622657010977",
            desc: "desc",
            createTime: "1768932122",
            author: { uniqueId: "rose_griffon", nickname: "Rose Griffon" },
            video: { cover: "https://c.example.test/c.jpg", width: 576, height: 1024, duration: 53, playAddr: "https://v.example.test/v.mp4" },
            stats: { playCount: 10, diggCount: 2, commentCount: 1, shareCount: 0 },
          },
          { desc: "sans id" },
        ],
      },
      tiktok,
    );
    expect(posts).toHaveLength(1);
    expect(posts[0]!.date).toBe(new Date(1768932122 * 1000).toISOString());
    expect(posts[0]!.metriques).toEqual({ vues: 10, jaime: 2, reponses: 1, partages: 0 });
    expect(posts[0]!.medias[0]!.duree).toBe(53);
    expect(lectures["7597505622657010977"]).toBe("https://v.example.test/v.mp4");
    expect(postsDepuisItemListTiktok({}, tiktok).posts).toEqual([]);
  });
});

describe("Instagram : grille du profil rendue", () => {
  test("publication et reel : dates du shortcode, embed, légende de l'oEmbed", () => {
    const photo = postDepuisGrilleInstagram(
      { href: "/rose_griffonfr/p/DcUEDDKoTgP/", image: "https://scontent.example.test/a.jpg?oe=1", alt: "Photo by X on August 21, 2026." },
      instagram,
      { title: "Participation #iergday", author_name: "orphelinalius" },
    );
    expect(photo).toMatchObject({
      id: "instagram:DcUEDDKoTgP",
      reseau: "instagram",
      texte: "Participation #iergday",
      lien: "https://www.instagram.com/p/DcUEDDKoTgP/",
      groupe: "Rose Griffon",
    });
    expect(photo!.date).toBe(dateDepuisShortcode("DcUEDDKoTgP")!);
    expect(photo!.medias[0]).toMatchObject({ type: "image", apercu: "https://scontent.example.test/a.jpg?oe=1" });
    expect(photo!.integration?.url).toBe("https://www.instagram.com/p/DcUEDDKoTgP/embed/");

    const reel = postDepuisGrilleInstagram({ href: "/rose_griffonfr/reel/CvYRCX-N5LB/", image: "https://scontent.example.test/b.jpg" }, instagram);
    expect(reel!.lien).toBe("https://www.instagram.com/reel/CvYRCX-N5LB/");
    expect(reel!.medias[0]!.type).toBe("video");
    expect(reel!.texte).toBe("");
  });

  test("liens étrangers, image non https ou shortcode sans date : rejetés ou sans image", () => {
    expect(postDepuisGrilleInstagram({ href: "/explore/tags/inazuma/" }, instagram)).toBeNull();
    expect(postDepuisGrilleInstagram({ href: "/p/!!!/" }, instagram)).toBeNull();
    expect(postDepuisGrilleInstagram({ href: "/p/DcUEDDKoTgP/", image: "javascript:alert(1)" }, instagram)!.medias).toEqual([]);
  });

  test("profil : compteurs de l'og:description (français) et en-tête", () => {
    const profil = profilDepuisPageInstagram(
      {
        ogDescription: "1,2 k followers, 26 suivis, 96 publications - Voir les photos et vidéos Instagram de Rose Griffon (@rose_griffonfr)",
        ogImage: "https://scontent.example.test/avatar.jpg",
        entete: "rose_griffonfr\n483 followers\n25 suivi(e)s\nInazuma Eleven FR | Rose Griffon\nrose_griffonfr\nAssociation Inazuma Eleven 🌹\ndiscord.gg/xyz",
      },
      instagram,
    );
    expect(profil).toMatchObject({ abonnes: 1200, abonnements: 26, publications: 96, nom: "Inazuma Eleven FR | Rose Griffon" });
    expect(profil.bio).toBe("Association Inazuma Eleven 🌹\ndiscord.gg/xyz");
    expect(profilDepuisPageInstagram({}, instagram)).toMatchObject({ nom: instagram.nom, abonnes: undefined });
  });
});

describe("utilitaires", () => {
  test("nombreAbrege", () => {
    expect(nombreAbrege("1 551")).toBe(1551);
    expect(nombreAbrege("1,2 k")).toBe(1200);
    expect(nombreAbrege("3.4M")).toBe(3_400_000);
    expect(nombreAbrege("12.345")).toBe(12345);
    expect(nombreAbrege("abc")).toBeUndefined();
    expect(nombreAbrege(undefined)).toBeUndefined();
  });

  test("cookies : en-tête ou tableau JSON, jamais de valeur vide", () => {
    expect(cookiesDepuisEnv("sessionid=abc; csrftoken=de=f; vide=; =x", ".instagram.com")).toEqual([
      { name: "sessionid", value: "abc", domain: ".instagram.com", path: "/", secure: true, httpOnly: true },
      { name: "csrftoken", value: "de=f", domain: ".instagram.com", path: "/", secure: true, httpOnly: true },
    ]);
    const json = JSON.stringify([{ name: "sid", value: "1", domain: ".tiktok.com" }, { name: "x", value: "" }, { name: "evil", value: "1", domain: ".evil.test" }]);
    const lus = cookiesDepuisEnv(json, ".tiktok.com");
    expect(lus.map(c => [c.name, c.domain])).toEqual([
      ["sid", ".tiktok.com"],
      ["evil", ".tiktok.com"],
    ]);
    expect(cookiesDepuisEnv(undefined, ".tiktok.com")).toEqual([]);
    expect(cookiesDepuisEnv("[pas du json", ".tiktok.com")).toEqual([]);
  });

  test("instantané : version, réseau, date et forme sont vérifiés", () => {
    const bon: SnapshotFeed = {
      version: 1,
      reseau: "youtube",
      genereLe: "2026-10-17T10:00:00.000Z",
      posts: [],
      profils: [],
      statut: { reseau: "youtube", etat: "vide" },
    };
    expect(lireSnapshot(bon, "youtube")).toEqual(bon);
    expect(lireSnapshot(bon, "tiktok")).toBeNull();
    expect(lireSnapshot({ ...bon, version: 2 }, "youtube")).toBeNull();
    expect(lireSnapshot({ ...bon, genereLe: "hier" }, "youtube")).toBeNull();
    expect(lireSnapshot(null, "youtube")).toBeNull();
    expect(CHEMIN_SNAPSHOT("instagram")).toBe("feed/snapshots/instagram.json");
  });
});
