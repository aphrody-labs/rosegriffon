import { Discord, Once } from "@rpbey/discordx";
import type { Client } from "discord.js";

import { syncAllMembers } from "../services/syncMembers.ts";
import { syncStaffPhotos } from "../services/teamPhotos.ts";
import { GUILD_ID, SYNC_INTERVAL_MS } from "../lib/config.ts";

@Discord()
export class ReadyEvent {
	@Once({ event: "ready" })
	async ready([client]: [Client]) {
		console.log(`✓ Ready as ${client.user?.tag} — ${client.guilds.cache.size} guild(s)`);

		this.startAnnouncementServer(client);

		if (!GUILD_ID) {
			console.warn("⚠ GUILD_ID not set — skipping member sync");
			return;
		}

		const guild = client.guilds.cache.get(GUILD_ID);
		if (!guild) {
			console.warn(`⚠ Bot is not in guild ${GUILD_ID}`);
			return;
		}

		await this.runSync(guild.id, client);
		setInterval(() => {
			void this.runSync(guild.id, client);
		}, SYNC_INTERVAL_MS);
	}

	private startAnnouncementServer(client: Client) {
		const port = 3006;
		const secret = Bun.env.DISCORD_ANNOUNCE_SECRET || "default-secret-key-12345";

		Bun.serve({
			port,
			async fetch(req) {
				const url = new URL(req.url);
				if (req.method !== "POST" || url.pathname !== "/announce") {
					return new Response("Not Found", { status: 404 });
				}

				// Check Authorization
				const authHeader = req.headers.get("Authorization");
				if (!authHeader || authHeader !== `Bearer ${secret}`) {
					return new Response("Unauthorized", { status: 401 });
				}

				try {
					const body = (await req.json()) as {
						type?: string;
						title?: string;
						slug?: string;
						excerpt?: string;
						featured_image_url?: string;
					};
					const { type, title, slug, excerpt, featured_image_url } = body;

					if (!title || !slug) {
						return new Response("Missing title or slug", { status: 400 });
					}

					// Find Guild
					const guild = client.guilds.cache.get(GUILD_ID || "");
					if (!guild) {
						console.error("[announce-server] Guild non trouvé:", GUILD_ID);
						return new Response("Guild not found", { status: 500 });
					}

					// Resolve Channel ID
					const channelId = type === "wiki"
						? (Bun.env.DISCORD_WIKI_ANNOUNCEMENTS_CHANNEL_ID || Bun.env.DISCORD_NEWS_CHANNEL_ID)
						: (Bun.env.DISCORD_WEBSITE_ANNOUNCEMENTS_CHANNEL_ID || Bun.env.DISCORD_NEWS_CHANNEL_ID);

					let channel;
					if (channelId) {
						channel = guild.channels.cache.get(channelId);
					}

					if (!channel) {
						// Fallback: search for announcement channels in guild
						const possibleNames = type === "wiki"
							? ["wiki-annonces", "annonces-wiki", "annonces", "📢-annonces"]
							: ["annonces", "📢-annonces", "news", "general"];

						for (const name of possibleNames) {
							channel = guild.channels.cache.find(c => c.name.toLowerCase() === name && c.isTextBased());
							if (channel) break;
						}
					}

					if (!channel || !channel.isTextBased()) {
						console.error("[announce-server] Aucun salon textuel d'annonces trouvé.");
						return new Response("Channel not found", { status: 500 });
					}

					// Build Embed
					const articleUrl = type === "wiki"
						? `https://azalee.rosegriffon.fr/news/${slug}`
						: `https://rosegriffon.fr/chroniques/${slug}`;

					const embedColor = type === "wiki" ? 0xf2a93b : 0xa14b3f; // Azalée orange vs Rose Griffon red

					const embed = {
						title,
						url: articleUrl,
						description: excerpt || undefined,
						color: embedColor,
						image: featured_image_url ? { url: featured_image_url } : undefined,
						footer: { text: type === "wiki" ? "Azalée — Rose Griffon" : "Rose Griffon" },
						timestamp: new Date().toISOString()
					};

					await channel.send({ embeds: [embed] });
					console.log(`[announce-server] Annonce envoyée pour : "${title}" dans le salon #${channel.name}`);
					return new Response(JSON.stringify({ success: true }), {
						headers: { "Content-Type": "application/json" }
					});
				} catch (err) {
					console.error("[announce-server] Erreur lors de l'annonce:", err);
					return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
						status: 500,
						headers: { "Content-Type": "application/json" }
					});
				}
			}
		});

		console.log(`✓ Announcement HTTP server listening on port ${port}`);
	}

	private async runSync(guildId: string, client: Client): Promise<void> {
		const guild = client.guilds.cache.get(guildId);
		if (!guild) return;
		try {
			const report = await syncAllMembers(guild);
			console.log(
				`[sync] ${report.upserted}/${report.fetched} members upserted in ${report.durationMs}ms` +
					(report.errors.length ? ` — ${report.errors.length} error(s)` : "")
			);
			for (const e of report.errors.slice(0, 5)) {
				console.error(`  ✗ ${e.discordId}: ${e.reason}`);
			}
		} catch (err) {
			console.error("[sync] failed:", err);
		}

		// Sync ciblé staff (team_members) — propage avatar vers 3 tables
		try {
			const photos = await syncStaffPhotos(client);
			console.log(
				`[staff-photos] ${photos.updated}/${photos.total} updated, ${photos.unchanged} unchanged in ${photos.durationMs}ms` +
					(photos.errors.length ? ` — ${photos.errors.length} error(s)` : "")
			);
			for (const e of photos.errors.slice(0, 3)) {
				console.error(`  ✗ ${e.name}: ${e.reason}`);
			}
		} catch (err) {
			console.error("[staff-photos] failed:", err);
		}
	}
}
