import { VisualSettingsEditor } from "@/components/admin/settings/VisualSettingsEditor";
import type { Setting } from "@/components/admin/settings/VisualSettingsEditor";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
	const supabase = createAdminClient();
	if (!supabase) {
		return (
			<div className="p-6">
				<h1 className="text-3xl font-bold">Configuration Globale</h1>
				<p className="text-muted-foreground mt-2">Service indisponible.</p>
			</div>
		);
	}
	const { data } = await supabase.from("settings").select("*").order("key");

	// Transform data to match the Setting type (handle nulls if necessary)
	const settings: Setting[] = (data || []).map((item) => ({
		description: item.description || undefined,
		key: item.key,
		value: typeof item.value === "string" ? item.value : JSON.stringify(item.value || ""),
	}));

	return (
		<div className="p-6 space-y-6">
			<h1 className="text-3xl font-bold">Configuration Globale</h1>
			{/* <SettingsEditor settings={settings || []} /> */}
			<VisualSettingsEditor settings={settings} />
		</div>
	);
}
