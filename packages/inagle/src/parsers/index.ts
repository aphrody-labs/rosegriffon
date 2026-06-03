// @ts-nocheck
/**
 * @file parsers/index.ts
 * @description Parser module exports for raw game data
 */

// Team and series parser
export {
	type BelongTeamInfo as RawBelongTeamInfo,
	buildSeriesMapping,
	buildTeamMapping,
	type CharaSeriesInfo,
	getAllSeries,
	getAllTeams,
	getSeriesById,
	getTeamById,
	getTeamsBySeason,
	SEASON_NAMES,
	SERIES_TYPE,
	type Season,
	type Series,
	searchTeams,
	type Team,
} from "./belong-team.ts";
// Binary format parsers
export {
	buildHashTable,
	CFGBIN_MAGIC,
	type CfgBinDocument as BinaryCfgBinDocument,
	type CfgBinEntry as BinaryCfgBinEntry,
	type CfgBinHeader as BinaryCfgBinHeader,
	type CfgBinInfo,
	getCfgBinInfo,
	hasValidFooter,
	parseCfgBin,
	parseHeader as parseCfgBinHeader,
	resolveNames,
	toJson as cfgBinToJson,
	VariableType as BinaryCfgBinVariableType,
} from "./binary/cfgbin-parser.ts";
export {
	convertNxtchToDds,
	DDS_MAGIC,
	G4TX_MAGIC,
	type G4txEntry,
	type G4txHeader,
	type G4txInfo,
	type G4txSubEntry,
	type G4txSubTexture,
	type G4txTexture,
	getFormatName,
	getG4txInfo,
	isG4tx,
	type NxtchHeader,
	NxtchTextureFormat,
	parseHeader as parseG4txHeader,
	parseNxtchHeader,
	parseTextures,
} from "./binary/g4tx-parser.ts";
// Boost player group parser
export {
	type BoostPlayerGroupConfig,
	type BoostPlayerGroupDatabase,
	type BoostSpiritTableEntry,
	buildBoostPlayerGroupDatabase,
	loadBoostPlayerGroupConfigAsync,
} from "./boost-player-group-config.ts";
// Capsule (gacha) parser
export {
	buildCapsuleDatabase,
	type CapsuleConfigInfo,
	type CapsuleDatabase,
	type CapsuleLotRankRate,
	type CapsulePrizeInfo,
	type CapsulePrizeTable,
	type CapsuleWeaponColorEntry,
	loadCapsuleConfigAsync,
} from "./capsule-config.ts";
// Change Aura Skill parser
export {
	buildChangeAuraSkillDatabase,
	type ChangeAuraSkillData,
	type ChangeAuraSkillDatabase,
	type ChangeAuraSkillInfo,
	loadChangeAuraSkillConfigAsync,
} from "./change-aura-skill-config.ts";
// Character base parser
export {
	buildCharaBaseMap,
	buildCodeToBaseMap,
	buildNameHashToBaseMap,
	type ParsedCharaBase,
	parseAllCharaBase,
} from "./chara-base.ts";
// Character costume parser
export {
	buildCharaCostumeDatabase,
	type CharaCostume,
	type CharaCostumeDatabase,
	loadCharaCostumeConfigAsync,
} from "./chara-costume-config.ts";
// Character description parser
export {
	buildAllDescriptionMaps,
	type DescriptionMaps,
	getDescription,
	loadCharaDescriptions,
	type ParsedDescription,
} from "./chara-description.ts";
// Character EXP table parser
export {
	buildCharaExpTableDatabase,
	type CharaExpEntry,
	type CharaExpTableDatabase,
	type ExpRarityRate,
	loadCharaExpTableAsync,
} from "./chara-exp-table.ts";
// Character param parser
export {
	buildCharaBaseToParamsMap,
	buildCharaParamMap,
	elementIdToNames,
	type ParsedCharaParam,
	parseAllCharaParams,
	positionIdToCode,
	rarityCodeToName,
} from "./chara-param.ts";
// Character text parser
export {
	buildAllNameMaps,
	buildNameMap,
	buildRomanizedMap,
	getLocalizedNames,
	type LocalizedCharaNames,
	type ParsedNoun,
	type ParsedRomanizedName,
} from "./chara-text.ts";
// Constellation parser (Players Universe star signs)
export {
	buildConstellationMapping,
	type Constellation,
	type ConstellationMapping,
	clearConstellationCache,
	getAllConstellations,
	getCharacterIdsInConstellation,
	getConstellationByIndex,
	getConstellationByName,
	getConstellationForCharacter,
	type StarInfo,
	type StarSignRarityRateInfo,
} from "./constellation.ts";
// Controllable character parser
export {
	buildCtrlCharaDatabase,
	type CtrlCharaData,
	type CtrlCharaDatabase,
	loadCtrlCharaConfigAsync,
} from "./ctrl-chara-config.ts";
// Dictionary parser
export {
	buildDictionaryDatabase,
	type DictionaryDatabase,
	type DictionaryHabitat,
	type DictionaryObservation,
	loadDictionaryConfigAsync,
} from "./dictionary-config.ts";
// Enjoy mode team parser
export {
	buildEnjoyModeTeamDatabase,
	type EnjoyModeTeamDatabase,
	loadEnjoyModeTeamConfigAsync,
	type ParsedEnjoyModeTeam,
} from "./enjoy-mode-team-config.ts";
// Extended story parser
export {
	buildExtendStoryDatabase,
	type ExtendStoryData,
	type ExtendStoryDatabase,
	type ExtendStoryGameData,
	loadExtendStoryConfigAsync,
} from "./extend-story-config.ts";
// Formation parser
export { buildFormationDatabase, type ParsedFormation } from "./formation-config.ts";
// Gallery parser
export {
	buildGalleryDatabase,
	type GalleryDatabase,
	loadGalleryConfigAsync,
	type ParsedGallery,
} from "./gallery-config.ts";
// Gameplay parser (Events, Craft, Routes)
export {
	buildCraftDatabase,
	buildEventDatabase,
	buildVsRouteDatabase,
	type ParsedCraft,
	type ParsedEvent,
	type ParsedVsRoute,
} from "./gameplay-config.ts";
// Growth table parser
export {
	buildGrowthTableDatabase,
	type GrowthTableDatabase,
	type GrowthTableLv1,
	type GrowthTableLv30,
	type GrowthTableMain,
	type GrowthTableSub,
	loadGrowthTableConfigAsync,
} from "./growth-table-config.ts";
// Hash utilities - renamed to avoid conflicts with core/crc32
export { crc32 as binaryCrc32, crc32Hex as binaryCrc32Hex } from "./hash/crc32.ts";
// Help parser
export { buildHelpDatabase, type ParsedHelp } from "./help-config.ts";
// Inacode parser
export {
	buildInacodeDatabase,
	type InacodeDatabase,
	type InacodeStamp,
	loadInacodeConfigAsync,
} from "./inacode-config.ts";
// Item config parser
export {
	buildItemDatabase,
	buildItemDatabaseAsync,
	type ItemCategory,
	loadFashionItemMappingAsync,
	loadItemConfig,
	type ParsedItem,
} from "./item-config.ts";
// Mission parser
export { buildMissionDatabase, type ParsedMission } from "./mission-config.ts";
// Music parser
export { buildMusicDatabase, type ParsedMusic } from "./music-config.ts";
// NFC lottery parser
export {
	buildNfcLotteryDatabase,
	loadNfcLotteryConfigAsync,
	type NfcLottery,
	type NfcLotteryDatabase,
	type NfcLotteryItem,
	type NfcLotteryTable,
} from "./nfc-lottery-config.ts";
// Opponent team parser
export {
	buildOpponentTeamDatabase,
	loadOpponentTeamConfigAsync,
	type MatchDifficultyInfo,
	type OpponentTeamDatabase,
	type ParsedOpponentTeam,
	type PracticeMatchInfo,
} from "./opponent-team-config.ts";
// Override Skill parser (DLC Orion)
export {
	buildOverrideSkillDatabase,
	loadOverrideSkillConfigAsync,
	type OverrideConditionInfo,
	type OverrideConditionSkillInfo,
	type OverrideSkillDatabase,
	type OverrideSkillInfo,
	type ResolvedOverride,
} from "./override-skill-config.ts";
// Passive Skill parser
export {
	buildPassiveDatabase,
	buildPassiveDatabaseAsync,
	type ParsedPassive,
} from "./passive-skill-config.ts";
// Passive skill effect parser
export {
	buildPassiveSkillEffectDatabase,
	loadPassiveSkillEffectConfigAsync,
	type PassiveSkillEffect,
	type PassiveSkillEffectDatabase,
	type PassiveSkillEffectRange,
} from "./passive-skill-effect-config.ts";
// Playstyle parser (chara_param T2B[5])
export {
	buildPlaystyleMap,
	type PlaystyleEntry,
	parseAllPlaystyles,
	playstyleIdToEn,
	playstyleIdToFr,
} from "./playstyle.ts";
// Post/Delivery parser
export { buildPostDatabase, type ParsedDelivery, type ParsedPassword } from "./post-config.ts";
// Quest parser
export {
	buildQuestDatabase,
	loadQuestConfig,
	type ParsedQuest,
	QuestType,
} from "./quest-config.ts";
// Real skill parser
export {
	buildRealSkillDatabase,
	loadRealSkillConfigAsync,
	type RealSkillDatabase,
	type RealSkillInfo,
	type RealSkillShootCourse,
} from "./real-skill-config.ts";
// Shop parser
export { loadShopConfig, type ShopInfo, type ShopItem } from "./shop-config.ts";
// Skill parser
export { buildSkillDatabase, buildSkillDatabaseAsync, type ParsedSkill } from "./skill-config.ts";
// Skill technic parser
export {
	buildSkillTechnicDatabase,
	loadSkillTechnicConfigAsync,
	type SkillTechnicDatabase,
	type SkillTechnicInfo,
} from "./skill-technic-config.ts";
// Special Tactics parser (DLC Orion - Tactiques Speciales)
export {
	buildSpecialTacticsDatabase,
	type ParsedSpecialTactic,
	type SpecialTacticsCondId,
	type SpecialTacticsDatabase,
	type SpecialTacticsEffect,
} from "./special-tactics-config.ts";
// Super tactics base parser (pre-DLC)
export {
	buildSuperTacticsBaseDatabase,
	loadSuperTacticsBaseConfigAsync,
	type SuperTacticsBaseDatabase,
	type SuperTacticsBaseEffect,
	type SuperTacticsBaseInfo,
} from "./super-tactics-base-config.ts";
// System/Menu parser
export { buildMenuDatabase, type ParsedMenuInfo } from "./system-config.ts";
// Team Build parser (DLC Orion)
export {
	buildTeamBuildDatabase,
	loadTeamBuildConfigAsync,
	type TeamBuildDatabase,
	type TeamBuildEffectData,
	type TeamBuildEffectInfo,
	type TeamBuildInfo,
	type TeamBuildModifierData,
} from "./team-build-config.ts";
// Generic text parser for all text files
export {
	buildTextDatabase,
	buildTextMaps,
	type GameTextType,
	getLocalizedText,
	type LocalizedTextMaps,
	loadTextFile,
	loadTextFileAsync,
	loadTextListAsync,
	type TextDatabase,
} from "./text-parser.ts";
// Trick parser
export {
	buildTrickDatabase,
	loadTrickConfigAsync,
	type ParsedTrick,
	type TrickDatabase,
} from "./trick-config.ts";
// Trophy parser
export { buildTrophyDatabase, type ParsedTrophy } from "./trophy-config.ts";
// Uniform parser
export {
	buildUniformDatabase,
	loadUniformConfigAsync,
	type UniformDatabase,
	type UniformInfo,
	type UniformModelInfo,
} from "./uniform-config.ts";
// Universal gamedata parser - auto-discovers ALL gamedata files
export {
	buildUniversalGamedataDatabase,
	createUniversalGamedataAPI,
	discoverAllGamedata,
	discoverCategoryFiles,
	discoverGamedataCategories,
	type EntityExtractorConfig,
	extractEntities,
	type GamedataFileInfo,
	type LoadedGamedata,
	loadFromDatabase,
	loadGamedataFile,
	type ParsedEntry,
	type UniversalGamedataAPI,
	type UniversalGamedataDatabase,
} from "./universal-gamedata.ts";
// Universal text parser - auto-discovers ALL text files
export {
	buildUniversalTextDatabase,
	createUniversalTextAPI,
	discoverTextFiles,
	loadTextFileRaw,
	loadUniversalText,
	type TextFileInfo,
	type UniversalTextAPI,
	type UniversalTextDatabase,
} from "./universal-text.ts";

