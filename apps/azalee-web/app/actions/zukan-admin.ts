"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-helpers";
import { createClient } from "@/lib/supabase/server";

export async function updateZukanHash(
  characterId: string,
  newHash: string | null,
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();

    const supabase = await createClient();
    const { error } = await supabase
      .from("inagle_characters")
      .update({ zukan_hash: newHash })
      .eq("id", characterId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/dashboard/zukan-review");
    return { success: true };
  } catch {
    return { success: false, error: "Accès non autorisé ou erreur serveur." };
  }
}
