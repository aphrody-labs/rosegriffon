/**
 * `@rose-griffon/inagle-cross` — API de données d'Inazuma Eleven Cross.
 *
 * Jeu mobile Unity IL2CPP (`jp.co.level5.inazumacross`), DISTINCT d'Inazuma
 * Eleven: Victory Road (`@rose-griffon/inagle`). Ce package fournit le schéma
 * masterdata typé (extrait du dump IL2CPP), les enums, et — en Phase 1 — les
 * pushers vers `public.inagle_cross_*` (réutilisant `@rose-griffon/inagle/push-adapter`).
 *
 * Phase 0 (présent) : schéma + enums + DDL figés (valeurs de jeu non encore
 * récupérables — serveur sous anti-triche). Phase 1 : parsers de bundles Unity
 * + import des lignes masterdata une fois `{AssetBaseUri}` débloqué.
 */
import enums from "../data/enums.json";
import schema from "../data/masterdata-schema.json";
import type { CrossEnums, CrossSchema } from "./schemas/types";

export type {
	CrossColumn,
	CrossColumnKind,
	CrossEnumMember,
	CrossEnums,
	CrossSchema,
	CrossTable,
} from "./schemas/types";
export { crossTableName } from "./schemas/types";

/** Le schéma masterdata complet (153 tables). */
export const crossSchema = schema as unknown as CrossSchema;

/** Les énumérations du jeu (214). */
export const crossEnums = enums as unknown as CrossEnums;
