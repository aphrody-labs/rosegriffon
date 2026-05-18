import { parseWebhookRequest } from "@rosegriffon/patreon-bun";
import { NextResponse } from "next/server";

import {
	processPatreonEvent,
	type PatreonTrigger,
	type PatreonWebhookPayload,
} from "@/lib/patreon/webhooks";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook Patreon — pipeline tolérant aux erreurs métier.
 *
 * RÈGLES (cf. https://docs.patreon.com/#webhooks) :
 *  - Patreon DÉSACTIVE le webhook après plusieurs réponses non-2xx consécutives.
 *  - Donc : si la signature HMAC-MD5 est valide → on retourne TOUJOURS 200.
 *  - Les erreurs internes sont stockées dans `patreon_webhook_events.error` +
 *    `patreon_webhook_state.total_failed` mais NE remontent jamais en 5xx.
 *  - Seuls les vrais 4xx (signature manquante/invalide, body parse fail) restent
 *    pour signaler un caller frauduleux ou mal configuré.
 *
 * Heartbeat : `patreon_webhook_state` est mis à jour à chaque event valide pour
 * permettre au monitoring (admin /admin/patreon) de détecter un endpoint silencieux.
 */
export async function POST(req: Request) {
	const secret = process.env.PATREON_WEBHOOK_SECRET;
	if (!secret) {
		console.error("[patreon/webhook] PATREON_WEBHOOK_SECRET missing");
		// Retourner 500 ici est OK : si le secret manque, on ne peut PAS valider
		// l'origine — il faut alerter, et Patreon va re-essayer plus tard.
		return new NextResponse("server misconfigured", { status: 500 });
	}

	const eventId = req.headers.get("x-patreon-event-id");
	if (!eventId) {
		return new NextResponse("missing x-patreon-event-id", { status: 400 });
	}

	let parsed: Awaited<ReturnType<typeof parseWebhookRequest>>;
	try {
		parsed = await parseWebhookRequest(req, secret);
	} catch (e) {
		console.error("[patreon/webhook] parse failed", e);
		return new NextResponse("invalid request", { status: 400 });
	}

	if (!parsed.verified) {
		// Signature invalide → vraie 401 (caller frauduleux). Patreon n'envoie
		// que des messages signés, donc une 401 ici n'arrive jamais en runtime
		// normal et ne déclenchera pas la désactivation.
		return new NextResponse("invalid signature", { status: 401 });
	}

	const trigger = parsed.event as PatreonTrigger;
	const payload = parsed.payload as unknown as PatreonWebhookPayload;
	const supabase = createAdminClient();

	if (!supabase) {
		// Pas de DB → on log mais on rentre 200 quand même pour ne pas se faire
		// désactiver. Patreon réenverra l'event manuellement via dashboard si
		// l'admin le veut.
		console.error("[patreon/webhook] no admin supabase client");
		return NextResponse.json({ ok: true, deferred: true });
	}

	const nowIso = new Date().toISOString();

	// Idempotence : déjà 'done' OU 'pending' (en vol) → no-op, ack 200.
	// Le check pending évite qu'un retry Patreon rapide ne lance un 2e
	// processPatreonEvent() en parallèle (double-crédit / double webhook).
	const { data: existing } = await supabase
		.from("patreon_webhook_events")
		.select("id, status")
		.eq("id", eventId)
		.maybeSingle();
	const existingStatus = (existing as { status?: string } | null)?.status;
	if (existingStatus === "done" || existingStatus === "pending") {
		await heartbeat(supabase, { eventId, trigger, success: true });
		return NextResponse.json({
			deduped: true,
			status: existingStatus,
			ok: true,
		});
	}

	// Audit trail : stocke le payload tel que parsé.
	await supabase
		.from("patreon_webhook_events")
		.upsert(
			{
				id: eventId,
				trigger,
				payload: payload as unknown as Record<string, unknown>,
				signature_valid: true,
				status: "pending",
				received_at: nowIso,
			},
			{ onConflict: "id" },
		)
		.then((res) => {
			if (res.error) {
				console.error("[patreon/webhook] insert audit failed", res.error);
			}
		});

	// Process — tolérant aux erreurs : on log mais on ack toujours 200.
	let success = true;
	let errorDetail: string | null = null;
	try {
		await processPatreonEvent(payload, trigger);
	} catch (e) {
		success = false;
		errorDetail = e instanceof Error ? e.message : String(e);
		console.error("[patreon/webhook] process failed", trigger, eventId, e);
	}

	await Promise.all([
		supabase
			.from("patreon_webhook_events")
			.update({
				processed_at: nowIso,
				status: success ? "done" : "failed",
				error: errorDetail,
			})
			.eq("id", eventId),
		heartbeat(supabase, { eventId, trigger, success }),
	]);

	// Critique : on rentre 200 même quand le processing interne a échoué.
	// Patreon ne doit JAMAIS désactiver le webhook à cause d'une erreur métier
	// chez nous (qu'on peut rejouer plus tard via /admin/patreon/replay-event).
	return NextResponse.json({ ok: true, processed: success });
}

/**
 * Met à jour le single-row `patreon_webhook_state` à chaque event valide.
 * Utilise la RPC atomique `patreon_heartbeat` (INSERT...ON CONFLICT côté PG)
 * pour éviter la race condition lost-update quand 2+ webhooks arrivent
 * concurremment (Patreon peut envoyer 5+ events en burst).
 */
async function heartbeat(
	supabase: NonNullable<ReturnType<typeof createAdminClient>>,
	opts: { eventId: string; trigger: PatreonTrigger; success: boolean },
): Promise<void> {
	const { error } = await supabase.rpc("patreon_heartbeat", {
		p_event_id: opts.eventId,
		p_trigger: opts.trigger,
		p_success: opts.success,
	});
	if (error) {
		console.error("[patreon/webhook] heartbeat rpc failed", error);
	}
}

/**
 * GET : healthcheck léger (utile pour Patreon "Send Test" qui n'envoie qu'un
 * POST signé, mais aussi pour pinger nous-même depuis le cron).
 */
export async function GET() {
	const supabase = createAdminClient();
	if (!supabase) {
		return NextResponse.json({ ok: false, reason: "no_db" }, { status: 200 });
	}
	const { data } = await supabase
		.from("patreon_webhook_state")
		.select(
			"last_received_at, last_event_id, last_trigger, total_received, total_failed, paused, num_consecutive_times_failed",
		)
		.eq("id", 1)
		.maybeSingle();
	return NextResponse.json({ ok: true, state: data ?? null });
}
