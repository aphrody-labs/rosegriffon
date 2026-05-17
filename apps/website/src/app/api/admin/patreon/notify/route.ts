import { NextResponse } from "next/server";

import { requirePatreonCreator } from "@/lib/auth-helpers";
import { runReminderBatch, type ReminderStage } from "@/lib/patreon/notify";

export const runtime = "nodejs";
export const maxDuration = 300;

const VALID: ReminderStage[] = [
	"announce",
	"reminder1",
	"reminder2",
	"lastcall",
];

export async function POST(req: Request) {
	await requirePatreonCreator();
	const url = new URL(req.url);
	const stageRaw = url.searchParams.get("stage") ?? "announce";
	const stage = (
		VALID.includes(stageRaw as ReminderStage) ? stageRaw : "announce"
	) as ReminderStage;

	try {
		const summary = await runReminderBatch(stage);
		return NextResponse.json({ ok: true, summary });
	} catch (e) {
		console.error("[admin/patreon/notify]", e);
		return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
	}
}
