import { createAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getServerSession } from "@/lib/auth-helpers";
import { SettingsClient } from "./SettingsClient";

export const metadata: Metadata = {
	description: "Gère ton compte et tes préférences.",
	title: "Paramètres | Azalée",
};

export default async function SettingsPage() {
	const session = await getServerSession();
	if (!session?.user) {
		redirect("/login?returnTo=/settings");
	}

	// Le profil complet contient des données personnelles : `anon` n'y a plus accès
	// (cf. apps/website/sql/migrations/20260811_profiles_pii.sql). La session est
	// vérifiée juste au-dessus, on lit donc en service-role.
	const supabase = createAdminClient();
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
	let sessions: any[];
	try {
		const sessionList = await auth.api.listSessions({ headers: reqHeaders });
		sessions = sessionList || [];
	} catch {
		sessions = [];
	}

	// Fetch linked accounts (OAuth providers)
	let linkedAccounts: any[];
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
