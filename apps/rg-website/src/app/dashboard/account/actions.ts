"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getServerUser } from "@/lib/auth-helpers";

import { createClient } from "@/lib/supabase/server";

const profileSchema = z.object({
  username: z
    .string()
    .min(3, "Le nom d'utilisateur doit faire au moins 3 caractères.")
    .max(20, "Le nom d'utilisateur ne peut pas dépasser 20 caractères."),
  full_name: z.string().optional(),
  bio: z.string().max(500).optional(),
  website: z.string().url("URL invalide").optional().or(z.literal("")),
  twitter_handle: z.string().optional(),
  banner_url: z.string().url("URL invalide").optional().or(z.literal("")),
  address_line1: z.string().optional(),
  address_line2: z.string().optional(),
  city: z.string().optional(),
  postal_code: z.string().optional(),
  country: z.string().optional(),
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

  const { error } = await supabase
    .from("profiles")
    .update({
      username: validation.data.username,
      full_name: validation.data.full_name,
      bio: validation.data.bio,
      website: validation.data.website,
      twitter_handle: validation.data.twitter_handle,
      banner_url: validation.data.banner_url,
      address_line1: validation.data.address_line1,
      address_line2: validation.data.address_line2,
      city: validation.data.city,
      postal_code: validation.data.postal_code,
      country: validation.data.country,
      updated_at: new Date().toISOString(),
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
  revalidatePath(`/profil/${userId}`); // Invalider aussi la page de profil publique
}
