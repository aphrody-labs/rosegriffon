// Placeholder ultra-permissif — sera écrasé par `bun run types:gen` quand SUPABASE_ACCESS_TOKEN dispo.
// Pour générer : `cd packages/db && SUPABASE_ACCESS_TOKEN=… bun run types:gen`
//
// Trade-off assumé pendant la migration : zéro check au type-level sur les queries Supabase.
// Cela évite que les ~100 call sites (websit + azalee) cassent au type-check.
// Re-générer dès que possible pour récupérer le type-safety table par table.

/* eslint-disable @typescript-eslint/no-explicit-any */

export type Json =
	| string
	| number
	| boolean
	| null
	| { [key: string]: Json | undefined }
	| Json[];

export type Database = any;

export type Tables<_T extends string = string> = any;
export type TablesInsert<_T extends string = string> = any;
export type TablesUpdate<_T extends string = string> = any;
export type Enums<_T extends string = string> = any;
