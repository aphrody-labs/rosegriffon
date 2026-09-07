import { Client } from "@aphrody/discordx";
import type { TextChannel } from "discord.js";
import { EmbedBuilder } from "discord.js";

import { coreManagerConfig } from "@/configs";
import { Service } from "@/decorators";
import { Data, Rank, User } from "@/entities";
import { MatchMode } from "@/utils/enums";

import { Database } from "./Database";

/** Au-delà de ce nombre de promotions détectées en une passe, on suspecte une anomalie
 *  (ex. reset/snapshot corrompu) et on ré-initialise sans rien annoncer (anti-spam). */
const MAX_PROMOTIONS_PER_PASS = 10;

/**
 * Détecte les montées de palier (1v1) entre deux passes et :
 *  - annonce dans 🚨・annonces-ranked (#2)
 *  - félicite dans 💬・général-ranked (#4)
 * Lecture seule sur user_elo + snapshot persistant (Data). Au premier passage, on
 * initialise le snapshot sans annoncer pour éviter un flot de fausses promotions.
 */
@Service()
export class RankedPromotionService {
	private timer: ReturnType<typeof setInterval> | null = null;

	constructor(
		private db: Database,
		private client: Client
	) {}

	start(): void {
		if (this.timer) return;
		void this.detect();
		this.timer = setInterval(() => void this.detect(), 10 * 60_000);
	}

	async detect(): Promise<void> {
		try {
			const em = this.db.em.fork();
			const ranks = (await em.find(Rank, {})).sort((a, b) => a.minElo - b.minElo);
			if (!ranks.length) return;
			const tierIndexOf = (elo: number): number => {
				const i = ranks.findIndex((r) => elo >= r.minElo && elo <= r.maxElo);
				return i === -1 ? 0 : i;
			};

			// joueurs 1v1 ayant disputé au moins une partie
			const rows = await em.execute<{ user_id: string; elo: number }[]>(
				`SELECT user_id, elo FROM user_elo WHERE mode = ? AND games_played > 0`,
				[MatchMode.ONE_VS_ONE],
				"all"
			);

			const store = this.db.get(Data);
			let snapshot: Record<string, number> = {};
			try {
				snapshot = (await store.get("rankedTierSnapshot")) ?? {};
			} catch {
				snapshot = {};
			}

			const next: Record<string, number> = {};
			const promotions: { userId: string; toIndex: number }[] = [];
			for (const row of rows) {
				const idx = tierIndexOf(Number(row.elo));
				next[row.user_id] = idx;
				const prev = snapshot[row.user_id];
				if (prev !== undefined && idx > prev)
					promotions.push({ userId: row.user_id, toIndex: idx });
			}

			const firstRun = Object.keys(snapshot).length === 0;
			await store.set("rankedTierSnapshot", next);

			if (firstRun) {
				console.info(
					`[ranked-promotion] snapshot initial (${rows.length} joueurs) — aucune annonce`
				);
				return;
			}
			if (!promotions.length) return;
			if (promotions.length > MAX_PROMOTIONS_PER_PASS) {
				console.warn(
					`[ranked-promotion] ${promotions.length} promotions en une passe → anomalie suspectée, annonces sautées`
				);
				return;
			}

			// noms des promus
			const ids = promotions.map((p) => p.userId);
			const users = await em.find(User, { id: { $in: ids } });
			const nameOf = new Map(users.map((u) => [u.id, u.displayName || u.username || "Joueur"]));

			await this.announce(promotions, ranks, nameOf);
		} catch (e) {
			console.error("[ranked-promotion] detect KO", e);
		}
	}

	private async announce(
		promotions: { userId: string; toIndex: number }[],
		ranks: Rank[],
		nameOf: Map<string, string>
	): Promise<void> {
		const tierEmoji = (r: Rank): string =>
			r.emojiId ? `<:${r.emojiKey || r.key}:${r.emojiId}> ` : "";

		// #2 — annonce groupée dans 🚨・annonces-ranked
		const annId = coreManagerConfig.rankedAnnouncementsChannelId;
		if (annId) {
			const lines = promotions.map((p) => {
				const r = ranks[p.toIndex];
				return `${tierEmoji(r)}**${nameOf.get(p.userId) ?? "Joueur"}** accède au palier **${r.key}**`;
			});
			const embed = new EmbedBuilder()
				.setTitle("🎉 Promotions de palier")
				.setDescription(lines.join("\n"))
				.setColor(0xf1c40f);
			await this.send(annId, { embeds: [embed] });
		}

		// #4 — félicitations (mentions) dans 💬・général-ranked
		const genId = coreManagerConfig.generalRankedChannelId;
		if (genId) {
			const mentions = promotions.map((p) => `<@${p.userId}>`).join(" ");
			await this.send(genId, {
				content: `👏 Félicitations ${mentions} pour votre montée de palier !`,
				allowedMentions: { users: promotions.map((p) => p.userId) },
			});
		}
	}

	private async send(channelId: string, payload: object): Promise<void> {
		const channel = (await this.client.channels
			.fetch(channelId)
			.catch(() => null)) as TextChannel | null;
		if (!channel || typeof channel.send !== "function") return;
		await channel.send(payload as Parameters<TextChannel["send"]>[0]).catch((e) => {
			console.error(`[ranked-promotion] envoi ${channelId} KO`, e);
		});
	}
}
