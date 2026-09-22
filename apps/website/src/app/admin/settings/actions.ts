"use server";

import { revalidatePath } from "next/cache";
import { createPostgresClient } from "@rosegriffon/db/service";
import { logAdminAction } from "@/lib/admin-logger";
import { getServerUser } from "@/lib/auth-helpers";

export async function updateSetting(
	key: string,
	value: unknown, // Changed to unknown to avoid any lint error
	description?: string
) {
	const supabase = createPostgresClient();

	// 1. Vérification du rôle Admin
	const user = await getServerUser();

	if (!user) {
		return { message: "Erreur : Non authentifié" };
	}

	const { data: profile } = await supabase
		.from("profiles")
		.select("role")
		.eq("id", user.id)
		.single();

	if (profile?.role !== "admin") {
		return { message: "Erreur : Non autorisé" };
	}

	// 2. Mise à jour
	const updateData: Record<string, unknown> = {
		key,
		updated_at: new Date().toISOString(),
		value,
	};

	if (description) {
		updateData.description = description;
	}

	const { error } = await supabase.from("settings").upsert(updateData);

	if (error) {
		return { message: `Erreur lors de la mise à jour: ${error.message}` };
	}

	// 3. Log de l'action
	await logAdminAction("update", "settings", key, { description, value });

	revalidatePath("/admin/settings");
	revalidatePath("/"); // Revalidate home page as well
	return { message: "Paramètre mis à jour avec succès" };
}
