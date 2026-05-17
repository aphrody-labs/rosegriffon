import type { CSSProperties } from "react";

export type SpriteRoleVariant = "glow" | "solid" | "grey" | "flat" | "tag" | "simple" | "default";
export type SpriteCategory = "size" | "role";
export type SpriteValue = "l" | "m" | "s" | "att" | "mil" | "def" | "gar" | "tout";

export interface SpriteItem {
  id: string;
  label: string;
  category: SpriteCategory;
  value: SpriteValue;
  variant: SpriteRoleVariant;
  coords: { x: number; y: number; w: number; h: number };
}

export const ROLES_SPRITE_SOURCE = "/icon_common2.webp";

/**
 * Configuration for icon_common2.webp
 * Coordinates are exact pixel values from the spritesheet.
 */
export const ROLES_MAP: Record<string, SpriteItem> = {
  // --- SIZES ---
  "size-l-default": {
    id: "size-l-default",
    label: "Large",
    category: "size",
    value: "l",
    variant: "default",
    coords: { x: 20, y: 20, w: 80, h: 80 },
  },
  "size-m-default": {
    id: "size-m-default",
    label: "Medium",
    category: "size",
    value: "m",
    variant: "default",
    coords: { x: 20, y: 180, w: 80, h: 80 },
  },
  "size-s-default": {
    id: "size-s-default",
    label: "Small",
    category: "size",
    value: "s",
    variant: "default",
    coords: { x: 340, y: 20, w: 80, h: 80 },
  },

  // --- ROLE: GLOW (Neon effect) ---
  "role-att-glow": {
    id: "role-att-glow",
    label: "Attaquant (Glow)",
    category: "role",
    value: "att",
    variant: "glow",
    coords: { x: 580, y: 20, w: 180, h: 70 },
  },
  "role-mil-glow": {
    id: "role-mil-glow",
    label: "Milieu (Glow)",
    category: "role",
    value: "mil",
    variant: "glow",
    coords: { x: 580, y: 150, w: 180, h: 70 },
  },
  "role-def-glow": {
    id: "role-def-glow",
    label: "Défenseur (Glow)",
    category: "role",
    value: "def",
    variant: "glow",
    coords: { x: 570, y: 300, w: 180, h: 70 },
  },
  "role-gar-glow": {
    id: "role-gar-glow",
    label: "Gardien (Glow)",
    category: "role",
    value: "gar",
    variant: "glow",
    coords: { x: 790, y: 300, w: 190, h: 70 },
  },

  // --- ROLE: SOLID (Bold color with outline) ---
  "role-att-solid": {
    id: "role-att-solid",
    label: "Attaquant (Solid)",
    category: "role",
    value: "att",
    variant: "solid",
    coords: { x: 550, y: 610, w: 210, h: 80 },
  },
  "role-mil-solid": {
    id: "role-mil-solid",
    label: "Milieu (Solid)",
    category: "role",
    value: "mil",
    variant: "solid",
    coords: { x: 270, y: 630, w: 190, h: 70 },
  },
  "role-def-solid": {
    id: "role-def-solid",
    label: "Défenseur (Solid)",
    category: "role",
    value: "def",
    variant: "solid",
    coords: { x: 0, y: 630, w: 210, h: 80 },
  },
  "role-gar-solid": {
    id: "role-gar-solid",
    label: "Gardien (Solid)",
    category: "role",
    value: "gar",
    variant: "solid",
    coords: { x: 460, y: 900, w: 190, h: 60 },
  },

  // --- ROLE: GREY (Inactive/Outline) ---
  "role-att-grey": {
    id: "role-att-grey",
    label: "Attaquant (Grey)",
    category: "role",
    value: "att",
    variant: "grey",
    coords: { x: 780, y: 460, w: 200, h: 70 },
  },
  "role-mil-grey": {
    id: "role-mil-grey",
    label: "Milieu (Grey)",
    category: "role",
    value: "mil",
    variant: "grey",
    coords: { x: 780, y: 610, w: 190, h: 70 },
  },
  "role-def-grey": {
    id: "role-def-grey",
    label: "Défenseur (Grey)",
    category: "role",
    value: "def",
    variant: "grey",
    coords: { x: 500, y: 750, w: 200, h: 70 },
  },
  "role-gar-grey": {
    id: "role-gar-grey",
    label: "Gardien (Grey)",
    category: "role",
    value: "gar",
    variant: "grey",
    coords: { x: 570, y: 460, w: 190, h: 70 },
  },
  "role-gar-grey-2": {
    id: "role-gar-grey-2",
    label: "Gardien (Grey 2)",
    category: "role",
    value: "gar",
    variant: "grey",
    coords: { x: 720, y: 750, w: 200, h: 70 },
  },

  // --- ROLE: FLAT (Colored Box) ---
  "role-att-flat": {
    id: "role-att-flat",
    label: "Attaquant (Flat)",
    category: "role",
    value: "att",
    variant: "flat",
    coords: { x: 220, y: 770, w: 200, h: 90 },
  },
  "role-mil-flat": {
    id: "role-mil-flat",
    label: "Milieu (Flat)",
    category: "role",
    value: "mil",
    variant: "flat",
    coords: { x: 0, y: 790, w: 200, h: 90 },
  },
  "role-def-flat": {
    id: "role-def-flat",
    label: "Défenseur (Flat)",
    category: "role",
    value: "def",
    variant: "flat",
    coords: { x: 220, y: 880, w: 200, h: 90 },
  },
  "role-tout-flat": {
    id: "role-tout-flat",
    label: "Tout (Flat)",
    category: "role",
    value: "tout",
    variant: "flat",
    coords: { x: 790, y: 10, w: 160, h: 90 },
  },

  // --- ROLE: TAG (Small pill) ---
  "role-att-tag": {
    id: "role-att-tag",
    label: "Attaquant (Tag)",
    category: "role",
    value: "att",
    variant: "tag",
    coords: { x: 790, y: 150, w: 120, h: 50 },
  },

  // --- ROLE: SIMPLE (Text only/Minimal) ---
  "role-mil-simple": {
    id: "role-mil-simple",
    label: "Milieu (Simple)",
    category: "role",
    value: "mil",
    variant: "simple",
    coords: { x: 670, y: 880, w: 120, h: 50 },
  },
  "role-def-simple": {
    id: "role-def-simple",
    label: "Défenseur (Simple)",
    category: "role",
    value: "def",
    variant: "simple",
    coords: { x: 810, y: 880, w: 130, h: 50 },
  },
  "role-gar-simple": {
    id: "role-gar-simple",
    label: "Gardien (Simple)",
    category: "role",
    value: "gar",
    variant: "simple",
    coords: { x: 0, y: 920, w: 120, h: 50 },
  },
};

/**
 * Helper to generate CSS style for a specific sprite item
 */
export function getSpriteStyle(id: string): CSSProperties {
  const item = ROLES_MAP[id];
  if (!item) return {};

  return {
    backgroundImage: `url(${ROLES_SPRITE_SOURCE})`,
    backgroundPosition: `-${item.coords.x}px -${item.coords.y}px`,
    width: `${item.coords.w}px`,
    height: `${item.coords.h}px`,
    display: "inline-block",
    backgroundRepeat: "no-repeat",
  };
}
