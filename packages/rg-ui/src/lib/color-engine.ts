/**
 * Moteur de couleurs des thèmes : calcule les 36 rôles Material 3 d'un thème
 * à partir d'une graine OKLCH (`THEME_PACKS[id].seed`) et des réglages de
 * l'utilisateur. Module pur, sans dépendance ni API navigateur : le même code
 * sert au générateur CSS (`scripts/generer-themes.ts`), au réglage à
 * l'exécution (`lib/theme-tune.ts`) et aux tests.
 *
 * Règles :
 *   - Chaque rôle est une clarté OKLCH tirée des tables `TONS` (une par mode),
 *     une chroma relative à la chroma de sa famille, et la teinte de la famille.
 *   - Familles : primaire = teinte de la graine ; secondaire = teinte + 180°
 *     (accent complémentaire, cf. l'or de Roy), chroma × 0,6, sauf si la
 *     graine impose `secondary` ; tertiaire = teinte + 60° (analogue), chroma × 0,5 ; erreur =
 *     teinte fixe 27°, chroma 0,19 ; neutres = teinte de la graine, chroma ×
 *     0,1 (bornée à 0,03), variante neutre × 2.
 *   - Hors gamut sRGB : la chroma baisse (clarté et teinte conservées) jusqu'à
 *     rentrer dans le gamut.
 *   - Contraste `c` dans [-1, 1] : chaque texte « on-X » s'éloigne (c > 0) ou se
 *     rapproche (c < 0) de son fond, puis il est poussé jusqu'au ratio WCAG
 *     minimal `4,5 + 2,5·max(c, 0)` (4,5:1 à 0, 7:1 à 1). Le plancher reste
 *     4,5:1 même à contraste réduit.
 */

export type ThemeMode = "light" | "dark";

export interface ThemeSeed {
  /** Teinte OKLCH en degrés. */
  hue: number;
  /** Chroma OKLCH de la couleur de marque. */
  chroma: number;
  mode: ThemeMode;
  /**
   * Accent secondaire imposé par la marque, quand le complémentaire calculé
   * la trahit (Achilléa : violet + or, le complémentaire du violet donnerait
   * un vert citron). La teinte suit la rotation réglée par l'utilisateur.
   */
  secondary?: { hue: number; chroma: number };
  /** Chroma des neutres ; 0 donne des gris purs. Défaut : chroma × 0,1 bornée à 0,03. */
  neutralChroma?: number;
}

export interface ThemeAdjustments {
  /** Rotation de teinte en degrés, [-180, 180]. */
  hueShift: number;
  /** Multiplicateur de chroma, [0, 2]. */
  chroma: number;
  /** Niveau de contraste, [-1, 1]. */
  contrast: number;
}

export const DEFAULT_ADJUSTMENTS: Readonly<ThemeAdjustments> = Object.freeze({
  hueShift: 0,
  chroma: 1,
  contrast: 0,
});

export const ROLE_NAMES = [
  "primary",
  "on-primary",
  "primary-container",
  "on-primary-container",
  "secondary",
  "on-secondary",
  "secondary-container",
  "on-secondary-container",
  "tertiary",
  "on-tertiary",
  "tertiary-container",
  "on-tertiary-container",
  "error",
  "on-error",
  "error-container",
  "on-error-container",
  "background",
  "on-background",
  "surface",
  "on-surface",
  "surface-variant",
  "on-surface-variant",
  "outline",
  "outline-variant",
  "scrim",
  "shadow",
  "inverse-surface",
  "inverse-on-surface",
  "inverse-primary",
  "surface-dim",
  "surface-bright",
  "surface-container-lowest",
  "surface-container-low",
  "surface-container",
  "surface-container-high",
  "surface-container-highest",
] as const;

export type Role = (typeof ROLE_NAMES)[number];
/** Rôle → couleur `#rrggbb`. */
export type RoleMap = Record<Role, string>;

export const ROLE_PREFIX = "--md-sys-color-";

const SURFACES = [
  "surface",
  "surface-dim",
  "surface-bright",
  "surface-container-lowest",
  "surface-container-low",
  "surface-container",
  "surface-container-high",
  "surface-container-highest",
  "surface-variant",
] as const satisfies readonly Role[];

/** Paires texte/fond qui doivent tenir le ratio WCAG (texte d'abord). */
export const CONTRAST_PAIRS: ReadonlyArray<readonly [Role, Role]> = [
  ["on-primary", "primary"],
  ["on-primary-container", "primary-container"],
  ["on-secondary", "secondary"],
  ["on-secondary-container", "secondary-container"],
  ["on-tertiary", "tertiary"],
  ["on-tertiary-container", "tertiary-container"],
  ["on-error", "error"],
  ["on-error-container", "error-container"],
  ["on-background", "background"],
  ["inverse-on-surface", "inverse-surface"],
  ...SURFACES.map((s) => ["on-surface", s] as const),
  ...SURFACES.map((s) => ["on-surface-variant", s] as const),
];

