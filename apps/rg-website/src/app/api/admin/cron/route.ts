import { NextResponse } from "next/server";

import { requireApiAdmin } from "@/lib/api-auth";
import { etatDuCron, telemetrieDiscord } from "@/lib/bot/cron";

export const dynamic = "force-dynamic";

/**
 * `GET /api/admin/cron` — état de l'ordonnanceur et catalogue de ses tâches.
 *
 * La télémétrie Discord est demandée en même temps parce qu'elle vient du même
 * processus : c'est `rg-cron` qui tient la passerelle de synchronisation, pas
 * les bots. La demander séparément doublerait les allers-retours pour une
 * information qui s'affiche sur la même page.
 */
export async function GET() {
	const garde = await requireApiAdmin();
	if (!garde.ok) {
		return garde.response;
	}

	const [cron, telemetrie] = await Promise.all([etatDuCron(), telemetrieDiscord()]);

	return NextResponse.json(
		{ cron, telemetrie, role: garde.data.role },
		{ headers: { "cache-control": "private, no-store" } }
	);
}
