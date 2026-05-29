"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getServerUser } from "@/lib/auth-helpers";

import { createClient } from "@/lib/supabase/server";

const profileSchema = z.object({
	address_line1: z.string().optional(),
	address_line2: z.string().optional(),
	banner_url: z.string().url("URL invalide").optional().or(z.literal("")),
	bio: z.string().max(500).optional(),
	city: z.string().optional(),
	country: z.string().optional(),
	full_name: z.string().optional(),
	postal_code: z.string().optional(),
	twitter_handle: z.string().optional(),
	username: z
		.string()
		.min(3, "Le nom d'utilisateur doit faire au moins 3 caractères.")
		.max(20, "Le nom d'utilisateur ne peut pas dépasser 20 caractères."),
	website: z.string().url("URL invalide").optional().or(z.literal("")),
});

export async function updateProfile(formData: FormData) {
	const supabase = await createClient();

	const user = await getServerUser();
	if (!user) {
		return { error: "Utilisateur non authentifié." };
	}

	const rawData = Object.fromEntries(formData.entries());
	const validation = profileSchema.safeParse(rawData);

	if (!validation.success) {
		return { error: validation.error.flatten().fieldErrors };
	}

	const badges = formData.getAll("badges") as string[];

	const { error } = await supabase
		.from("profiles")
		.update({
			address_line1: validation.data.address_line1,
			address_line2: validation.data.address_line2,
			badges,
			banner_url: validation.data.banner_url,
			bio: validation.data.bio,
			city: validation.data.city,
			country: validation.data.country,
			full_name: validation.data.full_name,
			postal_code: validation.data.postal_code,
			twitter_handle: validation.data.twitter_handle,
			updated_at: new Date().toISOString(),
			username: validation.data.username,
			website: validation.data.website,
		})
		.eq("id", user.id);

	if (error) {
		if (error.code === "23505") {
			// Erreur de contrainte unique (username déjà pris)
			return { error: { username: ["Ce nom d'utilisateur est déjà pris."] } };
		}
		console.error("Error updating profile:", error);
		return { error: "Erreur lors de la mise à jour du profil." };
	}

	revalidatePath("/dashboard/account");
	revalidatePath(`/profil/${validation.data.username}`);
	return { success: true };
}

export async function updateUserAvatar(userId: string, avatarUrl: string) {
	const supabase = await createClient();
	const { error } = await supabase
		.from("profiles")
		.update({ avatar_url: avatarUrl })
		.eq("id", userId);
	if (error) {
		console.error("Error updating avatar URL:", error);
		throw new Error("Could not update avatar URL.");
	}
	revalidatePath("/dashboard/account");

	// Récupérer le username pour invalider le cache du profil public
	const { data: profile } = await supabase
		.from("profiles")
		.select("username")
		.eq("id", userId)
		.maybeSingle();

	if (profile?.username) {
		revalidatePath(`/profil/${profile.username}`);
	}
}
