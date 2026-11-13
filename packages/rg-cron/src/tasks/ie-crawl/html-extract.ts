/**
 * @license
 * Copyright 2026 Rose Griffon
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Extraction des index d'actualités (LEVEL-5, Victory Road) par `HTMLRewriter`.
 *
 * Reprend à l'identique la sémantique de l'ancienne extraction cheerio :
 * `.text()` concatène le texte de tous les descendants, `.attr()` lit le premier
 * élément trouvé. `HTMLRewriter` livre le texte et les attributs bruts : les
 * références de caractères sont décodées après concaténation (un fragment peut
 * couper une entité en deux).
 */

// Entités nommées HTML 4 : Latin-1 (U+00A0 à U+00FF, dans l'ordre), puis spéciales et symboles usuels.
const LATIN1 =
  "nbsp iexcl cent pound curren yen brvbar sect uml copy ordf laquo not shy reg macr deg plusmn sup2 sup3 acute micro para middot cedil sup1 ordm raquo frac14 frac12 frac34 iquest Agrave Aacute Acirc Atilde Auml Aring AElig Ccedil Egrave Eacute Ecirc Euml Igrave Iacute Icirc Iuml ETH Ntilde Ograve Oacute Ocirc Otilde Ouml times Oslash Ugrave Uacute Ucirc Uuml Yacute THORN szlig agrave aacute acirc atilde auml aring aelig ccedil egrave eacute ecirc euml igrave iacute icirc iuml eth ntilde ograve oacute ocirc otilde ouml divide oslash ugrave uacute ucirc uuml yacute thorn yuml";
const AUTRES: Record<string, number> = {
  amp: 38,
  lt: 60,
  gt: 62,
  quot: 34,
  apos: 39,
  OElig: 338,
  oelig: 339,
  Scaron: 352,
  scaron: 353,
  Yuml: 376,
  fnof: 402,
  circ: 710,
  tilde: 732,
  ensp: 8194,
  emsp: 8195,
  thinsp: 8201,
  zwnj: 8204,
  zwj: 8205,
  lrm: 8206,
  rlm: 8207,
  ndash: 8211,
  mdash: 8212,
  lsquo: 8216,
  rsquo: 8217,
  sbquo: 8218,
  ldquo: 8220,
  rdquo: 8221,
  bdquo: 8222,
  dagger: 8224,
  Dagger: 8225,
  bull: 8226,
  hellip: 8230,
  permil: 8240,
  prime: 8242,
  Prime: 8243,
  lsaquo: 8249,
  rsaquo: 8250,
  oline: 8254,
  euro: 8364,
  trade: 8482,
  larr: 8592,
  uarr: 8593,
  rarr: 8594,
  darr: 8595,
  harr: 8596,
};

const ENTITES = new Map<string, string>([
  ...LATIN1.split(" ").map((nom, i): [string, string] => [
    nom,
    String.fromCodePoint(0xa0 + i),
  ]),
  ...Object.entries(AUTRES).map(([nom, cp]): [string, string] => [
    nom,
    String.fromCodePoint(cp),
  ]),
]);

/**
 * Normalise les fins de ligne (CRLF et CR isolé → LF, comme le parseur HTML) puis décode
 * les références numériques et les entités nommées HTML 4 ; laisse le reste intact.
 */
