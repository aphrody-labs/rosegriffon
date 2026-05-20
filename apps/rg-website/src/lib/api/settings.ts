import {
	createPublicClient,
	createClient as createServerClient,
} from "@/lib/supabase/server";

export const FEATURE_SHOW_DISCORD_EVENTS = "feature_show_discord_events";

interface SupabaseLike {
	from: (table: string) => {
		select: (cols: string) => {
			eq: (
				col: string,
				val: string,
			) => {
				single: () => Promise<{
					data: { value: unknown } | null;
					error: unknown;
				}>;
			};
		};
	};
}

/**
 * Fetch a global setting value (cookies-aware client — bascule la page en dynamic).
 */
export async function getSetting<T = unknown>(
	key: string,
	defaultValue: T,
): Promise<T> {
	try {
		const supabase = (await createServerClient()) as unknown as SupabaseLike;
		return await fetchSetting(supabase, key, defaultValue);
	} catch (error) {
		console.warn(`Error fetching setting ${key}:`, error);
		return defaultValue;
	}
}

/**
 * Fetch a public setting value sans cookies — laisse Next statifier la page (ISR/SSG).
 * À utiliser sur les pages publiques (home, marketing) où aucune donnée user n'est lue.
 */
export async function getPublicSetting<T = unknown>(
	key: string,
	defaultValue: T,
): Promise<T> {
	try {
		return await fetchSetting(
			createPublicClient() as unknown as SupabaseLike,
			key,
			defaultValue,
		);
	} catch (error) {
		console.warn(`Error fetching public setting ${key}:`, error);
		return defaultValue;
	}
}

async function fetchSetting<T>(
	supabase: SupabaseLike,
	key: string,
	defaultValue: T,
): Promise<T> {
	const { data, error } = await supabase
		.from("settings")
		.select("value")
		.eq("key", key)
		.single();

	if (error || !data) {
		return defaultValue;
	}

	const {value} = data;

	if (typeof defaultValue === "boolean" && typeof value === "string") {
		if (value === "true") {return true as unknown as T;}
		if (value === "false") {return false as unknown as T;}
	}

	return value as T;
}
