/**
 * @achillea/core — Logique métier portable d'Achilléa.
 *
 * Multi-runtime : navigateur, edge (Deno/Web), Node, Bun. Aucune dépendance
 * Discord / MikroORM / DI / Node-only — uniquement des standards Web
 * (Web Crypto, `Intl`, `URL`, `TextEncoder`) + `@achillea/types`,
 * `@casl/ability`, `@sindresorhus/transliterate`.
 *
 * Importer par domaine via les sous-chemins (`@achillea/core/elo`, ...) ou
 * tout depuis la racine.
 */

export * from "./elo";
export * from "./ranking";
export * from "./sanctions";
export * from "./licenses";
export * from "./votes";
export * from "./names";
export * from "./format";
export * from "./access";
export * from "./validation";
export * from "./enums";
export * from "./league";
export * from "./tournaments";
