"use server";

import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { getServerSession } from "@/lib/auth-helpers";
import { createClient } from "@/lib/supabase/server";

export async function updateProfile(formData: FormData) {
  const session = await getServerSession();
  if (!session?.user) {
    return { error: "Non autorisé" };
  }

  const username = formData.get("username") as string;
  const full_name = formData.get("full_name") as string;
  const bio = formData.get("bio") as string;
  const website = formData.get("website") as string;

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      username,
      full_name,
      bio,
      website,
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.user.id);

  if (error) {
    return { error: error.message };
  }

  await logAudit(session.user.id, "profile_update", {
    fields: { username, full_name, bio, website },
  });

  revalidatePath("/settings");
  revalidatePath("/dashboard/settings");
  return { success: true };
}

export async function updateAvatar(url: string) {
  const session = await getServerSession();
  if (!session?.user) {
    return { error: "Non autorisé" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      avatar_url: url,
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard/settings");
  return { success: true };
}
