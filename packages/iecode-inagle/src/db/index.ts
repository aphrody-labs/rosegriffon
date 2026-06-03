/**
 * `@rose-griffon/iecode-inagle` — typage strict des tables `inagle_*` (Supabase Postgres), aligné sur la donnée
 * réelle de la prod rosegriffon.
 *
 * Trois couches :
 *   - {@link ./ids.ts} identifiants brandés (CRC32 hex, codes internes) — pas de mélange d'ID ;
 *   - {@link ./enums.ts} enums dérivés des valeurs distinctes RÉELLES (picklist Valibot) ;
 *   - {@link ./jsonb.ts} schémas Valibot des colonnes JSONB (`data`/`sheet_data`/`skills`) ;
 *   - {@link ./tables.ts} vues composites typées (scalaires + JSONB).
 *
 * Garantie d'alignement : `db.test.ts` valide des lignes RÉELLES (fixtures Supabase) contre ces
 * schémas — toute dérive de structure casse le test.
 */

export * from "./ids";
export * from "./enums";
export * from "./jsonb";
export * from "./tables";
