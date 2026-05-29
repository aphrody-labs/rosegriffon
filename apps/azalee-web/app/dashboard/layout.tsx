import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession, hasMedailleAzaleeRole } from "@/lib/auth-helpers";
import { ADMIN_ROLES } from "@/lib/auth-roles";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
	description: "Espace de gestion pour l'équipe rédactionnelle.",
	robots: { follow: false, index: false },
	title: "Administration | Azalée",
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
	const session = await getServerSession();
	if (!session?.user) {
		redirect("/login");
	}

	const supabase = await createClient();

	const { data: profile } = await supabase
		.from("profiles")
		.select("role, discord_id")
		.eq("id", session.user.id)
		.single();

	if (!profile) {
		redirect("/");
	}

	const isAdmin = ADMIN_ROLES.includes(profile.role as (typeof ADMIN_ROLES)[number]);
	const isMedailleMember = !isAdmin && (await hasMedailleAzaleeRole(profile.discord_id));

	if (!isAdmin && !isMedailleMember) {
		redirect("/");
	}

	return <div className="flex flex-col h-full min-h-[calc(100vh-4rem)]">{children}</div>;
}
