import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { mintSupabaseJwt } from "@/lib/supabase/jwt";
import type { Database } from "@rose-griffon/db";

const supabaseUrl = process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Skip the Better Auth -> Supabase JWT bridge when the local SUPABASE_JWT_SECRET
// is desynchronized from Supabase Cloud (minted JWTs rejected with PGRST301).
// Lectures publiques via anon + GRANT SELECT sur schema public (appliqué 2026-04-20).
// Défaut: true. Pour réactiver le bridge après avoir resyncé le secret: DISABLE_SUPABASE_JWT_BRIDGE=false.
const DISABLE_SUPABASE_JWT_BRIDGE = process.env.DISABLE_SUPABASE_JWT_BRIDGE !== "false";

/**
 * Creates a Supabase server client.
 * If a Better Auth session exists AND the JWT bridge is enabled, mints a JWT so
 * auth.uid() works in RLS. Otherwise returns an anon client.
 */
export const createClient = async () => {
  let accessToken: string | undefined;

  if (!DISABLE_SUPABASE_JWT_BRIDGE) {
    try {
      const reqHeaders = await headers();
      const session = await auth.api.getSession({ headers: reqHeaders });

      if (session?.user?.id) {
        accessToken = mintSupabaseJwt(session.user.id);
      }
    } catch {
      // No session or headers not available — use anon client
    }
  }

  if (accessToken) {
    return createSupabaseClient<Database>(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });
  }

  return createSupabaseClient<Database>(supabaseUrl, supabaseAnonKey);
};
