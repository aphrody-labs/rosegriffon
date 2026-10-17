/**
 * Banque de personnages du jeu : recherche, filtre par jeu, pagination et URL des portraits.
 *
 * Fonctions pures, sans accès réseau ni base : les lignes viennent de `inagle_characters`
 * (chargées côté serveur), les portraits du CDN qui décode les conteneurs
 * `200_icon/10_icon_chr/face/<code>_l.g4tx`. Rien n'est écrit en dur ici hors la forme de
 * ces chemins.
 */

/** Une ligne telle que la base la fournit (une par variante de personnage). */
export type LigneBanque = {
  internal_code: string | null;
  name_fr: string | null;
  name_en: string | null;
  name_ja: string | null;
  series: string | null;
};

/** Un personnage de la banque, dédoublonné par code de base. */
export type PersonnageBanque = {
  /** Code de base `c<8 chiffres>`, clé du portrait. */
  code: string;
  nom: string;
  /** Jeux (séries) dans lesquels il apparaît. */
  series: string[];
  /** Texte normalisé pour la recherche (noms fr, en, ja). */
  recherche: string;
};

export type ParametresBanque = { q: string; serie: string; page: number };

export type PageBanque = {
  items: { code: string; nom: string; series: string[] }[];
  total: number;
  page: number;
  taillePage: number;
  pages: number;
};

export const TAILLE_PAGE = 36;
export const PAGE_MAX = 500;
const CODE_BASE = /^c\d{8}$/;

/** Code de base d'un `internal_code` (`c01000010_5000` donne `c01000010`), ou `null`. */
export function codeBase(interne: string | null | undefined): string | null {
  const base = (interne ?? "").replace(/_\d{4}$/, "");
  return CODE_BASE.test(base) ? base : null;
}

/** Vrai pour un code de base valide, seul format accepté dans une URL de portrait. */
export function codeValide(code: string): boolean {
  return CODE_BASE.test(code);
}

/** URL du portrait, forme NOMMÉE du conteneur (le seul `_1_l00` est le bon visage). */
export function urlPortrait(cdn: string, code: string, largeur = 200): string {
  if (!codeValide(code)) throw new Error("Code de personnage invalide.");
  const hote = cdn.replace(/\/+$/, "");
  return `${hote}/dx11/menu/200_icon/10_icon_chr/face/${code}_l.g4tx/${code}_1_l00.png?w=${largeur}&format=webp`;
}

/** Code du personnage dont l'URL de portrait est donnée, ou `null` (photo téléversée, etc.). */
export function codeDepuisUrl(url: string | null | undefined): string | null {
  const m = /\/10_icon_chr\/face\/(c\d{8})_l\.g4tx\/\1_1_l00\.png(?:\?|$)/.exec(url ?? "");
  return m?.[1] ?? null;
}

/** Minuscules, sans accents ni espaces multiples : la forme comparée dans la recherche. */
export function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("fr")
    .replace(/\s+/g, " ")
    .trim();
}

/** Ramène des paramètres venus du client dans des bornes sûres. */
export function parametresBanque(brut: Partial<Record<keyof ParametresBanque, unknown>>): ParametresBanque {
  const q = typeof brut.q === "string" ? normaliser(brut.q).slice(0, 40) : "";
  const serie = typeof brut.serie === "string" ? brut.serie.trim().slice(0, 60) : "";
  const n = typeof brut.page === "number" && Number.isFinite(brut.page) ? Math.trunc(brut.page) : 0;
  return { q, serie, page: Math.min(Math.max(n, 0), PAGE_MAX) };
}

/**
 * Dédoublonne les variantes par code de base. Le nom retenu est le premier non vide
 * (français, sinon anglais, sinon japonais) ; les séries sont réunies.
 */
export function construireBanque(lignes: readonly LigneBanque[]): PersonnageBanque[] {
  const parCode = new Map<
    string,
    { fr: string; en: string; ja: string; series: Set<string> }
  >();
  for (const l of lignes) {
    const code = codeBase(l.internal_code);
    if (!code) continue;
    const e = parCode.get(code) ?? { fr: "", en: "", ja: "", series: new Set<string>() };
    e.fr ||= l.name_fr?.trim() ?? "";
    e.en ||= l.name_en?.trim() ?? "";
    e.ja ||= l.name_ja?.trim() ?? "";
    if (l.series?.trim()) e.series.add(l.series.trim());
    parCode.set(code, e);
  }
  const sortie: PersonnageBanque[] = [];
  for (const [code, e] of parCode) {
    const nom = e.fr || e.en || e.ja;
    if (!nom) continue;
    sortie.push({
      code,
      nom,
      series: [...e.series].sort((a, b) => a.localeCompare(b, "fr")),
      recherche: normaliser(`${e.fr} ${e.en} ${e.ja}`),
    });
  }
  return sortie.sort((a, b) => a.nom.localeCompare(b.nom, "fr") || a.code.localeCompare(b.code));
}

/** Jeux présents dans la banque, par nombre décroissant de personnages. */
export function seriesDeLaBanque(banque: readonly PersonnageBanque[]): { nom: string; total: number }[] {
  const compte = new Map<string, number>();
  for (const p of banque) for (const s of p.series) compte.set(s, (compte.get(s) ?? 0) + 1);
  return [...compte]
    .map(([nom, total]) => ({ nom, total }))
    .sort((a, b) => b.total - a.total || a.nom.localeCompare(b.nom, "fr"));
}

/** Filtre (recherche par nom, jeu) puis pagine. Seuls les personnages ayant un portrait comptent. */
export function filtrerBanque(
  banque: readonly PersonnageBanque[],
  parametres: ParametresBanque,
  avecPortrait: ReadonlySet<string>,
): PageBanque {
  const termes = parametres.q ? parametres.q.split(" ") : [];
  const retenus = banque.filter(
    p =>
      avecPortrait.has(p.code) &&
      (!parametres.serie || p.series.includes(parametres.serie)) &&
      termes.every(t => p.recherche.includes(t)),
  );
  const pages = Math.max(1, Math.ceil(retenus.length / TAILLE_PAGE));
  const page = Math.min(parametres.page, pages - 1);
  return {
    items: retenus
      .slice(page * TAILLE_PAGE, (page + 1) * TAILLE_PAGE)
      .map(({ code, nom, series }) => ({ code, nom, series })),
    total: retenus.length,
    page,
    taillePage: TAILLE_PAGE,
    pages,
  };
}
