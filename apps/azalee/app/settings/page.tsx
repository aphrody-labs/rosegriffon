import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getServerSession } from "@/lib/auth-helpers";
import { createClient } from "@/lib/supabase/server";
import { SettingsClient } from "./SettingsClient";

export const metadata: Metadata = {
  title: "Paramètres | Azalée",
  description: "Gère ton compte et tes préférences.",
};

export default async function SettingsPage() {
  const session = await getServerSession();
  if (!session?.user) {
    redirect("/login?returnTo=/settings");
  }

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .single();

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-on-surface-variant font-medium">Profil introuvable.</p>
      </div>
    );
  }

  // Fetch active sessions
  const reqHeaders = await headers();
  let sessions: any[] = [];
  try {
    const sessionList = await auth.api.listSessions({ headers: reqHeaders });
    sessions = sessionList || [];
  } catch {
    sessions = [];
  }

  // Fetch linked accounts (OAuth providers)
  let linkedAccounts: any[] = [];
  try {
    const { data } = await supabase
      .from("account")
      .select("provider_id, account_id, created_at")
      .eq("user_id", session.user.id);
    linkedAccounts = data || [];
  } catch {
    linkedAccounts = [];
  }

  return (
    <SettingsClient
      profile={profile}
      userEmail={session.user.email}
      initialSessions={sessions}
      currentSessionToken={session.session.token}
      linkedAccounts={linkedAccounts}
    />
  );
}