// ─── Tables de tons ────────────────────────────────────────────────────────

/** Clarté OKLCH (0-1) et chroma relative à la famille, par rôle. */
interface Ton {
  l: number;
  c: number;
}

type Famille =
  | "primary"
  | "secondary"
  | "tertiary"
  | "error"
  | "neutral"
  | "neutral-variant";

const FAMILLE: Record<Role, Famille> = {
  primary: "primary",
  "on-primary": "primary",
  "primary-container": "primary",
  "on-primary-container": "primary",
  "inverse-primary": "primary",
  secondary: "secondary",
  "on-secondary": "secondary",
  "secondary-container": "secondary",
  "on-secondary-container": "secondary",
  tertiary: "tertiary",
  "on-tertiary": "tertiary",
  "tertiary-container": "tertiary",
  "on-tertiary-container": "tertiary",
  error: "error",
  "on-error": "error",
  "error-container": "error",
  "on-error-container": "error",
  background: "neutral",
  "on-background": "neutral",
  surface: "neutral",
  "on-surface": "neutral",
  "surface-dim": "neutral",
  "surface-bright": "neutral",
  "surface-container-lowest": "neutral",
  "surface-container-low": "neutral",
  "surface-container": "neutral",
  "surface-container-high": "neutral",
  "surface-container-highest": "neutral",
  "inverse-surface": "neutral",
  "inverse-on-surface": "neutral",
  scrim: "neutral",
  shadow: "neutral",
  "surface-variant": "neutral-variant",
  "on-surface-variant": "neutral-variant",
  outline: "neutral-variant",
  "outline-variant": "neutral-variant",
};

const accent = (
  l: number,
  on: number,
  container: number,
  onContainer: number,
) => ({
  role: { l, c: 1 },
  on: { l: on, c: 0.12 },
  container: { l: container, c: 0.45 },
  onContainer: { l: onContainer, c: 0.85 },
});

function tableAccents(
  a: ReturnType<typeof accent>,
  famille: "primary" | "secondary" | "tertiary" | "error",
) {
  return {
    [famille]: a.role,
    [`on-${famille}`]: a.on,
    [`${famille}-container`]: a.container,
    [`on-${famille}-container`]: a.onContainer,
  } as Record<Role, Ton>;
}

/** Tons par mode. Les surfaces portent la chroma neutre (c = 1 → chroma neutre pleine). */
export const TONS: Record<ThemeMode, RoleTable> = {
  light: {
    ...tableAccents(accent(0.48, 0.985, 0.91, 0.32), "primary"),
    ...tableAccents(accent(0.5, 0.985, 0.92, 0.32), "secondary"),
    ...tableAccents(accent(0.5, 0.985, 0.92, 0.32), "tertiary"),
    ...tableAccents(accent(0.52, 0.985, 0.92, 0.32), "error"),
    background: { l: 0.982, c: 1 },
    "on-background": { l: 0.24, c: 3 },
    surface: { l: 0.982, c: 1 },
    "on-surface": { l: 0.24, c: 3 },
    "surface-variant": { l: 0.92, c: 1 },
    "on-surface-variant": { l: 0.42, c: 1 },
    outline: { l: 0.58, c: 1 },
    "outline-variant": { l: 0.84, c: 1 },
    scrim: { l: 0, c: 0 },
    shadow: { l: 0, c: 0 },
    "inverse-surface": { l: 0.3, c: 1.5 },
    "inverse-on-surface": { l: 0.955, c: 1 },
    "inverse-primary": { l: 0.8, c: 0.7 },
    "surface-dim": { l: 0.9, c: 1 },
    "surface-bright": { l: 0.982, c: 1 },
    "surface-container-lowest": { l: 0.998, c: 0.3 },
    "surface-container-low": { l: 0.965, c: 1 },
    "surface-container": { l: 0.952, c: 1 },
    "surface-container-high": { l: 0.938, c: 1 },
    "surface-container-highest": { l: 0.924, c: 1 },
  },
  dark: {
    ...tableAccents(accent(0.83, 0.3, 0.4, 0.93), "primary"),
    ...tableAccents(accent(0.82, 0.3, 0.38, 0.93), "secondary"),
    ...tableAccents(accent(0.8, 0.3, 0.38, 0.93), "tertiary"),
    ...tableAccents(accent(0.8, 0.3, 0.4, 0.93), "error"),
    background: { l: 0.185, c: 1 },
    "on-background": { l: 0.93, c: 0.6 },
    surface: { l: 0.185, c: 1 },
    "on-surface": { l: 0.93, c: 0.6 },
    "surface-variant": { l: 0.34, c: 1 },
    "on-surface-variant": { l: 0.83, c: 1 },
    outline: { l: 0.64, c: 1 },
    "outline-variant": { l: 0.38, c: 1 },
    scrim: { l: 0, c: 0 },
    shadow: { l: 0, c: 0 },
    "inverse-surface": { l: 0.93, c: 0.6 },
    "inverse-on-surface": { l: 0.26, c: 1 },
    "inverse-primary": { l: 0.48, c: 1 },
    "surface-dim": { l: 0.185, c: 1 },
    "surface-bright": { l: 0.345, c: 1 },
    "surface-container-lowest": { l: 0.145, c: 1 },
    "surface-container-low": { l: 0.21, c: 1 },
    "surface-container": { l: 0.23, c: 1 },
    "surface-container-high": { l: 0.27, c: 1 },
    "surface-container-highest": { l: 0.31, c: 1 },
  },
};

