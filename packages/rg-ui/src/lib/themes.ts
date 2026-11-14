/**
 * Palette Rose Griffon — référence officielle.
 *
 * `icon` pointe vers un fichier de `public/emote/` : les quatre visuels
 * sont réutilisés entre les cinq thèmes. `RG_Reika_zukan.webp` est l'icône
 * zukan de Reika, la mascotte d'Azalée.
 */
import type { ThemeId } from "@rosegriffon/types/preferences";

import type { ThemeSeed } from "./color-engine";

export const THEMES = {
  roy: {
    name: "Roy",
    icon: "/emote/RG_Roy_salut.webp",
    colors: {
      primary: "#344E8C", // Bleu Roy
      secondary: "#243D5B", // Bleu foncé
      accent: "#FFC46E", // Doré
      background: "#F2F6F7", // Blanc
      text: "#373434", // Noir
    },
  },
  gaelle: {
    name: "Gaëlle",
    icon: "/emote/RG_Gaelle_salut.webp",
    colors: {
      primary: "#B03519", // Vermillon
      secondary: "#770007", // Rouge
      accent: "#FFC46E", // Doré
      background: "#F2F6F7", // Blanc
      text: "#373434", // Noir
    },
  },
  "azalee-light": {
    name: "Azalée clair",
    icon: "/emote/RG_Reika_zukan.webp",
    colors: {
      primary: "#F2A93B",
      secondary: "#A92335",
      accent: "#F2A93B",
      background: "#FFF8F5",
      text: "#241A15",
    },
  },
  "azalee-dark": {
    name: "Azalée",
    icon: "/emote/RG_Reika_zukan.webp",
    colors: {
      primary: "#FFC66C",
      secondary: "#FFB2BE",
      accent: "#FFDEA6",
      background: "#1A120D",
      text: "#EDE0DB",
    },
  },
  achillea: {
    name: "Achilléa",
    icon: "/achillea/logo1.svg",
    colors: {
      primary: "#6D00CE",
      secondary: "#DFFF57",
      accent: "#DFFF57",
      background: "#0D0814",
      text: "#F3EDF7",
    },
  },
} as const satisfies Record<
  ThemeId,
  {
    name: string;
    icon: string;
    colors: {
      primary: string;
      secondary: string;
      accent: string;
      background: string;
      text: string;
    };
  }
>;

export type ThemeType = ThemeId;

/**
 * Pack de thème : ce que le changement de thème remplace d'un coup, au-delà
 * des couleurs. Le chrome lit ce manifeste au lieu de chemins codés en dur.
 *
 * `seed` est la graine des couleurs calculées (teinte et chroma OKLCH,
 * mode clair ou sombre) ; les palettes écrites à la main des blocs CSS
 * migrent vers elle.
 */
export interface ThemePack {
  /** Nom de marque affiché dans la barre d'application. */
  title: string;
  logo: string;
  wallpaper: string;
  /** Compagnon du thème ; `null` tant qu'aucune mascotte n'existe. */
  pet: {
    name: string;
    emotes: { hello: string; proud?: string; surprised?: string };
  } | null;
  seed: ThemeSeed;
}

export const THEME_PACKS = {
  roy: {
    title: "Rose Griffon",
    logo: "/RG_Logo_V2.5.webp",
    wallpaper: "/roy_bg.webp",
    pet: {
      name: "Roy",
      emotes: {
        hello: "/emote/RG_Roy_salut.webp",
        proud: "/emote/RG_roy_fine.webp",
      },
    },
    seed: { hue: 265, chroma: 0.107, mode: "light" },
  },
  gaelle: {
    title: "Rose Griffon",
    logo: "/RG_Logo_V2.5.webp",
    wallpaper: "/gaelle_bg.webp",
    pet: {
      name: "Gaëlle",
      emotes: {
        hello: "/emote/RG_Gaelle_salut.webp",
        proud: "/emote/RG_Gaelle_fiere.webp",
        surprised: "/emote/RG_Gaelle_surprise.webp",
      },
    },
    seed: { hue: 34, chroma: 0.164, mode: "light" },
  },
  "azalee-light": {
    title: "Azalée",
    logo: "/RG_Azalee-logo.webp",
    wallpaper: "/azalee-bg.webp",
    pet: { name: "Reika", emotes: { hello: "/emote/RG_Reika_zukan.webp" } },
    seed: { hue: 73, chroma: 0.147, mode: "light" },
  },
  "azalee-dark": {
    title: "Azalée",
    logo: "/RG_Azalee-logo.webp",
    wallpaper: "/azalee_fond.webp",
    pet: { name: "Reika", emotes: { hello: "/emote/RG_Reika_zukan.webp" } },
    seed: { hue: 77, chroma: 0.126, mode: "dark" },
  },
  achillea: {
    title: "Achilléa",
    logo: "/achillea/logo1.svg",
    wallpaper: "/fond_achilea.webp",
    pet: null,
    // Charte legacy (achillea-web, preset PrimeNG) : violet #9039ff, or
    // #fbbf24 en accent, surfaces en gris neutres (#131313, #1e1e1e).
    seed: {
      hue: 297,
      chroma: 0.267,
      mode: "dark",
      secondary: { hue: 84, chroma: 0.164 },
      neutralChroma: 0,
    },
  },
} as const satisfies Record<ThemeId, ThemePack>;

/**
 * Thème imposé par une section du site (posé sur le conteneur, sans toucher
 * au choix enregistré de l'utilisateur). `undefined` : la section suit le
 * thème choisi.
 */
export function sectionTheme(
  section: "association" | "wiki" | "esport",
): ThemeId | undefined {
  if (section === "esport") return "achillea";
  if (section === "wiki") return "azalee-dark";
  return undefined;
}
