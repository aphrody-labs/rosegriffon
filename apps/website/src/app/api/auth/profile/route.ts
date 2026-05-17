import { type NextRequest, NextResponse } from "next/server";

import { getServerUser } from "@/lib/auth-helpers";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/auth/profile
 */
export async function GET() {
	try {
		const user = await getServerUser();
		if (!user) {
			return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
		}

		const supabase = await createClient();
		const { data: profile, error } = await supabase
			.from("profiles")
			.select("*")
			.eq("id", user.id)
			.single();

		if (error && error.code !== "PGRST116") throw error;

		return NextResponse.json({
			profile: profile || {
				id: user.id,
				displayName: user.name || "",
				bio: "",
			},
		});
	} catch (error) {
		console.error("Error fetching profile:", error);
		return NextResponse.json(
			{ error: "Erreur lors de la récupération du profil" },
			{ status: 500 },
		);
	}
}

/**
 * PUT /api/auth/profile
 */
export async function PUT(request: NextRequest) {
	try {
		const user = await getServerUser();
		if (!user) {
			return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
		}

		const body = await request.json();
		const { displayName, bio } = body ?? {};

		if (displayName !== undefined && typeof displayName !== "string") {
			return NextResponse.json({ error: "Données invalides" }, { status: 400 });
		}
		if (bio !== undefined && typeof bio !== "string") {
			return NextResponse.json({ error: "Données invalides" }, { status: 400 });
		}
		if (displayName && displayName.length > 100) {
			return NextResponse.json(
				{ error: "displayName trop long (max 100)" },
				{ status: 400 },
			);
		}
		if (bio && bio.length > 2000) {
			return NextResponse.json(
				{ error: "bio trop longue (max 2000)" },
				{ status: 400 },
			);
		}

		const supabase = await createClient();
		const { error: profileError } = await supabase.from("profiles").upsert(
			{
				id: user.id,
				full_name: displayName || user.name,
				bio: bio || "",
				updated_at: new Date().toISOString(),
			},
			{ onConflict: "id" },
		);

		if (profileError && profileError.code !== "42P01") {
			console.warn("Profile table error:", profileError);
		}

		return NextResponse.json({
			message: "Profil mis à jour avec succès",
			profile: { id: user.id, displayName: displayName || user.name, bio },
		});
	} catch (error) {
		console.error("Error updating profile:", error);
		return NextResponse.json(
			{ error: "Erreur lors de la mise à jour du profil" },
			{ status: 500 },
		);
	}
}
