import { NextResponse } from "next/server";

import { requirePatreonCreator } from "@/lib/auth-helpers";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

interface Body {
	daysSincePending?: number;
}

export async function POST(req: Request) {
	await requirePatreonCreator();
	const supabase = createAdminClient();
	if (!supabase) {
		return NextResponse.json(
			{ ok: false, error: "no admin client" },
			{ status: 500 },
		);
	}
	let body: Body = {};
	try {
		body = (await req.json()) as Body;
	} catch {
		// body optional
	}
	const days = Math.max(1, Math.floor(body.daysSincePending ?? 90));
	const cutoff = new Date(
		Date.now() - days * 24 * 60 * 60 * 1000,
	).toISOString();

	const { data, error } = await supabase
		.from("patreon_legacy_members")
		.update({ rg_subscription_status: "churned" })
		.eq("rg_subscription_status", "pending")
		.lte("imported_at", cutoff)
		.select("patreon_member_id");

	if (error) {
		console.error("[admin/patreon/cleanup]", error);
		return NextResponse.json(
			{ ok: false, error: error.message },
			{ status: 500 },
		);
	}

	const expiredCount = await archiveExpiredTokens(supabase);

	return NextResponse.json({
		ok: true,
		count: data?.length ?? 0,
		archivedTokens: expiredCount,
	});
}

async function archiveExpiredTokens(
	supabase: NonNullable<ReturnType<typeof createAdminClient>>,
): Promise<number> {
	const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
	const { data, error } = await supabase
		.from("patreon_oauth_tokens")
		.delete()
		.eq("is_creator", false)
		.lte("expires_at", cutoff)
		.select("id");
	if (error) {
		console.error("[admin/patreon/cleanup] archive tokens", error);
		return 0;
	}
	return data?.length ?? 0;
}
