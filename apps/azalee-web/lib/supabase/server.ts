import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { mintSupabaseJwt } from "@/lib/supabase/jwt";
import type { Database } from "@rosegriffon/db";

const getEnv = (key: string, fallback: string) => {
  const val = process.env[key];
  if (!val || val === "" || val.startsWith("{")) return fallback;
  return val;
};

const supabaseUrl = getEnv("SUPABASE_INTERNAL_URL", getEnv("NEXT_PUBLIC_SUPABASE_URL", "https://isbkaeltubqittywibeh.supabase.co"));
const supabaseAnonKey = getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzYmthZWx0dWJxaXR0eXdpYmVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwNjk0MzAsImV4cCI6MjA2MTY0NTQzMH0.N4l07k3V_X5I8iW0n_D6K9-O4v5l7l6s6MYGpJIXRW_rB8zc45k7chqi8Ljl_CLiLc=");

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
