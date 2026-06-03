/**
 * Schema exports for @rose-griffon/inagle
 *
 * All schemas are based on actual CFG.BIN JSON structures from IEVR dump:
 * - dump/data/common/gamedata/ (13924 JSON files)
 * - dump/data/common/text/ (6090 JSON files)
 *
 * Total: 20040 JSON files analyzed
 */

// Core CFG.BIN formats
export * from "./cfgbin.ts";
// Domain-specific schemas
export * from "./character.ts";
export * from "./skill.ts";
export * from "./soccer.ts";
// Localized text structures
export * from "./text.ts";

// Zod 4 schemas (runtime validation + TypeScript inference)
export * from "./zod.ts";
