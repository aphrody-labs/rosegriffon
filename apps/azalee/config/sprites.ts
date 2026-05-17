export type SpriteCategory = "role" | "element" | "rarity" | "class";

export interface SpriteCoords {
	x: number;
	y: number;
	w: number;
	h: number;
}

// Main spritesheet for role icons
export const SPRITE_SHEET_SRC = "/icon_common2.webp";

// Class/position icons spritesheet (73x73 grid) — servi via CDN local depuis 2026-05.
export const CLASS_SPRITE_SHEET_SRC =
	"https://cdn.rosegriffon.fr/static/azalee/menu/200_icon/06_icon_class/icon_class_s.webp";
export const CLASS_SPRITE_SIZE = 73;

export const SPRITES = {
	// Size indicators
	"size-l-standard": { x: 20, y: 20, w: 80, h: 80 },
	"size-s-standard": { x: 340, y: 20, w: 80, h: 80 },
	"size-m-standard": { x: 20, y: 180, w: 80, h: 80 },

	// Role badges - Glow variant (for active/selected)
	"role-att-glow": { x: 580, y: 20, w: 180, h: 70 },
	"role-mil-glow": { x: 580, y: 150, w: 180, h: 70 },
	"role-def-glow": { x: 570, y: 300, w: 180, h: 70 },
	"role-gar-glow": { x: 790, y: 300, w: 190, h: 70 },

	// Role badges - Solid variant
	"role-att-solid": { x: 550, y: 610, w: 210, h: 80 },
	"role-mil-solid": { x: 270, y: 630, w: 190, h: 70 },
	"role-def-solid": { x: 0, y: 630, w: 210, h: 80 },
	"role-gar-solid": { x: 460, y: 900, w: 190, h: 60 },

	// Role badges - Grey variant (for inactive/disabled)
	"role-att-grey": { x: 780, y: 460, w: 200, h: 70 },
	"role-mil-grey": { x: 780, y: 610, w: 190, h: 70 },
	"role-def-grey": { x: 500, y: 750, w: 200, h: 70 },
	"role-gar-grey": { x: 570, y: 460, w: 190, h: 70 },
	"role-gar-grey-2": { x: 720, y: 750, w: 200, h: 70 },

	// Role badges - Flat variant
	"role-att-flat": { x: 220, y: 770, w: 200, h: 90 },
	"role-mil-flat": { x: 0, y: 790, w: 200, h: 90 },
	"role-def-flat": { x: 220, y: 880, w: 200, h: 90 },
	"role-tout-flat": { x: 790, y: 10, w: 160, h: 90 },

	// Role badges - Simple (small)
	"role-att-tag": { x: 790, y: 150, w: 120, h: 50 },
	"role-gar-simple": { x: 0, y: 920, w: 120, h: 50 },
	"role-mil-simple": { x: 670, y: 880, w: 120, h: 50 },
	"role-def-simple": { x: 810, y: 880, w: 130, h: 50 },
} as const;

// Class icons from icon_class_s.webp (73x73 grid, 8 columns)
// These are position/class indicator icons
export const CLASS_SPRITES = {
	// Row 0 - Main class icons (blue glow)
	"class-forward": { x: 0, y: 0, w: 73, h: 73 }, // Éclair bleu - Attaquant
	"class-defender": { x: 73, y: 0, w: 73, h: 73 }, // Triangle violet - Défenseur
	"class-goalkeeper": { x: 146, y: 0, w: 73, h: 73 }, // Ballon planète - Gardien

	// Row 2 - Additional icons
	"class-wings": { x: 0, y: 146, w: 73, h: 73 }, // Ailes blanches
	"class-midfielder": { x: 73, y: 146, w: 73, h: 73 }, // Étoile dorée - Milieu
	"class-support": { x: 146, y: 146, w: 73, h: 73 }, // Haltère violet - Support

	// Row 3 - More icons
	"class-speed": { x: 0, y: 219, w: 73, h: 73 }, // Lune blanche - Vitesse
	"class-star": { x: 73, y: 219, w: 73, h: 73 }, // Étoile dorée
	"class-power": { x: 146, y: 219, w: 73, h: 73 }, // Ballon rouge - Puissance
} as const;

export type SpriteKey = keyof typeof SPRITES;
