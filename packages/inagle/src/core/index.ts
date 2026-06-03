/**
 * Core utilities module
 *
 * Contains low-level tools for working with IEVR game data:
 * - parser: CFG.BIN file parsing
 * - search: Full-text search utilities
 * - gamedata: Raw gamedata JSON loader (453 lists, 66k+ entries)
 * - entities: Curated entity data loader (pre-extracted)
 * - hash: Hash computation and lookup utilities
 * - images: Image path resolution and indexing
 * - openapi: OpenAPI 3.1.0 spec generator from Zod schemas
 * - paths: Data file paths configuration
 * - config-parser: Raw cfg.bin.json parser
 * - data-loader: Central data loading with caching
 * - types: Complete TypeScript type definitions
 */

export { loadJsonAsync as loadJsonFileAsync, loadJsonStream, measureTime } from "./async-loader.ts";
export {
	type CharaBaseData,
	type CharaParamData,
	type ConfigFile,
	type ConfigNode,
	type ConfigVariable,
	extractVariables,
	getNodesByName,
	parseCharaBaseNode,
	parseCharaParamNode,
	parseFloatVar,
	parseIntVar,
	parseListVar,
	parseStringVar,
} from "./config-parser.ts";
export {
	clearCache,
	dataExists,
	fromHex,
	type GrowthTableEntry,
	getAvailableLocales,
	LOCALES,
	listJsonFiles,
	loadCharaBase,
	loadCharaDetails,
	loadCharaParam,
	loadCharaSeriesInfo,
	loadCharaText,
	loadCharaTextRoma,
	loadConfig,
	loadGamedata,
	loadGrowthTableMain,
	loadJSON,
	loadStarSignCharaInfo,
	sanitizeText,
	toHex,
} from "./data-loader.ts";
export * from "./entities.ts";
// Error handling
export {
	InagleError,
	InagleErrorCode,
	type InagleErrorCodeType,
	type InagleErrorDetails,
	inagleLogger,
	isInagleError,
	wrapError,
} from "./errors.ts";
export * from "./gamedata.ts";
export * from "./hash.ts";

export * from "./images.ts";
export * from "./openapi.ts";
export * from "./parser.ts";
// New architecture - explicit exports to avoid conflicts
export { DATA_ROOT, type DataFile, type DataPath, FILES, PATHS } from "./paths.ts";
export * from "./search.ts";

// Types with aliased names to avoid conflicts
export {
	type Basara as GameBasara,
	type BasaraBuild as GameBasaraBuild,
	type Character,
	type Character as GameCharacter,
	type CharacterStats as GameCharacterStats,
	type CharaParamRaw,
	type DataManifest,
	ElementId,
	ElementNames,
	type HeroVariants as GameHeroVariants,
	type Item as GameItem,
	type LocalizedNames as GameLocalizedNames,
	type MultiLevelStats,
	PositionId,
	PositionNames,
	RarityId,
	RarityNames,
	type RomanizedName,
	type Skill as GameSkill,
	type Team as GameTeam,
} from "./types.ts";