export type RoleTable = Record<Role, Ton>;

/** Texte → fond de référence, pour le sens du déplacement de contraste. */
const FOND_DE: Partial<Record<Role, Role>> = {
  "on-primary": "primary",
  "on-primary-container": "primary-container",
  "on-secondary": "secondary",
  "on-secondary-container": "secondary-container",
  "on-tertiary": "tertiary",
  "on-tertiary-container": "tertiary-container",
  "on-error": "error",
  "on-error-container": "error-container",
  "on-background": "background",
  "on-surface": "surface",
  "on-surface-variant": "surface",
  "inverse-on-surface": "inverse-surface",
  outline: "surface",
};

// ─── Conversions ───────────────────────────────────────────────────────────

/** OKLCH → sRGB linéaire (matrices de Björn Ottosson). */
function oklchVersLineaire(
  l: number,
  c: number,
  h: number,
): [number, number, number] {
  const radians = (h * Math.PI) / 180;
  const a = c * Math.cos(radians);
  const b = c * Math.sin(radians);
  const lr = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mr = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const sr = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * lr - 3.3077115913 * mr + 0.2309699292 * sr,
    -1.2684380046 * lr + 2.6097574011 * mr - 0.3413193965 * sr,
    -0.0041960863 * lr - 0.7034186147 * mr + 1.707614701 * sr,
  ];
}

const EPSILON_GAMUT = 1e-6;

function dansGamut([r, g, b]: [number, number, number]): boolean {
  return [r, g, b].every((v) => v >= -EPSILON_GAMUT && v <= 1 + EPSILON_GAMUT);
}

function versGamma(v: number): number {
  const x = Math.min(1, Math.max(0, v));
  return x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
}

