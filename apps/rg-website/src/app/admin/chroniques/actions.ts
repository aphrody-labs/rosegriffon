"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { logAdminAction } from "@/lib/admin-logger";
import { getServerUser } from "@/lib/auth-helpers";
import { createClient } from "@/lib/supabase/server";

import { type ArticleInput, ArticleSchema } from "./schema";

async function checkStaffPermission() {
  const supabase = await createClient();
  const user = await getServerUser();

  if (!user) return { authorized: false, user: null };

  // Vérifier via la table profiles
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const authorized = profile?.role === "admin" || profile?.role === "staff";
  return { authorized, user };
}

export async function createChronicle(
  data: ArticleInput
): Promise<{ success: boolean; error?: string; data?: unknown }> {
  try {
    // 1. Validation
    const validation = ArticleSchema.safeParse(data);
    if (!validation.success) {
      return { success: false, error: validation.error.issues[0]?.message };
    }

    // 2. Check Auth & Permissions
    const { authorized, user } = await checkStaffPermission();

    if (!authorized || !user) {
      return { success: false, error: "Non autorisé : Réservé au staff" };
    }

    const supabase = await createClient();

    // 3. Check Slug Uniqueness
    const { data: existingSlug } = await supabase
      .from("articles")
      .select("id")
      .eq("slug", data.slug)
      .eq("app", "website")
      .single();

    if (existingSlug) {
      return { success: false, error: "Ce slug est déjà utilisé" };
    }

    // 4. Insert
    const { data: newArticle, error } = await supabase
      .from("articles")
      .insert({
        title: data.title,
        slug: data.slug,
        content: data.content,
        excerpt: data.excerpt,
        category: data.category,
        featured_image_url: data.featured_image_url,
        status: data.status,
        author_id: user.id,
        app: "website",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        view_count: 0,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    // 5. Log
    await logAdminAction("create", "article", newArticle.id, {
      title: newArticle.title,
      slug: newArticle.slug,
    });

    // 6. Revalidate
    revalidatePath("/admin/chroniques");
    revalidatePath("/chroniques");
    revalidateTag("articles", "max");

    return { success: true, data: newArticle };
  } catch (error) {
    console.error("Error creating chronicle:", error);
    return { success: false, error: "Erreur lors de la création" };
  }
}

export async function updateChronicle(
  id: string,
  data: ArticleInput
): Promise<{ success: boolean; error?: string; data?: unknown }> {
  try {
    // 1. Validation
    const validation = ArticleSchema.safeParse(data);
    if (!validation.success) {
      return { success: false, error: validation.error.issues[0]?.message };
    }

    // 2. Check Auth & Permissions
    const { authorized, user } = await checkStaffPermission();

    if (!authorized || !user) {
      return { success: false, error: "Non autorisé : Réservé au staff" };
    }

    const supabase = await createClient();

    // 3. Check Slug Uniqueness (excluding current article)
    const { data: existingSlug } = await supabase
      .from("articles")
      .select("id")
      .eq("slug", data.slug)
      .eq("app", "website")
      .neq("id", id)
      .single();

    if (existingSlug) {
      return {
        success: false,
        error: "Ce slug est déjà utilisé par un autre article",
      };
    }

    // 4. Update
    const { data: updatedArticle, error } = await supabase
      .from("articles")
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    // 5. Log
    await logAdminAction("update", "article", id, {
      title: updatedArticle.title,
      status: updatedArticle.status,
    });

    // 6. Revalidate
    revalidatePath("/admin/chroniques");
    revalidatePath("/chroniques");
    revalidatePath(`/chroniques/${updatedArticle.slug}`);
    revalidateTag("articles", "max");

    return { success: true, data: updatedArticle };
  } catch (error) {
    console.error("Error updating chronicle:", error);
    return { success: false, error: "Erreur lors de la modification" };
  }
}

export async function toggleChronicleStatus(
  id: string,
  currentStatus: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const { authorized, user } = await checkStaffPermission();
    if (!authorized || !user) {
      return { success: false, error: "Non autorisé : Réservé au staff" };
    }

    const supabase = await createClient();
    const newStatus = currentStatus ? "draft" : "published";

    const { error } = await supabase
      .from("articles")
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      return { success: false, error: error.message };
    }

    await logAdminAction("update", "article", id, {
      status: newStatus,
    });

    revalidatePath("/admin/chroniques");
    revalidatePath("/chroniques");
    revalidatePath("/");
    revalidateTag("articles", "max");

    return { success: true };
  } catch (error) {
    console.error("Error toggling chronicle status:", error);
    return { success: false, error: "Erreur lors du changement de statut" };
  }
}

export async function deleteChronicle(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { authorized, user } = await checkStaffPermission();
    if (!authorized || !user) {
      return { success: false, error: "Non autorisé : Réservé au staff" };
    }

    const supabase = await createClient();
    const { error } = await supabase.from("articles").delete().eq("id", id);

    if (error) {
      return { success: false, error: error.message };
    }

    await logAdminAction("delete", "article", id, {});

    revalidatePath("/admin/chroniques");
    revalidatePath("/chroniques");
    revalidatePath("/");
    revalidateTag("articles", "max");

    return { success: true };
  } catch (error) {
    console.error("Error deleting chronicle:", error);
    return { success: false, error: "Erreur lors de la suppression" };
  }
}
