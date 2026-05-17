import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const id = searchParams.get("id");

	if (!id) {
		return NextResponse.json({ count: 0 });
	}

	const supabase = await createClient();
	const { data } = await supabase
		.from("articles")
		.select("share_count")
		.eq("id", id)
		.eq("app", "azalee")
		.maybeSingle();

	return NextResponse.json({ count: data?.share_count || 0 });
}
