import { createClient } from "@supabase/supabase-js";

// We can define Database type here or import it if we share types package.
// For now, let's use 'any' or a minimal interface if needed, but 'any' is fine for internal tool.
// If types are available, good. The website had them in '@rose-griffon/types'.
// I'll skip strict typing for DB for now to speed up, or copy the type file if needed.

export function getSupabaseClient() {
	const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

	if (!supabaseUrl || !supabaseServiceKey) {
		throw new Error("Missing Supabase environment variables");
	}

	return createClient(supabaseUrl, supabaseServiceKey);
}
