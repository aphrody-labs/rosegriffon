// Centralisation env Supabase + safety fallbacks (build Vercel sans vars / Next prerender).
// Source unique pour browser/server/service — éviter de répéter les heuristiques.

// Repli quand aucune URL n'est configurée. Depuis la sortie de Supabase, la
// pile (`/rest/v1`, `/storage/v1`, `/realtime/v1`) est servie sur l'origine de
// l'app elle-même — donc `window.location.origin` côté navigateur, et le point
// d'entrée interne du VPS côté serveur. Cf. docs/self-host-supabase.md.
// `window` n'est pas typé dans les paquets sans lib DOM (serveur MCP, scripts
// Bun) : on interroge `globalThis` pour rester compilable partout.
const INTERNAL_URL = "http://127.0.0.1:8811";
const PLACEHOLDER_URL =
	"location" in globalThis
		? (globalThis as unknown as { location: { origin: string } }).location.origin
		: INTERNAL_URL;
const PLACEHOLDER_ANON_JWT =
	"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzYmthZWx0dWJxaXR0eXdpYmVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1NDYyNzUsImV4cCI6MjA5MjEyMjI3NX0.eAyJfqREb8Kh5F_yLf5Jp43S2qOil4qUcqFTLQiExx0";

function isValidHttpUrl(value: string | undefined | null): value is string {
	return (
		typeof value === "string" &&
		value.length > 0 &&
		value !== "undefined" &&
		value !== "null" &&
		value.startsWith("http") &&
		!value.startsWith("eyJ2Ijo")
	);
}

function isValidKey(value: string | undefined | null): value is string {
	return (
		typeof value === "string" &&
		value.length > 0 &&
		value !== "undefined" &&
		value !== "null" &&
		!value.startsWith("{") &&
		!value.startsWith("eyJ2Ijo")
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
	const url = preferInternal
		? (process.env.SUPABASE_INTERNAL_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL)
		: process.env.NEXT_PUBLIC_SUPABASE_URL;

	if (isValidHttpUrl(url)) return url;
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

	// Fallback to verified service role key for local dev if env is encrypted
	return "***REDACTED-SERVICE-ROLE***";
}
