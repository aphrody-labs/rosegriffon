import { resolve } from "node:path";
import { GlobalFonts } from "@aphrody-code/canvas";

import { RG_BRAND_HEX } from "../config";

const WEBSITE_FONTS = resolve(
	import.meta.dir,
	"../../../../website/public/fonts",
);

let fontsLoaded = false;
export function ensureFonts(): void {
	if (fontsLoaded) return;
	try {
		GlobalFonts.registerFromPath(
			`${WEBSITE_FONTS}/Super Cartoon.ttf`,
			"SuperCartoon",
		);
		GlobalFonts.registerFromPath(
			`${WEBSITE_FONTS}/DEFAULT_BradBunR.ttf`,
			"BradBunR",
		);
		GlobalFonts.registerFromPath(
			`${WEBSITE_FONTS}/Autre police/aklatan.ttf`,
			"Aklatan",
		);
	} catch (err) {
		console.warn("[canvas] font registration failed:", err);
	}
	fontsLoaded = true;
}

export const RG_THEME = {
	// Brand colors (extracted from globals.css)
	brand: RG_BRAND_HEX,
	brandDark: "#8a3f35",
	brandLight: "#c46d61",

	// Surface
	background: "#fdfcfa",
	card: "#ffffff",
	cardBorder: "#e8e3dc",
	surfaceMuted: "#f4efe9",

	// Text
	fg: "#1a1a1a",
	fgMuted: "#5a5a5a",
	fgInverse: "#ffffff",

	// Accents (also used for tags)
	gaelle: "#2f6e9c",
	azaleeYellow: "#fecd50",
	azaleePink: "#c83c51",

	// Sizing
	radiusSm: 8,
	radiusMd: 16,
	radiusLg: 24,

	// Fonts
	fontTitle: "SuperCartoon",
	fontBody: "BradBunR, sans-serif",
	fontFallback: "sans-serif",
} as const;
