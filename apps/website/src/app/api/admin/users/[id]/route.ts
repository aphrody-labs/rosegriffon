import { type NextRequest, NextResponse } from "next/server";

import { requireApiAdmin } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/server";

const VALID_ROLES = new Set(["admin", "staff", "user", "premium", "banned"]);

export async function PUT(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const auth = await requireApiAdmin();
	if (!auth.ok) return auth.response;

	try {
		const { id } = await params;
		const body = await request.json();
		const { role, full_name, email_notifications } = body ?? {};

		if (role !== undefined && !VALID_ROLES.has(role)) {
			return NextResponse.json(
				{ success: false, error: "Rôle invalide" },
				{ status: 400 },
			);
		}
		if (full_name !== undefined && typeof full_name !== "string") {
			return NextResponse.json(
				{ success: false, error: "full_name invalide" },
				{ status: 400 },
			);
		}
		if (full_name && full_name.length > 200) {
			return NextResponse.json(
				{ success: false, error: "full_name trop long" },
				{ status: 400 },
			);
		}
		if (
			email_notifications !== undefined &&
			typeof email_notifications !== "boolean"
		) {
			return NextResponse.json(
				{ success: false, error: "email_notifications invalide" },
				{ status: 400 },
			);
		}

		const supabase = createAdminClient();
		if (!supabase) {
			return NextResponse.json(
				{ error: "Service indisponible" },
				{ status: 503 },
			);
		}

		const { data: user, error } = await supabase
			.from("profiles")
			.update({
				...(role !== undefined && { role }),
				...(full_name !== undefined && { full_name }),
				...(email_notifications !== undefined && { email_notifications }),
				updated_at: new Date().toISOString(),
			})
			.eq("id", id)
			.select()
			.single();

		if (error || !user) {
			return NextResponse.json(
				{ success: false, error: "Utilisateur non trouvé" },
				{ status: 404 },
			);
		}

		return NextResponse.json({
			success: true,
			message: "Utilisateur modifié avec succès",
			data: user,
		});
	} catch (error) {
		console.error("Erreur PUT utilisateur:", error);
		return NextResponse.json(
			{
				success: false,
				error: "Erreur lors de la modification de l'utilisateur",
			},
			{ status: 500 },
		);
	}
}

export async function DELETE(
	_request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const auth = await requireApiAdmin();
	if (!auth.ok) return auth.response;

	try {
		const { id } = await params;
		const supabase = createAdminClient();
		if (!supabase) {
			return NextResponse.json(
				{ error: "Service indisponible" },
				{ status: 503 },
			);
		}

		const { data: user, error } = await supabase
			.from("profiles")
			.update({
				role: "banned",
				updated_at: new Date().toISOString(),
			})
			.eq("id", id)
			.select()
			.single();

		if (error || !user) {
			return NextResponse.json(
				{ success: false, error: "Utilisateur non trouvé" },
				{ status: 404 },
			);
		}

		return NextResponse.json({
			success: true,
			message: "Utilisateur désactivé",
		});
	} catch (error) {
		console.error("Erreur DELETE utilisateur:", error);
		return NextResponse.json(
			{
				success: false,
				error: "Erreur lors de la désactivation de l'utilisateur",
			},
			{ status: 500 },
		);
	}
}
