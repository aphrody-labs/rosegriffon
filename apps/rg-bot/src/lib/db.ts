/**
 * Couche DB du bot — Supabase first, raw SQL en transition.
 *
 * Nouvelle architecture (préférée pour tout nouveau code) :
 *   import { supabase } from "../lib/db.ts";
 *   const { data } = await supabase.from("profiles").select("...").eq(...);
 *
 * Le client Supabase service-role vient de `@rg/db/service` (partagé site + bot).
 * Bypass RLS. Ne JAMAIS exposer côté client (le bot tourne en Bun/serveur uniquement).
 *
 * ─── TODO migration Supabase ──────────────────────────────────────────────
 * Les services historiques (`services/admin.ts`, `services/website.ts`,
 * `services/syncMembers.ts`, `services/teamPhotos.ts`, `lib/audit.ts`,
 * `lib/rbac.ts`, `commands/staff.ts`, `scripts/smoke-admin.ts`) utilisent
 * encore `sql\`…\`` via Bun.SQL en direct sur la connexion Postgres Supabase
 * (DATABASE_URL = pooler URL Supabase, ex.
 *  postgresql://postgres.<ref>:<pwd>@aws-0-<region>.pooler.supabase.com:6543/postgres).
 *
 * À migrer progressivement vers `supabase.from(...).select()` / `.rpc()` une
 * fois `packages/db/src/types.gen.ts` regénéré (les types courants sont un
 * placeholder vide). Tant que la migration n'est pas complète, on garde
 * `Bun.SQL` pour ne pas casser la logique métier.
 */
import { SQL } from "bun";
import { createSupabaseServiceClient } from "@rg/db/service";

// ─── Supabase service client (préférer pour tout nouveau code) ─────────────
export const supabase = createSupabaseServiceClient();

// ─── Bun.SQL adapter sur la connexion Postgres Supabase (legacy services) ──
const databaseUrl = Bun.env.DATABASE_URL;
if (!databaseUrl) {
	throw new Error(
		"[bot/db] DATABASE_URL is required (Supabase Postgres pooler URL — voir .env.example)",
	);
}

export const sql = new SQL(databaseUrl);
