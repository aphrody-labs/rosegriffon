/**
 * Charge les packs de thème `themes/<id>/theme.toml` (schéma Yolo UI v1.1,
 * `yolo-ui/crates/yolo-theme-pack/src/manifest.rs`, `deny_unknown_fields`),
 * valide leurs clés et les convertit au format de `THEME_PACKS`
 * (`src/lib/themes.ts`) : title, logo, wallpaper, pet, seed.
 *
 * Les graines `oklch(L C H)` donnent teinte et chroma ; L est ignoré, le
 * moteur de couleurs tire la clarté de ses tables de tons.
 *
 * Usage : `bun packages/rg-ui/scripts/charger-packs.ts` (affiche le JSON).
 */
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { ThemeSeed } from "../src/lib/color-engine";
import type { ThemePack } from "../src/lib/themes";

type Table = Record<string, unknown>;

/** Clés autorisées par table du schéma v1.1 (manifest.rs). */
const CLES: Record<string, readonly string[]> = {
  racine: ["id", "name", "title", "logo", "color", "icons", "wallpapers", "pet", "typography", "shell", "assets"],
  title: ["product_name", "window_title_template", "ntp_heading"],
  logo: ["mark", "monochrome", "wordmark", "png", "ico"],
  color: ["seed", "source", "variant", "contrast", "mode", "overrides", "secondary", "neutral_chroma"],
  secondary: ["hue", "chroma"],
  icons: ["set", "style", "weight"],
  wallpaper: ["file", "mode", "seed", "license", "source", "attribution", "fit", "focal", "sha256"],
  pet: ["id", "provider", "anchor", "name", "states", "files", "size"],
  typography: ["display", "body", "mono"],
  shell: ["layout", "density", "radius", "glass_blur", "motion"],
  asset: ["file", "license", "source", "sha256"],
};

const REQUIS: Record<string, readonly string[]> = {
  racine: ["id", "name", "title", "color", "icons", "typography", "shell"],
  title: ["product_name", "window_title_template", "ntp_heading"],
  logo: ["mark", "monochrome"],
  color: ["seed"],
  secondary: ["hue", "chroma"],
  icons: ["set"],
  wallpaper: ["file", "license", "source"],
  pet: ["id", "provider"],
  typography: ["display", "body", "mono"],
  shell: ["layout", "radius"],
  asset: ["file", "license", "source"],
};

const ENUMS: Record<string, readonly string[]> = {
  "color.source": ["seed", "wallpaper"],
  "color.mode": ["system", "light", "dark"],
  "icons.style": ["outlined", "filled", "rounded", "sharp"],
  "wallpaper.mode": ["system", "light", "dark"],
  "wallpaper.fit": ["cover", "contain", "tile"],
  "shell.layout": ["sidebar", "top-bar", "dock", "floating"],
  "shell.motion": ["calm", "lively", "still"],
};

/** Racines publiques des assets (préfixes de dépôt), pour retrouver les chemins de `THEME_PACKS`. */
const RACINES_PUBLIQUES = ["packages/rg-assets/public", "apps/rg-website/public"] as const;

export const DOSSIER_THEMES = fileURLToPath(new URL("../themes/", import.meta.url));

function estTable(v: unknown): v is Table {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function table(v: unknown, chemin: string): Table {
  if (!estTable(v)) throw new Error(`${chemin}: table attendue`);
  return v;
}

function verifierCles(t: Table, schema: string, chemin: string): void {
  const permises = CLES[schema] ?? [];
  for (const cle of Object.keys(t)) {
    if (!permises.includes(cle)) throw new Error(`${chemin}: clé inconnue "${cle}"`);
  }
  for (const cle of REQUIS[schema] ?? []) {
    if (!(cle in t)) throw new Error(`${chemin}: clé requise absente "${cle}"`);
  }
  for (const [cle, valeur] of Object.entries(t)) {
    const valeurs = ENUMS[`${schema}.${cle}`];
    if (valeurs && !valeurs.includes(String(valeur))) {
      throw new Error(`${chemin}.${cle}: "${String(valeur)}" hors de ${valeurs.join("|")}`);
    }
  }
}

function texte(t: Table, cle: string, chemin: string): string {
  const v = t[cle];
  if (typeof v !== "string") throw new Error(`${chemin}.${cle}: chaîne attendue`);
  return v;
}

function nombre(t: Table, cle: string, chemin: string): number {
  const v = t[cle];
  if (typeof v !== "number") throw new Error(`${chemin}.${cle}: nombre attendu`);
  return v;
}

/** Teinte et chroma d'un `oklch(L C H)` (L en 0..1 ou en %, H en degrés). */
export function oklchVersTeinteChroma(valeur: string): { hue: number; chroma: number } {
  const m = /^oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?\s*\)$/i.exec(valeur.trim());
  if (!m) throw new Error(`graine oklch() invalide: "${valeur}"`);
  return { hue: Number(m[3]), chroma: Number(m[2]) };
}

