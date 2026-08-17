import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth-helpers";

import { createClient } from "@/lib/supabase/server";

import type { Metadata } from "next";

// Simple redirection vers l'espace du membre connecté : rien à indexer.
export const metadata: Metadata = {
	robots: { follow: false, index: false },
};


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
