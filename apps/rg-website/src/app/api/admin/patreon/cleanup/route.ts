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
			{ error: "no admin client", ok: false },
			{ status: 500 },
		);
	}
	let body: Body = {};
	try {
		body = (await req.json()) as Body;
	} catch {
		// Body optional
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
			{ error: error.message, ok: false },
			{ status: 500 },
		);
	}

	const expiredCount = await archiveExpiredTokens(supabase);

	return NextResponse.json({
		archivedTokens: expiredCount,
		count: data?.length ?? 0,
		ok: true,
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
