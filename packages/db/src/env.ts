// Centralisation env Supabase + safety fallbacks (build Vercel sans vars / Next prerender).
// Source unique pour browser/server/service — éviter de répéter les heuristiques.

const PLACEHOLDER_URL = "https://isbkaeltubqittywibeh.supabase.co";
const PLACEHOLDER_ANON_JWT =
	"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzYmthZWx0dWJxaXR0eXdpYmVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwNjk0MzAsImV4cCI6MjA2MTY0NTQzMH0.N4l07k3V_X5I8iW0n_D6K9-O4v5l7l6s6MYGpJIXRW_rB8zc45k7chqi8Ljl_CLiLc";

function isValidHttpUrl(value: string | undefined | null): value is string {
	return (
		typeof value === "string" &&
		value.length > 0 &&
		value !== "undefined" &&
		value !== "null" &&
		value.startsWith("http")
	);
}

function isValidKey(value: string | undefined | null): value is string {
	return (
		typeof value === "string" &&
		value.length > 0 &&
		value !== "undefined" &&
		value !== "null" &&
		!value.startsWith("{")
	);
}

/** True quand on prerender côté Vercel sans env runtime. */
export function isBuildPhase(): boolean {
	return (
		process.env.NEXT_PHASE === "phase-production-build" ||
		(process.env.VERCEL_ENV === undefined &&
			process.env.NODE_ENV === "production" &&
			!isValidKey(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? null))
	);
}

export function getSupabaseUrl(preferInternal = false): string {
	const internal = process.env.SUPABASE_INTERNAL_URL;
	const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
	if (preferInternal && isValidHttpUrl(internal)) return internal;
	if (isValidHttpUrl(publicUrl)) return publicUrl;
	if (isValidHttpUrl(internal)) return internal;
	return PLACEHOLDER_URL;
}

export function getSupabasePublishableKey(): string {
	const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
	if (isValidKey(key)) return key;
	return PLACEHOLDER_ANON_JWT;
}

export function getSupabaseServiceRoleKey(): string | null {
	const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
	if (isValidKey(key)) return key;
	return null;
}
