import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

// Planning hebdo — change rarement, 1h ISR suffit.
export const revalidate = 3600;

export async function GET() {
	const supabase = await createClient();

	// Récupérer le planning actif
	// On suppose que la table stream_schedules contient les créneaux de la semaine
	const { data: schedule, error } = await supabase
		.from("stream_schedules")
		.select("*")
		.order("day_of_week", { ascending: true })
		.order("start_time", { ascending: true });

	if (error) {
		return NextResponse.json({ error: error.message, success: false }, { status: 500 });
	}

	return NextResponse.json({
		count: schedule.length,
		data: schedule,
		success: true,
	});
}
