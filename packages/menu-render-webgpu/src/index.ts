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
} from "./renderer.js";
export type { DrawItem, FontAtlasConfig } from "./renderer.js";

export {
	decodeFontMetrics,
	parseFontMetrics,
	layoutText,
	measureText,
	glyphUV,
	sjisCodeToUnicode,
	computeOutlinePixel,
	OUTLINE_OFFSETS,
} from "./glyph-atlas.js";
export type {
	Glyph,
	GlyphAtlas,
	GlyphQuad,
	GlyphUV,
	AtlasInfo,
	TextLayout,
	RawFontMetrics,
	Rgba,
} from "./glyph-atlas.js";

export { blendForDrawType, projectOrtho, DRAW_TYPES } from "./blend.js";
export type { BlendState, BlendComponent } from "./blend.js";

export { renderTextBitmap, textCacheKey } from "./text-atlas.js";
export type { TextBitmap } from "./text-atlas.js";

export { GameMenuGpu, shouldUseWebGpu } from "./game-menu-gpu.js";
export type { GameMenuGpuProps } from "./game-menu-gpu.js";

// Ré-export du contrat (provenant de @rose-griffon/menu-render) pour confort.
export type {
	MenuLayout,
	MenuObject,
	MenuObjectOverride,
	MenuTransform,
	MenuSprite,
	MenuText,
} from "@rose-griffon/menu-render";
