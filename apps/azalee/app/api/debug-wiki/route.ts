// DEBUG ONLY — endpoint pour tracer pourquoi /chara retourne 0 résultats
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
	const debug: Record<string, unknown> = {
		now: new Date().toISOString(),
		env: {
			SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 60),
			SUPABASE_INTERNAL_URL: process.env.SUPABASE_INTERNAL_URL?.slice(0, 60),
			ANON_KEY_LEN: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length,
			ANON_KEY_START: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.slice(0, 25),
			JWT_BRIDGE_DISABLED: process.env.DISABLE_SUPABASE_JWT_BRIDGE,
		},
	};

	try {
		const supabase = await createClient();
		// Simple count
		const countResult = await supabase
			.from("inagle_characters")
			.select("id", { count: "exact", head: true });
		debug.totalCount = countResult.count;
		debug.countError = countResult.error?.message;

		// Sample 3
		const sample = await supabase
			.from("inagle_characters")
			.select("id, name_en, name_fr, internal_code")
			.limit(3);
		debug.sampleData = sample.data;
		debug.sampleError = sample.error?.message;

		// Filtered like the wiki query
		const filtered = await supabase
			.from("inagle_characters")
			.select("id", { count: "exact", head: true })
			.not("internal_code", "like", "%_5000")
			.not("internal_code", "like", "c05028%")
			.not("name_en", "like", "%×%")
			.not("internal_code", "like", "an%")
			.not("name_en", "is", null)
			.neq("name_en", "")
			.neq("rarity_label", "Héros")
			.neq("rarity_label", "BASARA");
		debug.filteredCount = filtered.count;
		debug.filteredError = filtered.error?.message;

		debug.ok = true;
	} catch (e) {
		debug.ok = false;
		debug.error = e instanceof Error ? e.message : String(e);
	}

	return NextResponse.json(debug, { status: 200 });
}
