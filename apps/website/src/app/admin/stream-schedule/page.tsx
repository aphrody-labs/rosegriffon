import { AdminPageHeader } from "@rose-griffon/ui";
import { createAdminClient } from "@/lib/supabase/server";

import { StreamScheduleManager } from "./manager";

export const dynamic = "force-dynamic";

export default async function StreamSchedulePage() {
	const supabase = createAdminClient();
	if (!supabase) {
		return (
			<div className="p-6">
				<AdminPageHeader title="Planning Streams" description="Service indisponible." />
			</div>
		);
	}
	const { data: schedules } = await supabase
		.from("stream_schedules")
		.select("*")
		.order("day_of_week", { ascending: true })
		.order("start_time", { ascending: true });

	return (
		<div className="p-6 space-y-6">
			<AdminPageHeader
				title="Planning Streams"
				description="Gérez le planning de la Rose Griffon TV (Twitch)."
			/>
			<StreamScheduleManager initialSchedules={schedules || []} />
		</div>
	);
}
