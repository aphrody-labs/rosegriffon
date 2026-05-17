/**
 * Liste des streamers Rose Griffon TV
 * Données centralisées pour faciliter la maintenance
 */

export interface Streamer {
  readonly name: string;
  readonly file: string;
  readonly slug: string;
  readonly fullName?: string;
}

export const STREAMERS: readonly Streamer[] = [
  {
    name: "Bri",
    file: "bri.webp",
    slug: "bri",
    fullName: "Bri",
  },
  {
    name: "Éthan",
    file: "ethan.webp",
    slug: "ethan",
    fullName: "Éthan",
  },
  {
    name: "Huzby",
    file: "huzby.webp",
    slug: "huzby",
    fullName: "Huzby",
  },
  {
    name: "Ishido",
    file: "ishido.webp",
    slug: "ishido",
    fullName: "Ishido",
  },
  {
    name: "Mathuze",
    file: "mathuze.webp",
    slug: "mathuze",
    fullName: "Mathuze",
  },
  {
    name: "Shozuma",
    file: "shozuma.webp",
    slug: "shozuma",
    fullName: "Shozuma",
  },
] as const;

export const STREAMERS_COUNT = STREAMERS.length;
