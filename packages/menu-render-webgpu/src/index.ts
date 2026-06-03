// Renderer WebGPU 2D pixel-perfect du menu IEVR + wrapper React avec fallback DOM.

export {
	WebGpuMenuRenderer,
	buildDrawList,
	buildGlyphInstances,
	hexToRgba01,
	FLOATS_PER_GLYPH,
	assetUrl,
	parseHexColor,
	computeLetterbox,
	CANVAS_SIZE,
} from "./renderer.ts";
export type { DrawItem, FontAtlasConfig } from "./renderer.ts";

export {
	decodeFontMetrics,
	parseFontMetrics,
	layoutText,
	measureText,
	glyphUV,
	sjisCodeToUnicode,
	computeOutlinePixel,
	OUTLINE_OFFSETS,
} from "./glyph-atlas.ts";
export type {
	Glyph,
	GlyphAtlas,
	GlyphQuad,
	GlyphUV,
	AtlasInfo,
	TextLayout,
	RawFontMetrics,
	Rgba,
} from "./glyph-atlas.ts";

export { blendForDrawType, projectOrtho, DRAW_TYPES } from "./blend.ts";
export type { BlendState, BlendComponent } from "./blend.ts";

export { renderTextBitmap, textCacheKey } from "./text-atlas.ts";
export type { TextBitmap } from "./text-atlas.ts";

export { GameMenuGpu, shouldUseWebGpu } from "./game-menu-gpu.tsx";
export type { GameMenuGpuProps } from "./game-menu-gpu.tsx";

// Ré-export du contrat (provenant de @rose-griffon/menu-render) pour confort.
export type {
	MenuLayout,
	MenuObject,
	MenuObjectOverride,
	MenuTransform,
	MenuSprite,
	MenuText,
} from "@rose-griffon/menu-render";