function versLineaire(v: number): number {
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

/** Chroma maximale tenant dans sRGB pour (l, h), bornée par `c`. */
export function chromaEnGamut(l: number, c: number, h: number): number {
  if (dansGamut(oklchVersLineaire(l, c, h))) return c;
  let bas = 0;
  let haut = c;
  for (let i = 0; i < 24; i++) {
    const milieu = (bas + haut) / 2;
    if (dansGamut(oklchVersLineaire(l, milieu, h))) bas = milieu;
    else haut = milieu;
  }
  return bas;
}

/** `oklch(l c h)` → `#rrggbb`, chroma réduite jusqu'au gamut sRGB. */
export function oklchToHex(l: number, c: number, h: number): string {
  const lb = Math.min(1, Math.max(0, l));
  const rgb = oklchVersLineaire(lb, chromaEnGamut(lb, Math.max(0, c), h), h);
  return `#${rgb
    .map((v) =>
      Math.round(versGamma(v) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

function hexVersLineaire(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) =>
    versLineaire(v / 255),
  ) as [number, number, number];
}

/** `#rrggbb` → OKLCH. */
export function hexToOklch(hex: string): { l: number; c: number; h: number } {
  const [r, g, b] = hexVersLineaire(hex);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const c = Math.hypot(A, B);
  const h =
    c < 1e-4 ? 0 : ((((Math.atan2(B, A) * 180) / Math.PI) % 360) + 360) % 360;
  return { l: L, c, h };
}

/** Luminance relative WCAG 2.x. */
export function luminance(hex: string): number {
  const [r, g, b] = hexVersLineaire(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Ratio de contraste WCAG 2.x entre deux `#rrggbb`. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// ─── Calcul ────────────────────────────────────────────────────────────────

const borner = (v: number, min: number, max: number) =>
  Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : min;

/** Ramène des réglages quelconques (stockage, URL) dans leurs bornes. */
export function clampAdjustments(
  adj: Partial<ThemeAdjustments> | null | undefined,
): ThemeAdjustments {
  return {
    hueShift: borner(adj?.hueShift ?? 0, -180, 180),
    chroma: borner(adj?.chroma ?? 1, 0, 2),
    contrast: borner(adj?.contrast ?? 0, -1, 1),
  };
}

/** Ratio minimal exigé pour un niveau de contraste. */
export function contrastTarget(contrast: number): number {
  return 4.5 + 2.5 * Math.max(0, contrast);
}

const PAS = 0.005;

export function computeRoles(
  seed: ThemeSeed,
  adjustments?: Partial<ThemeAdjustments>,
): RoleMap {
  const adj = clampAdjustments(adjustments);
  const tons = TONS[seed.mode];
  const teinte = (((seed.hue + adj.hueShift) % 360) + 360) % 360;
  const chroma = seed.chroma * adj.chroma;
  const neutre = seed.neutralChroma ?? Math.min(chroma * 0.1, 0.03);
  const secondaire = seed.secondary
    ? {
        h: (((seed.secondary.hue + adj.hueShift) % 360) + 360) % 360,
        c: seed.secondary.chroma * adj.chroma,
      }
    : { h: (teinte + 180) % 360, c: chroma * 0.6 };
  const familles: Record<Famille, { h: number; c: number }> = {
    primary: { h: teinte, c: chroma },
    secondary: secondaire,
    tertiary: { h: (teinte + 60) % 360, c: chroma * 0.5 },
    error: { h: 27, c: 0.19 },
    neutral: { h: teinte, c: neutre },
    "neutral-variant": { h: teinte, c: neutre * 2 },
  };

  const clartes = {} as Record<Role, number>;
  for (const role of ROLE_NAMES) clartes[role] = tons[role].l;

  // Déplacement de contraste. c > 0 : le texte parcourt 70 % × c de la distance
  // qui le sépare de l'extrême (jamais saturé avant c = 1) et un fond d'accent
  // s'écarte de 0,04 × c ; c < 0 : le texte se rapproche de 30 % × |c| de l'écart.
  for (const [texte, fond] of Object.entries(FOND_DE) as [Role, Role][]) {
    const sens = tons[texte].l >= tons[fond].l ? 1 : -1;
    const ecart = Math.abs(tons[texte].l - tons[fond].l);
    const reste = sens > 0 ? 1 - tons[texte].l : tons[texte].l;
    const delta =
      adj.contrast >= 0
        ? adj.contrast * 0.7 * reste
        : adj.contrast * ecart * 0.3;
    clartes[texte] = borner(tons[texte].l + sens * delta, 0, 1);
    if (FAMILLE[fond] !== "neutral" || fond === "inverse-surface")
      clartes[fond] = borner(
        tons[fond].l - sens * Math.max(0, adj.contrast) * 0.04,
        0,
        1,
      );
  }

  const couleur = (role: Role) => {
    const f = familles[FAMILLE[role]];
    return oklchToHex(clartes[role], f.c * tons[role].c, f.h);
  };
  const roles = {} as RoleMap;
  for (const role of ROLE_NAMES) roles[role] = couleur(role);

  // Plancher WCAG : on pousse le texte vers l'extrême, puis le fond à l'opposé.
  const cible = contrastTarget(adj.contrast);
  const fondsDe = new Map<Role, Role[]>();
  for (const [texte, fond] of CONTRAST_PAIRS)
    fondsDe.set(texte, [...(fondsDe.get(texte) ?? []), fond]);
  for (const [texte, fonds] of fondsDe) {
    for (let garde = 0; garde < 400; garde++) {
      const pire = fonds.reduce((a, b) =>
        contrastRatio(roles[texte], roles[b]) <
        contrastRatio(roles[texte], roles[a])
          ? b
          : a,
      );
      if (contrastRatio(roles[texte], roles[pire]) >= cible) break;
      const sens = clartes[texte] >= clartes[pire] ? 1 : -1;
      const extreme = sens > 0 ? clartes[texte] >= 1 : clartes[texte] <= 0;
      if (!extreme) {
        clartes[texte] = borner(clartes[texte] + sens * PAS, 0, 1);
        roles[texte] = couleur(texte);
      } else {
        clartes[pire] = borner(clartes[pire] - sens * PAS, 0, 1);
        roles[pire] = couleur(pire);
      }
    }
  }
  return roles;
}

/** Rôles → déclarations `--md-sys-color-*`. */
export function roleVariables(roles: RoleMap): Record<string, string> {
  const sortie: Record<string, string> = {};
  for (const role of ROLE_NAMES) sortie[`${ROLE_PREFIX}${role}`] = roles[role];
  return sortie;
}