/** `packages/rg-assets/public/emote/x.webp` devient `/emote/x.webp`. */
export function cheminPublic(chemin: string): string {
  for (const racine of RACINES_PUBLIQUES) {
    if (chemin.startsWith(`${racine}/`)) return chemin.slice(racine.length);
  }
  throw new Error(`chemin hors des racines publiques: "${chemin}"`);
}

/** Valide un `theme.toml` déjà analysé et le convertit au format `ThemePack`. */
export function convertirPack(brut: unknown, chemin = "theme.toml"): { id: string; pack: ThemePack } {
  const racine = table(brut, chemin);
  verifierCles(racine, "racine", chemin);
  const id = texte(racine, "id", chemin);

  const title = table(racine.title, `${chemin}.title`);
  verifierCles(title, "title", `${chemin}.title`);

  const logo = table(racine.logo, `${chemin}.logo`);
  verifierCles(logo, "logo", `${chemin}.logo`);

  const couleur = table(racine.color, `${chemin}.color`);
  verifierCles(couleur, "color", `${chemin}.color`);
  const { hue, chroma } = oklchVersTeinteChroma(texte(couleur, "seed", `${chemin}.color`));
  const mode = texte(couleur, "mode", `${chemin}.color`);
  if (mode !== "light" && mode !== "dark") throw new Error(`${chemin}.color.mode: "light" ou "dark" requis`);
  const seed: ThemeSeed = { hue, chroma, mode };
  if (couleur.secondary !== undefined) {
    const s = table(couleur.secondary, `${chemin}.color.secondary`);
    verifierCles(s, "secondary", `${chemin}.color.secondary`);
    seed.secondary = {
      hue: nombre(s, "hue", `${chemin}.color.secondary`),
      chroma: nombre(s, "chroma", `${chemin}.color.secondary`),
    };
  }
  if (couleur.neutral_chroma !== undefined) seed.neutralChroma = nombre(couleur, "neutral_chroma", `${chemin}.color`);

  for (const cle of ["icons", "typography", "shell"] as const) {
    verifierCles(table(racine[cle], `${chemin}.${cle}`), cle, `${chemin}.${cle}`);
  }

  const fonds = racine.wallpapers;
  if (!Array.isArray(fonds) || fonds.length === 0) throw new Error(`${chemin}.wallpapers: au moins un fond attendu`);
  fonds.forEach((f, i) => {
    verifierCles(table(f, `${chemin}.wallpapers[${i}]`), "wallpaper", `${chemin}.wallpapers[${i}]`);
  });
  const fond = table(fonds[0], `${chemin}.wallpapers[0]`);

  let pet: ThemePack["pet"] = null;
  if (racine.pet !== undefined) {
    const p = table(racine.pet, `${chemin}.pet`);
    verifierCles(p, "pet", `${chemin}.pet`);
    const fichiers = table(p.files, `${chemin}.pet.files`);
    const emotes: Record<string, string> = {};
    for (const [etat, fichier] of Object.entries(fichiers)) {
      if (typeof fichier !== "string") throw new Error(`${chemin}.pet.files.${etat}: chaîne attendue`);
      emotes[etat] = cheminPublic(fichier);
    }
    const hello = emotes.hello;
    if (hello === undefined) throw new Error(`${chemin}.pet.files: état "hello" requis`);
    const sortie: { hello: string; proud?: string; surprised?: string } = { hello };
    if (emotes.proud !== undefined) sortie.proud = emotes.proud;
    if (emotes.surprised !== undefined) sortie.surprised = emotes.surprised;
    pet = { name: texte(p, "name", `${chemin}.pet`), emotes: sortie };
  }

  if (racine.assets !== undefined) {
    for (const [nom, a] of Object.entries(table(racine.assets, `${chemin}.assets`))) {
      verifierCles(table(a, `${chemin}.assets.${nom}`), "asset", `${chemin}.assets.${nom}`);
    }
  }

  return {
    id,
    pack: {
      title: texte(title, "product_name", `${chemin}.title`),
      logo: cheminPublic(texte(logo, "mark", `${chemin}.logo`)),
      wallpaper: cheminPublic(texte(fond, "file", `${chemin}.wallpapers[0]`)),
      pet,
      seed,
    },
  };
}

/** Charge tous les `themes/<id>/theme.toml`, indexés par id (le dossier doit porter le même nom que `id`). */
export async function chargerPacks(dossier: string = DOSSIER_THEMES): Promise<Record<string, ThemePack>> {
  const resultat: Record<string, ThemePack> = {};
  const noms = readdirSync(dossier, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => e.name)
    .sort();
  for (const nom of noms) {
    const fichier = `${dossier.replace(/[\\/]$/, "")}/${nom}/theme.toml`;
    const { id, pack } = convertirPack(Bun.TOML.parse(await Bun.file(fichier).text()), `${nom}/theme.toml`);
    if (id !== nom) throw new Error(`${nom}/theme.toml: id "${id}" différent du dossier`);
    resultat[id] = pack;
  }
  return resultat;
}

if (import.meta.main) {
  console.log(JSON.stringify(await chargerPacks(), null, 2));
}
