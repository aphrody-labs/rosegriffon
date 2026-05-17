import { NextResponse } from "next/server";

import { runReminderBatch, type ReminderStage } from "@/lib/patreon/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_STAGES: ReminderStage[] = [
	"announce",
	"reminder1",
	"reminder2",
	"lastcall",
];

function isAuthorized(req: Request): boolean {
	const secret = process.env.CRON_SECRET;
	if (!secret) return false;
	const auth = req.headers.get("authorization") ?? "";
	return auth === `Bearer ${secret}`;
}

export async function POST(req: Request) {
	if (!isAuthorized(req)) {
		return NextResponse.json({ error: "unauthorized" }, { status: 401 });
	}
	const url = new URL(req.url);
	const stageRaw = url.searchParams.get("stage") ?? "announce";
	const stage = VALID_STAGES.includes(stageRaw as ReminderStage)
		? (stageRaw as ReminderStage)
		: "announce";

	try {
		const summary = await runReminderBatch(stage);
		return NextResponse.json({ ok: true, summary });
	} catch (e) {
		console.error("[cron/patreon-reminders]", e);
		return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
	}
}
