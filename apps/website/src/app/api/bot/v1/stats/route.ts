import { type NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/server";
import { assertBotAuth } from "../_lib";
import { getDashboardStats } from "@rose-griffon/db";

// Cache 30s côté Next.js
export const revalidate = 30;
export const dynamic = "force-dynamic";

/**
 * GET /api/bot/v1/stats — aggregated dashboard counts.
 */
export async function GET(request: NextRequest) {
	const denied = assertBotAuth(request);
	if (denied) return denied;

	const supabase = createAdminClient();
	if (!supabase) {
		return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
	}

	try {
		// @ts-ignore - bypassing strict generic check for migration
		const stats = await getDashboardStats(supabase);
		return NextResponse.json(stats, {
			status: 200,
			headers: {
				"cache-control": "private, max-age=30, s-maxage=30",
			},
		});
	} catch (err) {
		return NextResponse.json(
			{ error: err instanceof Error ? err.message : "Failed to fetch stats" },
			{ status: 500 },
		);
	}
}
