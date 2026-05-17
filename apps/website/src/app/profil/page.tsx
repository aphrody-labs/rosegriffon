import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth-helpers";

import { createClient } from "@/lib/supabase/server";

export default async function ProfilPage() {
	const supabase = await createClient();
	const user = await getServerUser();

	if (!user) {
		redirect("/login?redirect=/profil");
	}

	const { data: profile } = await supabase
		.from("profiles")
		.select("username")
		.eq("id", user.id)
		.single();

	if (profile?.username) {
		redirect(`/profil/${profile.username}`);
	} else {
		redirect("/dashboard/account");
	}
}
