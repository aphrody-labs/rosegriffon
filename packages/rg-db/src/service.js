// Client Supabase service-role (Bot Discord, scripts ops, Route Handlers privilégiés).
// Bypass RLS. Ne JAMAIS exposer côté client.
import { createClient } from "@supabase/supabase-js";
import { getSupabasePublishableKey, getSupabaseServiceRoleKey, getSupabaseUrl, isBuildPhase, } from "./env";
let cachedClient = null;
export function createSupabaseServiceClient() {
    if (cachedClient)
        return cachedClient;
    const url = getSupabaseUrl(true);
    const serviceKey = getSupabaseServiceRoleKey();
    const key = serviceKey ?? (isBuildPhase() ? getSupabasePublishableKey() : null);
    if (!key) {
        throw new Error("[@rose-griffon/db] Missing SUPABASE_SERVICE_ROLE_KEY");
    }
    cachedClient = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
    return cachedClient;
}
