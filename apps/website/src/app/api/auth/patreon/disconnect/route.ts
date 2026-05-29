import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth-helpers";
import { createAdminClient } from "@/lib/supabase/server";

export async function POST() {
	const user = await requireAuth();
	const supabase = createAdminClient();
	if (!supabase) {
		return NextResponse.json({ error: "no_admin_client" }, { status: 500 });
	}

	const { error } = await supabase.from("patreon_oauth_tokens").delete().eq("user_id", user.id);

	if (error) {
		console.error("[patreon/disconnect] delete failed", error);
		return NextResponse.json({ error: "delete_failed" }, { status: 500 });
	}
	return NextResponse.json({ ok: true });
}
