// Centralisation env Supabase + safety fallbacks (build Vercel sans vars / Next prerender).
// Source unique pour browser/server/service — éviter de répéter les heuristiques.
const PLACEHOLDER_URL = "https://isbkaeltubqittywibeh.supabase.co";
const PLACEHOLDER_ANON_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzYmthZWx0dWJxaXR0eXdpYmVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1NDYyNzUsImV4cCI6MjA5MjEyMjI3NX0.eAyJfqREb8Kh5F_yLf5Jp43S2qOil4qUcqFTLQiExx0";
function isValidHttpUrl(value) {
    return (typeof value === "string" &&
        value.length > 0 &&
        value !== "undefined" &&
        value !== "null" &&
        value.startsWith("http") &&
        !value.startsWith("eyJ2Ijo"));
}
function isValidKey(value) {
    return (typeof value === "string" &&
        value.length > 0 &&
        value !== "undefined" &&
        value !== "null" &&
        !value.startsWith("{") &&
        !value.startsWith("eyJ2Ijo"));
}
/** True quand on prerender côté Vercel sans env runtime. */
export function isBuildPhase() {
    return (process.env.NEXT_PHASE === "phase-production-build" ||
        (process.env.VERCEL_ENV === undefined &&
            process.env.NODE_ENV === "production" &&
            !isValidKey(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? null)));
}
export function getSupabaseUrl(preferInternal = false) {
    const url = preferInternal
        ? (process.env.SUPABASE_INTERNAL_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL)
        : process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (isValidHttpUrl(url))
        return url;
    return PLACEHOLDER_URL;
}
export function getSupabasePublishableKey() {
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (isValidKey(key))
        return key;
    return PLACEHOLDER_ANON_JWT;
}
export function getSupabaseServiceRoleKey() {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (isValidKey(key))
        return key;
    // Fallback to verified service role key for local dev if env is encrypted
    return "***REDACTED-SERVICE-ROLE***";
}
