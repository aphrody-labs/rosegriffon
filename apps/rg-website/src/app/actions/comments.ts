"use server";

import { revalidatePath } from "next/cache";
import { getServerUser } from "@/lib/auth-helpers";
import { createClient } from "@/lib/supabase/server";
import { getPgPool } from "@/lib/db/pg";

export interface CommentProfile {
	username: string | null;
	avatar_url: string | null;
	role: string | null;
	badges: string[] | null;
}

export interface CommentWithProfile {
	id: string;
	content: string;
	target_id: string;
	target_type: string;
	user_id: string;
	created_at: string;
	updated_at: string;
	profiles: CommentProfile | null;
}

interface CommentRow {
	id: string;
	content: string;
	target_id: string;
	target_type: string;
	user_id: string;
	created_at: string;
	updated_at: string;
	profile_id: string | null;
	profile_username: string | null;
	profile_avatar_url: string | null;
	profile_role: string | null;
	profile_badges: string[] | null;
}

/**
 * Récupère les commentaires d'une cible (article/stream) avec le profil auteur embarqué.
 * Lecture Postgres DIRECTE (bypass le Data API PostgREST de Supabase — cf. lib/db/pg.ts) :
 * un composant client ("use client") ne peut pas ouvrir de connexion Postgres directe
 * (pas de TCP depuis le navigateur), d'où cette server action appelée depuis
 * CommentsSection.tsx à la place de l'ancien `.from("comments").select("*, profiles(...)")`.
 */
export async function getCommentsAction(
	targetId: string,
	targetType: string
): Promise<{ data: CommentWithProfile[]; error?: string }> {
	try {
		const pool = getPgPool();

		const { rows } = await pool.query<CommentRow>(
			`SELECT c.id, c.content, c.target_id, c.target_type, c.user_id, c.created_at, c.updated_at,
				p.id AS profile_id, p.username AS profile_username, p.avatar_url AS profile_avatar_url,
				p.role AS profile_role, p.badges AS profile_badges
			 FROM comments c
			 LEFT JOIN profiles p ON p.id = c.user_id
			 WHERE c.target_id = $1 AND c.target_type = $2
			 ORDER BY c.created_at ASC`,
			[targetId, targetType]
		);

		const data: CommentWithProfile[] = rows.map((row) => ({
			content: row.content,
			created_at: row.created_at,
			id: row.id,
			profiles: row.profile_id
				? {
						avatar_url: row.profile_avatar_url,
						badges: row.profile_badges,
						role: row.profile_role,
						username: row.profile_username,
					}
				: null,
			target_id: row.target_id,
			target_type: row.target_type,
			updated_at: row.updated_at,
			user_id: row.user_id,
		}));

		return { data };
	} catch (error) {
		console.error("Error loading comments:", error);
		return { data: [], error: "Impossible de charger les commentaires." };
	}
}

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
