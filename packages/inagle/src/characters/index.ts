/**
 * Characters module - Public API exports
 *
 * For internal/tooling use (CFG.BIN parsing), import directly:
 * - import { ... } from '@rose-griffon/inagle/characters/mapper.js'
 * - import { ... } from '@rose-griffon/inagle/characters/mapper-v3.js'
 */

// Primary API - uses pre-extracted JSON entities
export * from "./api.ts";
export * from "./comparison-engine.ts";

// Types used by the API
export type { CharacterDatabase, UnifiedCharacter, UnifiedCharacterVariant } from "./types.ts";
