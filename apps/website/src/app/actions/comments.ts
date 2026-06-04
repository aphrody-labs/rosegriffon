"use server";

import { revalidatePath } from "next/cache";
import { getServerUser } from "@/lib/auth-helpers";
import { createClient } from "@/lib/supabase/server";

export async function addCommentAction(
	targetId: string,
	targetType: string,
	content: string
) {
	const user = await getServerUser();
	if (!user) {
		return { error: "Vous devez être connecté pour publier un commentaire." };
	}

	const trimmedContent = content.trim();
	if (!trimmedContent) {
		return { error: "Le commentaire ne peut pas être vide." };
	}

	if (trimmedContent.length > 1000) {
		return { error: "Le commentaire ne peut pas dépasser 1000 caractères." };
	}

	const supabase = await createClient();

	// S'assurer que le profil existe en DB
	const { data: profile, error: profileError } = await supabase
		.from("profiles")
		.select("id")
		.eq("id", user.id)
		.maybeSingle();

	if (profileError || !profile) {
		return { error: "Profil utilisateur introuvable en base de données." };
	}

	const { data, error } = await supabase
		.from("comments")
		.insert({
			content: trimmedContent,
			target_id: targetId,
			target_type: targetType,
			user_id: user.id,
		})
		.select()
		.single();

	if (error) {
		console.error("Failed to add comment:", error);
		return { error: "Impossible de publier le commentaire." };
	}

	return { success: true, comment: data };
}

export async function deleteCommentAction(commentId: string) {
	const user = await getServerUser();
	if (!user) {
		return { error: "Vous devez être connecté pour supprimer un commentaire." };
	}

	const supabase = await createClient();

	// Récupérer le commentaire pour vérifier la propriété
	const { data: comment, error: fetchError } = await supabase
		.from("comments")
		.select("user_id")
		.eq("id", commentId)
		.maybeSingle();

	if (fetchError || !comment) {
		return { error: "Commentaire introuvable." };
	}

	// Autoriser si l'utilisateur est l'auteur
	if (comment.user_id !== user.id) {
		// Vérifier si l'utilisateur est admin
		const { data: profile } = await supabase
			.from("profiles")
			.select("role")
			.eq("id", user.id)
			.maybeSingle();

		if (profile?.role !== "admin" && profile?.role !== "staff") {
			return { error: "Vous n'êtes pas autorisé à supprimer ce commentaire." };
		}
	}

	const { error } = await supabase
		.from("comments")
		.delete()
		.eq("id", commentId);

	if (error) {
		console.error("Failed to delete comment:", error);
		return { error: "Impossible de supprimer le commentaire." };
	}

	return { success: true };
}
