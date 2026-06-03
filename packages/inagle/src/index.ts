/**
 * @file index.ts
 * @description Universal Game Data API for Inazuma Eleven: Victory Road
 * @module @/lib/inagle
 */

// Re-export types
export { createInagleAppAsync, type InagleApp } from "./adapters/hono.ts";

// Domain APIs
export {
	type BasaraAPI,
	type BasaraBuild,
	type BasaraCharacter,
	type BasaraDatabase,
	type BasaraIcons,
	type BasaraIndexes,
	type BasaraStats,
	buildBasaraDatabase,
	createBasaraAPI,
	type Element,
	type EnrichedBasara,
	type HeroVariants,
	POSITION_MAP,
	type Position,
} from "./basara/index.ts";

// Characters API
export {
	buildCharactersDatabase,
	type CharacterDetail,
	type CharacterIdMapping,
	type CharacterNametag,
	type CharacterStarSign as CharacterStarSignRarity,
	type CharactersAPI,
	type CharactersDatabase,
	createCharactersAPI,
	type EnrichedCharacter,
	PERSONALITY_NAMES,
	RARITY_NAMES,
} from "./characters/api.ts";
export * from "./characters/comparison-engine.ts";

// Constellation
export { type ConstellationAPI, createConstellationAPI } from "./constellation/index.ts";
// Exporters
export * from "./core/exporters.ts";

// Core exports
export {
	DATA_ROOT,
	ElementId,
	ElementNames,
	FILES,
	fromHex,
	InagleError,
	InagleErrorCode,
	measureTime,
	PATHS,
	PositionId,
	PositionNames,
	RarityId,
	RarityNames,
	toHex,
} from "./core/index.ts";
// Core types for base characters with variants
export type {
	BaseCharacter,
	Character,
	CharacterStats as GameCharacterStats,
	CharacterVariant,
	MultiLevelStats,
} from "./core/types.ts";
export * from "./drops/index.ts";
// New entity builders
export {
	type BaseCharacterStats,
	buildCharacter,
	type CharacterFilter,
	type CharacterStatsSummary,
	getCharacterByParamId,
	getCharacterStats,
	loadAllCharacters,
	loadBaseCharacters,
	loadFilteredCharacters,
	preloadCharacterEnrichment,
} from "./entities/character.ts";
export * from "./menu/index.ts";
export * from "./rag/index.ts";
// APIs
export * from "./service.ts";

// Stat Calculator
export * from "./analysis/index.ts";
export * from "./stat-calculator.ts";
export * from "./zukan/index.ts";

// === AZALEE COMPATIBILITY LAYER ===

export type { ItemsAPI, ItemsDatabase } from "./items/api.ts";
export { buildItemsDatabaseAsync, createItemsAPIAsync } from "./items/api.ts";
// Items
export type { ItemCategory, ParsedItem as Item } from "./parsers/item-config.ts";
// Global Search
export {
	createGlobalSearch,
	type GlobalSearchAPI,
	type GlobalSearchResult,
	type SearchableType,
	type SearchConfig,
} from "./search/index.ts";
// Skills
export type {
	EnrichedAuraSkill as Aura,
	EnrichedPassiveSkill as Passive,
	EnrichedSkill as Skill,
	SkillsAPI,
	SkillsDatabase,
	SkillType,
	TeamPassive,
} from "./skills/api.ts";
export {
	buildSkillsDatabase,
	CATEGORY_NAMES,
	createSkillsAPI,
	ELEMENT_NAMES,
	PASSIVE_BOOST_NAMES,
	PASSIVE_SCOPE_NAMES,
} from "./skills/api.ts";
// Teams & Formations
export type {
	EnrichedFormation as Formation,
	EnrichedTeam as Team,
	TeamsAPI,
	TeamsDatabase,
} from "./teams/api.ts";
export { buildTeamsDatabase, createTeamsAPI } from "./teams/api.ts";

// Romaji & Transliteration
export { initRomaji, toRomaji, toRomajiTitleCase, toKana } from "./utils/romaji.ts";
