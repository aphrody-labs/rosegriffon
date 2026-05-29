import { NextResponse } from "next/server";

// Liste les événements programmés Discord du serveur Rose Griffon.
// Consommé par /evenements (useDiscordEvents.ts).
//
// Implémentation : appel direct REST Discord
// GET https://discord.com/api/v10/guilds/{guild_id}/scheduled-events?with_user_count=true
// Auth : DISCORD_BOT_TOKEN (bot RGB déjà présent dans la guild).
//
// Si DISCORD_BOT_TOKEN ou DISCORD_GUILD_ID manquent, retourne une liste vide
// (le hook caller log une erreur mais l'écran reste utilisable).

export const runtime = "nodejs";
export const revalidate = 300; // 5 min — burst protection vs rate-limit Discord

interface DiscordScheduledEventRaw {
	id: string;
	name: string;
	description: string | null;
	scheduled_start_time: string;
	scheduled_end_time: string | null;
	status: number;
	entity_type: number;
	entity_metadata: { location?: string } | null;
	creator?: {
		id: string;
		username: string;
		avatar: string | null;
	} | null;
	user_count?: number;
	image: string | null;
}

export async function GET() {
	const token = process.env.DISCORD_BOT_TOKEN;
	const guildId = process.env.DISCORD_GUILD_ID || process.env.NEXT_PUBLIC_DISCORD_GUILD_ID;

	if (!token || !guildId) {
		return NextResponse.json({
			data: { events: [] },
			reason: "discord_not_configured",
			success: true,
		});
	}

	try {
		const res = await fetch(
			`https://discord.com/api/v10/guilds/${guildId}/scheduled-events?with_user_count=true`,
			{
				headers: { Authorization: `Bot ${token}` },
				next: { revalidate: 300 },
			}
		);

		if (!res.ok) {
			console.warn(`[discord/scheduled-events] discord api ${res.status} ${res.statusText}`);
			return NextResponse.json({ data: { events: [] }, success: true });
		}

		const raw = (await res.json()) as DiscordScheduledEventRaw[];
		const events = raw.map((e) => ({
			creator: e.creator
				? {
						id: e.creator.id,
						username: e.creator.username,
						avatar: e.creator.avatar ?? "",
					}
				: null,
			description: e.description ?? "",
			entityMetadata: { location: e.entity_metadata?.location },
			entityType: e.entity_type,
			id: e.id,
			image: e.image
				? `https://cdn.discordapp.com/guild-events/${e.id}/${e.image}.png?size=1024`
				: null,
			name: e.name,
			scheduledEndTime: e.scheduled_end_time,
			scheduledStartTime: e.scheduled_start_time,
			status: e.status,
			userCount: e.user_count ?? 0,
		}));

		return NextResponse.json({ data: { events }, success: true });
	} catch (error) {
		console.error("[discord/scheduled-events] fetch failed", error);
		return NextResponse.json({ data: { events: [] }, success: true });
	}
}
