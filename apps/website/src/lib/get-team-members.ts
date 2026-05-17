"use server";

import { getEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/server";

export type TeamMemberResponse = {
  metadata: {
    memberName: string;
    memberRole: string;
    memberIndex: number;
    memberLink: string;
  };
  url: string;
};

/**
 * Fetches team members from Supabase based on the team ID
 * @param teamId - ID of the team to fetch (e.g., "loreteam", "productionteam")
 * @returns Array of team members with their metadata and image URLs
 */
export default async function getTeamMembers(teamId: string): Promise<TeamMemberResponse[]> {
  try {
    const supabase = createAdminClient();

    if (!supabase) {
      console.error("Failed to create Supabase admin client");
      return [];
    }

    // Ne charge que les membres actifs et trie par display_index puis nom
    // (tri secondaire pour les ex-aequo / display_index null).
    const { data, error } = await supabase
      .from("team_members")
      .select("*")
      .eq("team_id", teamId)
      .eq("is_active", true)
      .order("display_index", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true });

    if (error) {
      console.error(`Error fetching ${teamId} members from Supabase:`, error);
      return [];
    }

    // Transform database records to TeamMemberResponse format
    const supabaseUrl = getEnv("NEXT_PUBLIC_SUPABASE_URL");

    return (data || []).map((member) => {
      // Fix image URLs that contain {url} placeholder or double https://
      let imageUrl = member.image_url || "";

      // Replace {url} placeholder with actual Supabase URL
      if (imageUrl.includes("{url}")) {
        imageUrl = imageUrl.replace("{url}", supabaseUrl);
      }

      // Fix double https:// (happens if DB already has https:// instead of {url})
      if (imageUrl.startsWith("https://https://")) {
        imageUrl = imageUrl.replace("https://https://", "https://");
      }

      return {
        metadata: {
          memberName: member.name,
          memberRole: member.role || "",
          memberIndex: member.display_index || 999,
          memberLink: member.member_link || "",
        },
        url: imageUrl,
      };
    });
  } catch (error) {
    console.error(`Error fetching ${teamId} members:`, error);
    return [];
  }
}
