import { VisualSettingsEditor } from "@/components/admin/settings/VisualSettingsEditor";
import type { Setting } from "@/components/admin/settings/VisualSettingsEditor";
import { createPostgresClient } from "@rosegriffon/db/service";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
	const { data } = await createPostgresClient().from("settings").select("*").order("key");

	// Transform data to match the Setting type (handle nulls if necessary)
	const settings: Setting[] = (data || []).map((item: { description?: string | null; key: string; value: unknown }) => ({
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