// Additional config parsers
export {
	buildActivityPhotoDatabase,
	type ActivityPhotoDatabase,
	type ParsedTrophyReward,
} from "./activity-photo-config.ts";
export {
	buildChatEmoteDatabase,
	type ChatEmoteDatabase,
	type ParsedChatEmote,
} from "./chat-emote-config.ts";
export {
	buildNameplateDatabase,
	type NameplateDatabase,
	type ParsedNameplate,
} from "./nameplate-config.ts";
export {
	buildPerformanceDatabase,
	type PerformanceDatabase,
	type ParsedPerformance,
} from "./performance-config.ts";
export {
	buildPhaseTitleDatabase,
	type PhaseTitleDatabase,
	type ParsedPhaseTitle,
} from "./phase-title-config.ts";
export {
	buildSceneArchiveDatabase,
	type SceneArchiveDatabase,
	type ParsedSceneArchive,
} from "./scene-archive-config.ts";
export {
	buildStadiumDatabase,
	type StadiumDatabase,
	type ParsedStadium,
} from "./stadium-config.ts";
export {
	buildCharaMenuResourceDatabase,
	type ParsedCharaResource,
} from "./chara-menu-resource-config.ts";

// Story text parser (dialogues, map NPCs, goals, phases)
export {
	buildStoryTextDatabase,
	parseAllEventDialogues,
	parseAllMapNpcDialogues,
	parseAllStoryGoals,
	parseAllChapterPhases,
	type StoryEvent,
	type StoryDialogueLine,
	type ResolvedSpeaker,
	type MapNpcDialogue,
	type StoryGoal,
	type ChapterPhase,
} from "./story-text-parser.ts";



