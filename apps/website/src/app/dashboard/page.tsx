import { redirect } from "next/navigation";

import { getServerUser } from "@/lib/auth-helpers";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
	const user = await getServerUser();
	if (!user) {
		redirect("/login");
	}

	const supabase = await createClient();
	const { data: profile } = await supabase
		.from("profiles")
		.select("username")
		.eq("id", user.id)
		.maybeSingle();

	const username = (profile as { username?: string } | null)?.username;
	if (username) {
		redirect(`/profil/${username}`);
	}
	redirect("/settings");
}
