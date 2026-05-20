import { NextResponse } from "next/server";

import { requireApiAdmin } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
	const auth = await requireApiAdmin();
	if (!auth.ok) {return auth.response;}

	try {
		const supabase = createAdminClient();
		if (!supabase) {
			return NextResponse.json(
				{ error: "Service indisponible" },
				{ status: 503 },
			);
		}

		const url = new URL(req.url);
		const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
		const limitRaw = Number(url.searchParams.get("limit")) || 50;
		const limit = Math.max(1, Math.min(limitRaw, 200));
		const from = (page - 1) * limit;
		const to = from + limit - 1;

		const {
			data: users,
			error,
			count,
		} = await supabase
			.from("profiles")
			.select("id,email,full_name,role,discord_id,created_at,updated_at", {
				count: "exact",
			})
			.order("created_at", { ascending: false })
			.range(from, to);

		if (error) {throw error;}

		return NextResponse.json({
			data: users ?? [],
			pagination: {
				limit,
				page,
				total: count ?? 0,
				totalPages: count ? Math.ceil(count / limit) : 1,
			},
			success: true,
		});
	} catch (error) {
		console.error("Erreur GET utilisateurs:", error);
		return NextResponse.json(
			{ error: "Erreur lors du chargement des utilisateurs", success: false },
			{ status: 500 },
		);
	}
}
