export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/auth-helpers";
import { createClient } from "@/lib/supabase/server";
import { UserRoleManager } from "./UserRoleManager";

export default async function AdminUsersPage() {
  await requireAdmin();
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: users } = await (supabase as any)
    .from("profiles")
    .select("id, username, full_name, avatar_url, role, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-on-surface tracking-tight">
          Gestion des utilisateurs
        </h1>
        <p className="text-sm text-on-surface-variant mt-1">
          Attribuer les rôles : admin, editor, moderator ou member.
        </p>
      </div>
      <UserRoleManager users={users || []} />
    </div>
  );
}
