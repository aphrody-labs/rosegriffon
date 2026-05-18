import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
	const checks: Record<string, "ok" | "error"> = {};
	let dbError: string | undefined;

	try {
		const supabase = await createClient();
		// Une réponse (data ou error de niveau RLS) = DB joignable.
		// Seul un throw (réseau/init) compte comme indisponibilité.
		const result = await supabase.from("profiles").select("id").limit(1);
		checks.db = "ok";
		if (result.error) {
			dbError = result.error.message;
		}
	} catch (e) {
		checks.db = "error";
		dbError = e instanceof Error ? e.message : String(e);
	}

	const allOk = Object.values(checks).every((v) => v === "ok");

	return NextResponse.json(
		{
			status: allOk ? "ok" : "degraded",
			checks,
			...(dbError ? { dbNote: dbError } : {}),
			uptime: process.uptime(),
		},
		{ status: allOk ? 200 : 503 },
	);
}
