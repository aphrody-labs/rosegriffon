import "reflect-metadata";
import { Client } from "@rpbey/discordx";
import { IntentsBitField, Partials } from "discord.js";

import "./commands/sync.ts";
import "./commands/staff.ts";
import "./commands/profil.ts";
import "./commands/event.ts";
import "./commands/chronique.ts";
import "./commands/member.ts";
// `azalee` et `planning` existaient dans src/commands mais n'étaient importées
// nulle part : elles n'étaient donc jamais enregistrées auprès de Discord,
// alors que le README les annonce. Elles s'appuient sur `articles` et
// `stream_schedules`, deux tables bien présentes en base.
import "./commands/azalee.ts";
import "./commands/planning.ts";
import "./commands/admin/stats.ts";
import "./commands/admin/user.ts";
import "./commands/admin/article.ts";
import "./commands/admin/event.ts";
import "./commands/admin/stream.ts";
import "./commands/admin/settings.ts";
import "./commands/admin/team.ts";
import "./events/ready.ts";
import "./events/memberEvents.ts";
import { DISCORD_TOKEN, GUILD_ID } from "./lib/config";

// Intents minimaux. `GuildPresences` (privilégié) a été retiré : le bot ne lit
// aucune présence — c'est `rg-cron.service` qui tient la télémétrie. Le garder
// faisait transiter les mises à jour de présence des ~1984 membres pour rien.
// `GuildMembers` reste nécessaire à `guild.members.fetch()` (/sync, /member).
const client = new Client({
	intents: [IntentsBitField.Flags.Guilds, IntentsBitField.Flags.GuildMembers],
	partials: [Partials.GuildMember, Partials.User],
	silent: false,
	botGuilds: GUILD_ID ? [GUILD_ID] : undefined,
});

client.once("ready", async () => {
	try {
		await client.initApplicationCommands();
	} catch (err) {
		console.error("✗ initApplicationCommands failed:", err instanceof Error ? err.message : err);
	}
	console.log(`✓ Logged in as ${client.user?.tag}`);
});

client.on("interactionCreate", async (interaction) => {
	try {
		await client.executeInteraction(interaction);
	} catch (err) {
		console.error(
			"✗ executeInteraction threw:",
			err instanceof Error ? (err.stack ?? err.message) : err
		);
	}

	if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
		try {
			await interaction.reply({
				content:
					"Commande inconnue ou expirée. Recharge Discord (Ctrl+R) pour rafraîchir la liste.",
				flags: 64,
			});
		} catch {
			// interaction expirée côté Discord
		}
	}
});

await client.login(DISCORD_TOKEN);
