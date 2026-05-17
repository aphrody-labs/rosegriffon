"use server";

import { getServerUser } from "@/lib/auth-helpers";
import { createAdminClient } from "@/lib/supabase/server";

export async function logAdminAction(
  action: string,
  targetType: string,
  targetId?: string,
  details?: Record<string, unknown> | null
) {
  try {
    const user = await getServerUser();
    if (!user) return;

    const admin = createAdminClient();
    await admin.from("admin_audit_log").insert({
      user_id: user.id,
      action,
      entity_type: targetType,
      entity_id: targetId,
      details: details as unknown as Record<string, unknown>,
    });
  } catch (error) {
    console.error("Failed to log admin action:", error);
  }
}
