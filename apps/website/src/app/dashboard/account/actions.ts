"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getServerUser } from "@/lib/auth-helpers";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Actions du compte.
 *
 * Toutes écrivent en **service-role** après vérification de session : depuis la
 * fermeture PII des `profiles` (11/8/2026), la table n'est plus accessible en
 * `anon` et un client anonyme échouerait en 42501.
 *
 * Chaque action ne met à jour QUE ses propres colonnes. La version précédente
 * demandait à chaque formulaire de réinjecter les champs des autres onglets
 * pour « les préserver » : dès que la lecture initiale était partielle, la
 * sauvegarde d'une adresse écrasait le pseudo et la bio par des chaînes vides.
 */

const profileSchema = z.object({
	badges: z.array(z.string()).max(3),
	banner_url: z.string().optional().or(z.literal("")),
	bio: z.string().max(500).optional(),
	full_name: z.string().optional(),
	twitter_handle: z.string().optional(),
	username: z
		.string()
		.min(3, "Le nom d'utilisateur doit faire au moins 3 caractères.")
		.max(20, "Le nom d'utilisateur ne peut pas dépasser 20 caractères."),
	website: z.string().url("URL invalide").optional().or(z.literal("")),
});

const addressSchema = z.object({
	address_line1: z.string().optional(),
	address_line2: z.string().optional(),
	city: z.string().optional(),
	country: z.string().optional(),
	postal_code: z.string().optional(),
});

function firstIssue(error: z.ZodError): string {
	return error.issues[0]?.message ?? "Données invalides.";
}

export async function updateProfile(
	values: z.infer<typeof profileSchema>
): Promise<{ error?: string }> {
	const user = await getServerUser();
	if (!user) {
		return { error: "Session expirée — reconnecte-toi." };
	}

	const parsed = profileSchema.safeParse(values);
	if (!parsed.success) {
		return { error: firstIssue(parsed.error) };
	}

	const { error } = await createAdminClient()
		.from("profiles")
		.update({ ...parsed.data, updated_at: new Date().toISOString() })
		.eq("id", user.id);

	if (error) {
		if (error.code === "23505") {
			return { error: "Ce nom d'utilisateur est déjà pris." };
		}
		console.error("[compte] mise à jour du profil impossible", error);
		return { error: "Erreur lors de la mise à jour du profil." };
	}

	revalidatePath("/dashboard/account");
	revalidatePath(`/profil/${parsed.data.username}`);
	return {};
}

export async function updateAddress(
	values: z.infer<typeof addressSchema>
): Promise<{ error?: string }> {
	const user = await getServerUser();
	if (!user) {
		return { error: "Session expirée — reconnecte-toi." };
	}

	const parsed = addressSchema.safeParse(values);
	if (!parsed.success) {
		return { error: firstIssue(parsed.error) };
	}

	const { error } = await createAdminClient()
		.from("profiles")
		.update({ ...parsed.data, updated_at: new Date().toISOString() })
		.eq("id", user.id);

	if (error) {
		console.error("[compte] mise à jour de l'adresse impossible", error);
		return { error: "Erreur lors de l'enregistrement de l'adresse." };
	}

	revalidatePath("/dashboard/account");
	return {};
}

/**
 * Enregistre l'URL d'avatar déjà téléversée.
 *
 * L'identifiant vient de la session, jamais du client : la signature
 * précédente prenait un `userId` en paramètre, ce qui laissait n'importe quel
 * appelant réécrire l'avatar d'un autre compte.
 */
export async function updateAvatarUrl(avatarUrl: string): Promise<{ error?: string }> {
	const user = await getServerUser();
	if (!user) {
		return { error: "Session expirée — reconnecte-toi." };
	}

	const admin = createAdminClient();
	const { error } = await admin
		.from("profiles")
		.update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
		.eq("id", user.id);

	if (error) {
		console.error("[compte] mise à jour de l'avatar impossible", error);
		return { error: "Impossible d'enregistrer le nouvel avatar." };
	}

	revalidatePath("/dashboard/account");
	const { data: profile } = await admin
		.from("profiles")
		.select("username")
		.eq("id", user.id)
		.maybeSingle();
	const username = (profile as { username?: string } | null)?.username;
	if (username) {
		revalidatePath(`/profil/${username}`);
	}
	return {};
}
