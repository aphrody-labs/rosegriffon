/**
 * Identifiants brandés (nominal typing) pour les données de jeu IEVR.
 *
 * Le schéma Supabase utilise massivement des hash CRC32 (`0xXXXXXXXX`) et des codes internes
 * (`c11010060`, `rhd10010`, `npc0202`) comme identifiants. Les branded types empêchent de mélanger
 * un `CharaParamId` avec un `SkillId` ou un `TeamId` — une erreur de compilation, pas un bug runtime.
 *
 * Aligné sur la vraie donnée (cf. `db.test.ts` qui valide des lignes réelles).
 */

import * as v from "valibot";

// ── Schémas Valibot (source unique : type dérivé via InferOutput) ────────────

/** Hash CRC32 hex `0xXXXXXXXX` (8 digits hex). Utilisé pour charaId/skillId/teamId/seriesId. */
export const Crc32Hex = v.pipe(
	v.string(),
	v.regex(/^0x[0-9A-Fa-f]{8}$/u, "hash CRC32 attendu (0x + 8 hex)"),
	v.brand("Crc32Hex"),
);
export type Crc32Hex = v.InferOutput<typeof Crc32Hex>;

/** Code interne LEVEL-5 (`c11010060`, `rhd10010`, `npc0202`, `n000201_10`…). */
export const InternalCode = v.pipe(
	v.string(),
	v.regex(/^[a-z]{1,4}[0-9][0-9a-z_]*$/u, "code interne LEVEL-5 attendu"),
	v.brand("InternalCode"),
);
export type InternalCode = v.InferOutput<typeof InternalCode>;

/**
 * Identifiant d'une ligne `inagle_*` : soit un hash hex (`0x...`), soit un code interne.
 * (La colonne `id` réelle prend les deux formes selon la table.)
 */
export const RowId = v.pipe(v.string(), v.minLength(1), v.brand("RowId"));
export type RowId = v.InferOutput<typeof RowId>;

// ── Alias sémantiques (même forme hex, marques distinctes) ────────────────────
// Note : valibot ne permet pas 2 marques différentes sur le même pipe sans 2 schémas ;
// on réutilise Crc32Hex pour la validation et on expose des alias de TYPE distincts pour
// l'intention (le compilateur les traite comme compatibles structurellement avec Crc32Hex,
// mais nommés différemment dans les signatures lisibles).

/** Hash du personnage de base (`chara_id`, `data.charaId`). */
export type CharaId = Crc32Hex & { readonly __role?: "CharaId" };
/** Hash du paramètre de carte (`id`, `data.charaParamId`). */
export type CharaParamId = Crc32Hex & { readonly __role?: "CharaParamId" };
/** Hash d'une compétence (`data.skills[].skillId`). */
export type SkillId = Crc32Hex & { readonly __role?: "SkillId" };
/** Hash d'une équipe (`data.teams[].id`). */
export type TeamId = Crc32Hex & { readonly __role?: "TeamId" };
/** Hash de série (`data.seriesId`). */
export type SeriesId = Crc32Hex & { readonly __role?: "SeriesId" };

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Valide+brande un hash CRC32 hex (throw si invalide). */
export const toCrc32Hex = (s: string): Crc32Hex => v.parse(Crc32Hex, s);

/** Vrai si la chaîne est un hash CRC32 hex valide. */
export const isCrc32Hex = (s: string): s is Crc32Hex => v.is(Crc32Hex, s);
