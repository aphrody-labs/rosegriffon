/**
 * Enhanced Zukan Types for Rose Griffon API
 * Based on zukan.inazuma.jp (Inazugle)
 */

export type ZukanElementType = "Wind" | "Forest" | "Fire" | "Mountain" | "Void" | "Unknown";
export type ZukanPositionType = "GK" | "DF" | "MF" | "FW";
export type ZukanGenderType = "Male" | "Female" | "Unknown" | "Neutral";
export type ZukanSchoolYearType = "Grade 7" | "Grade 8" | "Grade 9" | "Unknown";
export type ZukanCharacterRole = "Player" | "Coordinator" | "Manager" | "Coach";

/** 9 game keys matching the zukan appeared-works columns (order matters) */
export const GAME_KEYS = ["ie1", "ie2", "ie3", "go1", "go2", "go3", "ars", "ori", "vic"] as const;
export type GameKey = (typeof GAME_KEYS)[number];

/** Map game key → Azalee series name */
export const GAME_TO_SERIES: Record<GameKey, string> = {
  ie1: "Inazuma Eleven",
  ie2: "Inazuma Eleven 2",
  ie3: "Inazuma Eleven 3",
  go1: "Inazuma Eleven GO",
  go2: "Chrono Stone",
  go3: "Galaxy",
  ars: "Ares",
  ori: "Orion",
  vic: "Victory Road",
};

export interface ZukanCharacter {
  id: string; // Internal Zukan ID (e.g., from data-chara-id)
  modelId?: string; // Canonical 3D model ID (e.g., c01000010)
  name: string;
  nickname: string | null;
  image: string | null;
  detailUrl: string | null;
  zukanHash?: string;
  zukanOrder?: number;

  // Attributes
  rarity: string | null; // Grade/Rank
  position: ZukanPositionType | null;
  element: ZukanElementType | null;
  gender: ZukanGenderType | null;
  schoolYear: string | null;
  ageGroup?: string | null;
  team: string | null;
  role: ZukanCharacterRole | null;
  description?: string;
  howToObtain?: string;

  /** Games in which this character appears (○ on the zukan grid) */
  gameAppearances?: GameKey[];

  // Stats (Parsed from chara_param)
  stats?: {
    kick: number;
    control: number;
    technique: number;
    pressure: number;
    physical: number;
    agility: number;
    intelligence: number;
  };

  // Move Set
  moves?: {
    name: string;
    type: string;
    description?: string;
    power?: number;
    cost?: number;
  }[];
}

export interface ZukanSkill {
  id: string;
  name: string;
  type: string; // e.g. "Shoot", "Dribble", "Block", "Catch"
  description?: string;
  element: ZukanElementType | null;
  videoUrl: string | null;
  posterUrl: string | null;
  thumbnailUrl: string | null;
}

export interface ZukanItem {
  id: string; // generated from hash or name
  name: string;
  category: string; // 'shoes', 'bracelet', 'pendant', 'special', 'uniform', 'emblem'
  description?: string;
  imageUrl: string | null;
}

export interface ZukanFormation {
  id: string; // generated from hash or name
  name: string;
  positions: { left: string; top: string }[];
}

export interface ZukanTeam {
  id: string;
  name: string;
  emblemUrl: string | null;
}
