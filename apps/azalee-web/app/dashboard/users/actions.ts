"use server";

import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { getServerSession } from "@/lib/auth-helpers";
import { USER_MANAGEMENT_ROLES } from "@/lib/auth-roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function requireAdminSession() {
  const session = await getServerSession();
  if (!session?.user) {
    return { error: "Non authentifié", session: null, role: null };
  }

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .single();

  if (
    !profile ||
    !USER_MANAGEMENT_ROLES.includes(profile.role as (typeof USER_MANAGEMENT_ROLES)[number])
  ) {
    return { error: "Permissions insuffisantes", session: null, role: null };
  }

  return { error: null, session, role: profile.role as string };
}

export async function changeUserRole(targetUserId: string, newRole: string) {
  const { error: authError, session, role: currentUserRole } = await requireAdminSession();
  if (authError || !session) {
    return { success: false, error: authError || "Non authentifié" };
  }

  // Validate role value
  const validRoles = ["member", "editor", "moderator", "admin"];
  if (!validRoles.includes(newRole)) {
    return { success: false, error: "Rôle invalide" };
  }

  // Prevent self-modification
  if (targetUserId === session.user.id) {
    return { success: false, error: "Vous ne pouvez pas modifier votre propre rôle" };
  }

  // Only superadmin can promote to admin
  if (newRole === "admin" && currentUserRole !== "superadmin") {
    return { success: false, error: "Seul un superadmin peut promouvoir au rôle admin" };
  }

  // Check target isn't superadmin
  const adminDb = createAdminClient();
  const { data: targetProfile } = await (adminDb as any)
    .from("profiles")
    .select("role, username")
    .eq("id", targetUserId)
    .single();

  if (!targetProfile) {
    return { success: false, error: "Utilisateur introuvable" };
  }

  if (targetProfile.role === "superadmin") {
    return { success: false, error: "Impossible de modifier un superadmin" };
  }

  // Update role
  const { error } = await (adminDb as any)
    .from("profiles")
    .update({ role: newRole })
    .eq("id", targetUserId);

  if (error) {
    console.error("Error changing role:", error);
    return { success: false, error: "Erreur lors de la modification du rôle" };
  }

  await logAudit(session.user.id, "role_change", {
    targetUserId,
    targetUsername: targetProfile.username,
    oldRole: targetProfile.role,
    newRole,
  });

  revalidatePath("/dashboard/users");
  return { success: true };
}

export async function banUser(targetUserId: string) {
  const { error: authError, session } = await requireAdminSession();
  if (authError || !session) {
    return { success: false, error: authError || "Non authentifié" };
  }

  // Prevent self-ban
  if (targetUserId === session.user.id) {
    return { success: false, error: "Vous ne pouvez pas vous bannir vous-même" };
  }

  // Check target isn't superadmin or admin
  const adminDb = createAdminClient();
  const { data: targetProfile } = await (adminDb as any)
    .from("profiles")
    .select("role, username")
    .eq("id", targetUserId)
    .single();

  if (!targetProfile) {
    return { success: false, error: "Utilisateur introuvable" };
  }

  if (targetProfile.role === "superadmin" || targetProfile.role === "admin") {
    return { success: false, error: "Impossible de bannir un administrateur" };
  }

  // Set role to banned
  const { error } = await (adminDb as any)
    .from("profiles")
    .update({ role: "banned" })
    .eq("id", targetUserId);

  if (error) {
    console.error("Error banning user:", error);
    return { success: false, error: "Erreur lors du bannissement" };
  }

  await logAudit(session.user.id, "user_ban", {
    targetUserId,
    targetUsername: targetProfile.username,
    previousRole: targetProfile.role,
  });

  revalidatePath("/dashboard/users");
  return { success: true };
}
