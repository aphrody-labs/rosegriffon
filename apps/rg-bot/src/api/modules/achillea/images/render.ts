/**
 * Outils de rendu partagés des images Achilléa (carte joueur, affiche de clan,
 * licence PDF) sur `@aphrody/canvas` (Skia).
 *
 * Polices : Inter (« Achillea Sans ») et Satoshi Black (« Achillea Display
 * Num ») sont servies par `@rosegriffon/assets/public/achillea/fonts`. Le repli
 * CJK n'embarque plus MS Gothic (3 Mo, police propriétaire) : il s'appuie sur
 * les polices système du VPS, comme les cartes du bot Rose Griffon.
 */

import { GlobalFonts, loadImage, type Image, type SKRSContext2D } from "@aphrody/canvas";

const FONTS: ReadonlyArray<{ file: string; alias: string }> = [
  { file: "InterVariable.woff2", alias: "Achillea Sans" },
  { file: "Satoshi-Black.woff2", alias: "Achillea Display Num" },
];

const FALLBACK = `"Droid Sans Fallback", "DejaVu Sans"`;
export const FONT_SANS = `"Achillea Sans", ${FALLBACK}`;
export const FONT_NUM = `"Achillea Display Num", "Achillea Sans", ${FALLBACK}`;

/** Couleur de marque Achilléa. */
export const ACHILLEA_PURPLE = "#6d00ce";

let fontsRegistered = false;

/** Enregistre les polices Achilléa. Idempotent ; un échec laisse le repli système. */
export function registerAchilleaFonts(): void {
  if (fontsRegistered) return;
  fontsRegistered = true;
  for (const { file, alias } of FONTS) {
    try {
      const path = Bun.fileURLToPath(import.meta.resolve(`@rosegriffon/assets/public/achillea/fonts/${file}`));
      GlobalFonts.registerFromPath(path, alias);
    } catch (err) {
      console.warn(`[achillea/images] police ${file} indisponible :`, err);
    }
  }
}

// Palette des rangs (index 0 = « Non classé », rang 1 → index 1), identique au legacy.
export const RANK_COLORS: readonly string[] = [
  "#000000",
  "#959595",
  "#B17253",
  "#7FACB8",
  "#C2AD88",
  "#897E8B",
  "#88F6FF",
  "#2D925C",
  "#FF5648",
  "#7EDCB5",
  "#F010FF",
  "#FFA910",
];

export const RANK_NAMES: readonly string[] = [
  "Non classé",
  "Fer",
  "Bronze",
  "Argent",
  "Or",
  "Platine",
  "Diamant",
  "Émeraude",
  "Rubis",
  "Divin",
  "Supernova",
  "Légendaire",
];

const RANK_THRESHOLDS: readonly number[] = [0, 50, 200, 400, 600, 800, 1000, 1200, 1400, 1700, 2100];

/** Index de rang (1 à 11) d'après l'ELO. */
export function rankFromElo(elo: number): number {
  let index = 0;
  for (const [i, threshold] of RANK_THRESHOLDS.entries()) if (elo >= threshold) index = i + 1;
  return Math.min(Math.max(index, 1), 11);
}

/**
 * Les polices ne contiennent ni les pseudo-styles Unicode (𝒜𝓎𝒶𝓃ℯ) ni les emoji :
 * NFKC ramène les premiers à l'ASCII, les seconds sont retirés plutôt que
 * rendus en « tofu ».
 */
export function sanitizeName(name: string): string {
  return name
    .normalize("NFKC")
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}]/gu, "")
    .replace(/[\p{Default_Ignorable_Code_Point}\p{Emoji_Modifier}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

export function hexWithAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, "0");
  return /^#[0-9a-f]{6}$/i.test(hex) ? `${hex}${a}` : hex;
}

export function roundRect(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** Hôtes autorisés pour les images distantes (avatars, logos de clan). */
const REMOTE_IMAGE_HOSTS = [/(^|\.)discordapp\.com$/, /(^|\.)discordapp\.net$/, /(^|\.)supabase\.co$/, /(^|\.)rosegriffon\.fr$/];
const MAX_REMOTE_IMAGE_BYTES = 8 * 1024 * 1024;

/**
 * Charge une image distante (5 s, 8 Mo max). Seuls HTTPS et les hôtes connus
 * sont suivis : l'URL vient de la base (avatar, logo saisi par un joueur), un
 * hôte arbitraire ferait de l'API un relais de requêtes (SSRF).
 */
export async function fetchImage(url: string | null | undefined): Promise<Image | null> {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const extraHost = (process.env.ACHILLEA_IMAGE_HOSTS ?? "").split(",").map(h => h.trim()).filter(Boolean);
  const allowed =
    parsed.protocol === "https:" &&
    (REMOTE_IMAGE_HOSTS.some(re => re.test(parsed.hostname)) || extraHost.includes(parsed.hostname));
  if (!allowed) return null;
  try {
    const response = await fetch(parsed, { signal: AbortSignal.timeout(5000), redirect: "error" });
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_REMOTE_IMAGE_BYTES) return null;
    return await loadImage(bytes);
  } catch {
    return null;
  }
}

/** Disque recadré (avatar / logo) ; « ? » sur fond neutre si l'image manque. */
export function drawCircleImage(
  ctx: SKRSContext2D,
  image: Image | null,
  x: number,
  y: number,
  size: number,
  placeholder = "#2a2233",
): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  if (image) {
    ctx.drawImage(image, x, y, size, size);
  } else {
    ctx.fillStyle = placeholder;
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${Math.floor(size / 2)}px ${FONT_SANS}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("?", x + size / 2, y + size / 2);
  }
  ctx.restore();
}

/** Domaine affiché en pied d'image. */
export function websiteHost(): string {
  try {
    return new URL(process.env.WEBSITE_URL ?? "https://rosegriffon.fr").host;
  } catch {
    return "rosegriffon.fr";
  }
}

export const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

export class ImageNotFoundError extends Error {}
