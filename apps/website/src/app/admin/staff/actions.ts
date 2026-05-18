"use server";

import { revalidatePath } from "next/cache";
import { logAdminAction } from "@/lib/admin-logger";
import { getServerUser } from "@/lib/auth-helpers";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import type { Database } from "@rose-griffon/db";

export type TeamMember = Database["public"]["Tables"]["team_members"]["Row"];

export type TeamMemberInput = Omit<
  Database["public"]["Tables"]["team_members"]["Insert"],
  "id" | "created_at" | "updated_at"
>;

/**
 * Récupère tous les membres d'équipe
 */
export async function getAllTeamMembers(): Promise<{
  data: TeamMember[] | null;
  error: string | null;
}> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("team_members")
      .select("*")
      .order("team_id", { ascending: true })
      .order("display_index", { ascending: true });

    if (error) {
      console.error("Error fetching team members:", error);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (error) {
    console.error("Unexpected error fetching team members:", error);
    return { data: null, error: "Une erreur inattendue est survenue" };
  }
}

/**
 * Récupère les membres d'une équipe spécifique
 */
export async function getTeamMembersByTeamId(teamId: string): Promise<{
  data: TeamMember[] | null;
  error: string | null;
}> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("team_members")
      .select("*")
      .eq("team_id", teamId)
      .order("display_index", { ascending: true });

    if (error) {
      console.error("Error fetching team members:", error);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (error) {
    console.error("Unexpected error fetching team members:", error);
    return { data: null, error: "Une erreur inattendue est survenue" };
  }
}

/**
 * Crée un nouveau membre d'équipe
 */
export async function createTeamMember(input: TeamMemberInput): Promise<{
  data: TeamMember | null;
  error: string | null;
}> {
  try {
    // Vérifier les permissions admin (Better Auth → bridge service_role)
    const user = await getServerUser();
    if (!user) {
      return { data: null, error: "Non authentifié" };
    }

    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return { data: null, error: "Permissions insuffisantes" };
    }

    const { data, error } = await admin.from("team_members").insert(input).select().single();

    if (error) {
      console.error("Error creating team member:", error);
      return { data: null, error: error.message };
    }

    await logAdminAction("create", "team_member", String(data.id), input);

    revalidatePath("/notre-equipe");
    revalidatePath("/notre-equipe/staff");
    revalidatePath("/admin/staff");

    return { data, error: null };
  } catch (error) {
    console.error("Unexpected error creating team member:", error);
    return { data: null, error: "Une erreur inattendue est survenue" };
  }
}

/**
 * Met à jour un membre d'équipe
 */
export async function updateTeamMember(
  id: string,
  input: Partial<TeamMemberInput>
): Promise<{
  data: TeamMember | null;
  error: string | null;
}> {
  try {
    const user = await getServerUser();
    if (!user) {
      return { data: null, error: "Non authentifié" };
    }

    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return { data: null, error: "Permissions insuffisantes" };
    }

    const { data, error } = await admin
      .from("team_members")
      .update(input)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating team member:", error);
      return { data: null, error: error.message };
    }

    await logAdminAction("update", "team_member", id, input);

    revalidatePath("/notre-equipe");
    revalidatePath("/notre-equipe/staff");
    revalidatePath("/admin/staff");

    return { data, error: null };
  } catch (error) {
    console.error("Unexpected error updating team member:", error);
    return { data: null, error: "Une erreur inattendue est survenue" };
  }
}

/**
 * Supprime un membre d'équipe
 */
export async function deleteTeamMember(id: string): Promise<{
  success: boolean;
  error: string | null;
}> {
  try {
    const user = await getServerUser();
    if (!user) {
      return { success: false, error: "Non authentifié" };
    }

    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return { success: false, error: "Permissions insuffisantes" };
    }

    const { error } = await admin.from("team_members").delete().eq("id", id);

    if (error) {
      console.error("Error deleting team member:", error);
      return { success: false, error: error.message };
    }

    await logAdminAction("delete", "team_member", id, {});

    revalidatePath("/notre-equipe");
    revalidatePath("/notre-equipe/staff");
    revalidatePath("/admin/staff");

    return { success: true, error: null };
  } catch (error) {
    console.error("Unexpected error deleting team member:", error);
    return { success: false, error: "Une erreur inattendue est survenue" };
  }
}

/**
 * Upload une image de profil pour un membre d'équipe dans Supabase Storage
 */
export async function uploadTeamMemberImage(file: File): Promise<{
  url: string | null;
  error: string | null;
}> {
  try {
    const user = await getServerUser();
    if (!user) {
      return { url: null, error: "Non authentifié" };
    }

    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return { url: null, error: "Permissions insuffisantes" };
    }

    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `team-members/${fileName}`;

    const { error: uploadError } = await admin.storage.from("assets").upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
    });

    if (uploadError) {
      console.error("Error uploading image:", uploadError);
      return { url: null, error: uploadError.message };
    }

    const {
      data: { publicUrl },
    } = admin.storage.from("assets").getPublicUrl(filePath);

    return { url: publicUrl, error: null };
  } catch (error) {
    console.error("Unexpected error uploading image:", error);
    return { url: null, error: "Une erreur inattendue est survenue" };
  }
}
