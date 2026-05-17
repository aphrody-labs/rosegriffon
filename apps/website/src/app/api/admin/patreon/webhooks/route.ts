import { QueryBuilder } from "@rose-griffon/patreon-bun";
import { NextResponse } from "next/server";

import { requireApiPatreonCreator } from "@/lib/api-auth";
import { getCreatorClient } from "@/lib/patreon/client";
import {
	ensureFreshAccessToken,
	loadCreatorTokens,
} from "@/lib/patreon/export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface WebhookAttrs {
	uri?: string;
	triggers?: string[];
	paused?: boolean;
	last_attempted_at?: string | null;
	num_consecutive_times_failed?: number;
}

interface WebhookResource {
	id: string;
	type: "webhook";
	attributes?: WebhookAttrs;
}

interface WebhooksPayload {
	data?: WebhookResource[];
}

export async function GET() {
	const auth = await requireApiPatreonCreator();
	if (!auth.ok) return auth.response;

	let tokens;
	try {
		tokens = await loadCreatorTokens();
		tokens = await ensureFreshAccessToken(tokens);
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return NextResponse.json(
			{
				ok: false,
				error: "Lier le compte créateur Patreon d'abord.",
				detail: msg,
			},
			{ status: 400 },
		);
	}

	try {
		const client = getCreatorClient(tokens.accessToken);
		const query = QueryBuilder.webhooks.setAttributes({
			webhook: [
				"uri",
				"triggers",
				"paused",
				"last_attempted_at",
				"num_consecutive_times_failed",
			],
		});

		// `client.webhooks.fetchWebhooks` retourne le payload JSON:API brut.
		const res = (await client.webhooks.fetchWebhooks(
			query as never,
		)) as unknown as WebhooksPayload;

		const list = Array.isArray(res?.data) ? res.data : [];
		return NextResponse.json({
			ok: true,
			webhooks: list.map((w) => ({
				id: w.id,
				...(w.attributes ?? {}),
			})),
		});
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		console.error("[admin/patreon/webhooks] fetch failed", e);
		return NextResponse.json({ ok: false, error: msg }, { status: 500 });
	}
}
