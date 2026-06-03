/**
 * Schéma Valibot du `CfgBinDocument` (sortie de `decodeCfgBin`) — source unique : le schéma
 * dérive un validateur ET un type (`v.InferOutput`) alignés sur l'arbre décodé.
 *
 * Couvre les deux formats LEVEL-5 : **T2B** (records arborescents, footer `01 74 32 62`) et
 * **RDBN** (tables homotypées). Validé sur de VRAIS fichiers `*.cfg.bin` par `schema.test.ts`
 * (décode puis `v.parse` chaque document — T2B + RDBN, 9 kinds de valeur).
 *
 * « Type par nom de config » : {@link cfgConfigName} normalise le nom de fichier
 * (`shop_config_3.00.22.cfg.bin` → `shop_config`) pour indexer un document par config.
 */

import * as v from "valibot";

// ── Valeur typée ───────────────────────────────────────────────────────────────

/** Catégories sémantiques d'une valeur (≡ `CfgBinValueKind` de generic.ts). */
export const CfgBinValueKind = v.picklist([
	"string",
	"int",
	"float",
	"hash",
	"bool",
	"short",
	"byte",
	"tuple",
	"blob",
	"unknown",
]);
export type CfgBinValueKind = v.InferOutput<typeof CfgBinValueKind>;

/** Valeur d'un champ : string | number | boolean | number[] | null (selon `kind`). */
export const CfgBinValue = v.object({
	name: v.string(),
	kind: CfgBinValueKind,
	value: v.union([v.string(), v.number(), v.boolean(), v.array(v.number()), v.null()]),
});
export type CfgBinValue = v.InferOutput<typeof CfgBinValue>;

// ── Record (récursif en T2B) ───────────────────────────────────────────────────

/** Record T2B (arbre) ou ligne RDBN (plat). `children` toujours vide en RDBN. */
export type CfgBinRecord = {
	readonly name: string;
	readonly fields: readonly CfgBinValue[];
	readonly children: readonly CfgBinRecord[];
};

export const CfgBinRecord: v.GenericSchema<CfgBinRecord> = v.object({
	name: v.string(),
	fields: v.array(CfgBinValue),
	children: v.array(v.lazy(() => CfgBinRecord)),
});

// ── Table RDBN ─────────────────────────────────────────────────────────────────

/** Table RDBN : liste de records homotypés. */
export const CfgBinTable = v.object({
	name: v.string(),
	typeName: v.string(),
	rows: v.array(CfgBinRecord),
});
export type CfgBinTable = v.InferOutput<typeof CfgBinTable>;

// ── Document ───────────────────────────────────────────────────────────────────

/** Document cfg.bin décodé (T2B → `records` ; RDBN → `tables`). */
export const CfgBinDocument = v.object({
	format: v.picklist(["T2B", "RDBN"]),
	encoding: v.string(),
	records: v.array(CfgBinRecord),
	tables: v.array(CfgBinTable),
});
export type CfgBinDocument = v.InferOutput<typeof CfgBinDocument>;

// ── « Type par nom de config » ─────────────────────────────────────────────────

/**
 * Normalise un nom de fichier cfg.bin en clé de config stable, sans extension ni numéro de
 * version : `shop_config_3.00.22.cfg.bin` → `shop_config`, `nfc_lottery_config.cfg.bin`
 * → `nfc_lottery_config`. Sert de clé pour indexer/typer un document par config.
 */
export function cfgConfigName(fileName: string): string {
	const base = (fileName.split(/[\\/]/u).at(-1) ?? fileName).replace(/\.cfg\.bin$/iu, "");
	// Retire un suffixe de version `_X.YY.ZZ[.WW]` ou `_dbg` final.
	return base.replace(/_(?:\d+(?:\.\d+)+|dbg)$/iu, "");
}

/**
 * Document cfg.bin étiqueté par sa config — la « variante par nom de config » demandée :
 * `{ config: "shop_config", document: CfgBinDocument }`.
 */
export const NamedCfgBinDocument = v.object({
	config: v.string(),
	document: CfgBinDocument,
});
export type NamedCfgBinDocument = v.InferOutput<typeof NamedCfgBinDocument>;
