import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

/**
 * Récupère le profil de l'utilisateur connecté.
 * Utilise React Cache pour éviter les requêtes dupliquées.
 */
export const getUserProfile = cache(async (userId: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, full_name, avatar_url, role")
    .eq("id", userId)
    .single();

  if (error) {
    console.error("Error fetching profile:", error);
    return null;
  }

  return data;
});

/**
 * Récupère les articles publics avec pagination.
 * Optimisé pour ne récupérer que les champs nécessaires pour une liste.
 */
export const getPublicArticles = async (page = 1, limit = 10) => {
  const supabase = await createClient();
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error, count } = await supabase
    .from("articles")
    .select("id, title, slug, excerpt, created_at, featured_image_url, author_id", {
      count: "exact",
    })
    .eq("status", "published")
    .eq("app", "website")
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    console.error("Error fetching articles:", error);
    return { count: 0, data: [] };
  }

  return { count, data };
};