export function decodeEntities(brut: string): string {
  const texte = brut.includes("\r") ? brut.replace(/\r\n?/g, "\n") : brut;
  if (!texte.includes("&")) return texte;
  return texte.replace(
    /&(#\d+|#[xX][\da-fA-F]+|[a-zA-Z][a-zA-Z\d]*);/g,
    (entite, ref: string) => {
      if (ref.startsWith("#")) {
        const hex = ref[1] === "x" || ref[1] === "X";
        const cp = Number.parseInt(ref.slice(hex ? 2 : 1), hex ? 16 : 10);
        return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : entite;
      }
      return ENTITES.get(ref) ?? entite;
    },
  );
}

/** Élément « portée » (équivalent d'un `$(sel).each`) et ses champs collectés. */
interface Portee {
  textes: Record<string, string>;
  attrs: Record<string, string | undefined>;
}

interface ChampTexte {
  selecteur: string;
}

interface ChampAttr {
  selecteur: string;
  attr: string;
}

/**
 * Pour chaque élément `portee` (ordre du document), concatène le texte de `textes[k]`
 * et lit l'attribut du PREMIER élément de `attrs[k]` — comme `$(el).find(sel).text()` /
 * `.attr()` de cheerio. Les sélecteurs des champs sont relatifs à la portée.
 */
function collecter(
  html: string,
  portee: string,
  textes: Record<string, ChampTexte>,
  attrs: Record<string, ChampAttr> = {},
): Portee[] {
  const resultats: Portee[] = [];
  const pile: Portee[] = [];
  const vus = new WeakMap<Portee, Set<string>>();
  let rw = new HTMLRewriter().on(portee, {
    element(el) {
      const p: Portee = {
        textes: Object.fromEntries(Object.keys(textes).map((k) => [k, ""])),
        attrs: {},
      };
      vus.set(p, new Set());
      resultats.push(p);
      pile.push(p);
      el.onEndTag(() => {
        pile.splice(pile.lastIndexOf(p), 1);
      });
    },
  });
  for (const [cle, champ] of Object.entries(textes)) {
    rw = rw.on(`${portee} ${champ.selecteur}`, {
      text(t) {
        for (const p of pile) p.textes[cle] += t.text;
      },
    });
  }
  for (const [cle, champ] of Object.entries(attrs)) {
    rw = rw.on(`${portee} ${champ.selecteur}`, {
      element(el) {
        for (const p of pile) {
          const deja = vus.get(p)!;
          if (deja.has(cle)) continue;
          deja.add(cle);
          const v = el.getAttribute(champ.attr);
          p.attrs[cle] = v === null ? undefined : decodeEntities(v);
        }
      },
    });
  }
  rw.transform(html);
  for (const p of resultats) {
    for (const cle of Object.keys(p.textes))
      p.textes[cle] = decodeEntities(p.textes[cle] ?? "");
  }
  return resultats;
}

/** Liens `<a>` du document : `href` décodé (ou `undefined`) et texte complet (non rogné). */
function liens(
  html: string,
): Array<{ href: string | undefined; texte: string }> {
  const resultats: Array<{ href: string | undefined; texte: string }> = [];
  const pile: Array<{ href: string | undefined; texte: string }> = [];
  new HTMLRewriter()
    .on("a", {
      element(el) {
        const v = el.getAttribute("href");
        const lien = { href: v === null ? undefined : v, texte: "" };
        resultats.push(lien);
        pile.push(lien);
        el.onEndTag(() => {
          pile.splice(pile.lastIndexOf(lien), 1);
        });
      },
      text(t) {
        for (const lien of pile) lien.texte += t.text;
      },
    })
    .transform(html);
  return resultats.map((l) => ({
    href: l.href === undefined ? undefined : decodeEntities(l.href),
    texte: decodeEntities(l.texte),
  }));
}

/** Concatène le texte de tous les éléments `selecteur` (`$(sel).text()`). */
function texteDe(html: string, selecteur: string): string {
  let texte = "";
  new HTMLRewriter()
    .on(selecteur, {
      text(t) {
        texte += t.text;
      },
    })
    .transform(html);
  return decodeEntities(texte);
}

export interface Level5NewsItem {
  id: string;
  url: string;
  title: string;
  date: string;
}

/** Index https://www.level5.co.jp/news/ : liens `news/YYYYMMDD/`, dédoublonnés par id. */
export function extraireLevel5News(html: string): Level5NewsItem[] {
  const articles: Level5NewsItem[] = [];
  for (const lien of liens(html)) {
    const href = lien.href || "";
    const text = lien.texte.trim();
    const match = href.match(/\/news\/(\d{8})\//);
    if (!match) continue;
    const id = match[1] || "";
    const absoluteUrl = href.startsWith("http")
      ? href
      : `https://www.level5.co.jp${href}`;
    if (id && !articles.find((a) => a.id === id)) {
      articles.push({
        id,
        url: absoluteUrl,
        title: text || "LEVEL-5 Announcement",
        date: `${id.substring(0, 4)}.${id.substring(4, 6)}.${id.substring(6, 8)}`,
      });
    }
  }
  return articles;
}

export interface Level5BlogEntree {
  id: string;
  url: string;
  title: string;
  date: string;
}

/**
 * Index du blog LEVEL-5 : articles de `aside #recent ul li.item`, puis l'article à la une
 * (`article h2 dt` / `dd`) sous l'id `latest`. Dédoublonnés par id.
 */
export function extraireLevel5BlogIndex(
  html: string,
  urlIndex: string,
): Level5BlogEntree[] {
  const articles: Level5BlogEntree[] = [];
  const items = collecter(
    html,
    "aside #recent ul li.item",
    { date: { selecteur: "dt" }, title: { selecteur: "dd" } },
    { href: { selecteur: "a", attr: "href" } },
  );
  for (const item of items) {
    const href = item.attrs.href || "";
    const date = (item.textes.date ?? "").trim();
    const title = (item.textes.title ?? "").trim();
    if (!href) continue;
    const absoluteUrl = href.startsWith("http")
      ? href
      : `https://www.level5.co.jp${href}`;
    const urlParts = href.split("/").filter(Boolean);
    const id = urlParts[urlParts.length - 1] || "index";
    if (id && !articles.find((a) => a.id === id)) {
      articles.push({
        id,
        url: absoluteUrl,
        title: title || "LEVEL-5 Blog Post",
        date: date || "Unknown",
      });
    }
  }

  const latestTitle = texteDe(html, "article h2 dd").trim();
  const latestDate = texteDe(html, "article h2 dt").trim();
  if (latestTitle && latestDate && !articles.find((a) => a.id === "latest")) {
    articles.push({
      id: "latest",
      url: urlIndex,
      title: latestTitle,
      date: latestDate,
    });
  }
  return articles;
}

/** Texte d'un article du blog LEVEL-5 (`article section.all`), rogné. */
export function extraireLevel5BlogTexte(html: string): string {
  return texteDe(html, "article section.all").trim() || "";
}

export interface LienActualite {
  id: string;
  url: string;
  title: string;
  date: string;
}

/** Index des topics Victory Road (`ul.list li` : date en `dt`, lien en `dd a`). */
export function extraireTopics(html: string): LienActualite[] {
  const topicLinks: LienActualite[] = [];
  const items = collecter(
    html,
    "ul.list li",
    { dt: { selecteur: "dt" }, title: { selecteur: "dd a" } },
    { href: { selecteur: "dd a", attr: "href" } },
  );
  for (const item of items) {
    const dt = (item.textes.dt ?? "").trim();
    const href = item.attrs.href || "";
    const title = (item.textes.title ?? "").trim();
    if (!href || !title) continue;
    const absoluteUrl = href.startsWith("http")
      ? href
      : `https://www.inazuma.jp${href}`;
    const id = absoluteUrl.split("/").filter(Boolean).pop() || "";
    if (id && id !== "topics" && id !== "fr" && id !== "en") {
      topicLinks.push({ id, url: absoluteUrl, title, date: dt });
    }
  }
  return topicLinks;
}

/** Index des patch notes Victory Road : liens `/ver_*`, date `YYYY.M.D` extraite du texte. */
export function extrairePatchNotes(html: string): LienActualite[] {
  const patchLinks: LienActualite[] = [];
  for (const lien of liens(html)) {
    const href = lien.href;
    if (!href || !href.includes("/ver_")) continue;
    const fullText = lien.texte.trim();
    const dateMatch = fullText.match(/(\d{4}\.\d{1,2}\.\d{1,2})/);
    const date = dateMatch ? dateMatch[0] : "";
    const title = fullText
      .replace(date, "")
      .replace("[JST]", "")
      .replace(/\s+/g, " ")
      .trim();
    const absoluteUrl = href.startsWith("http")
      ? href
      : `https://www.inazuma.jp${href}`;
    const id = absoluteUrl.split("/").filter(Boolean).pop() || "";
    if (id && !patchLinks.find((p) => p.id === id)) {
      patchLinks.push({
        id,
        url: absoluteUrl,
        title: title || "Patch Note",
        date,
      });
    }
  }
  return patchLinks;
}
