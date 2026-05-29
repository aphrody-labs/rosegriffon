import { AdminPageHeader as DashboardPageHeader } from "@rose-griffon/ui";
import { SettingsForm } from "@/components/dashboard/settings-form";
import { getServerSession } from "@/lib/auth-helpers";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
	const session = await getServerSession();
	if (!session?.user) {
		return null;
	}

	const supabase = await createClient();
	const { data: profile } = await supabase
		.from("profiles")
		.select("*")
		.eq("id", session.user.id)
		.single();

	return (
		<div className="space-y-6 sm:space-y-8 pb-24 sm:pb-8 max-w-4xl">
			<DashboardPageHeader
				breadcrumbs={[{ href: "/dashboard", label: "Tableau de bord" }, { label: "Paramètres" }]}
				title="Paramètres"
				subtitle="Gérer votre profil et préférences"
				icon="settings"
			/>

			{profile && <SettingsForm initialProfile={profile} userEmail={session.user.email} />}
		</div>
	);
}
