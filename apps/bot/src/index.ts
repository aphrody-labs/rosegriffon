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
import { DISCORD_TOKEN, GUILD_IDS } from "./lib/config";

// Intents minimaux. `GuildPresences` (privilégié) a été retiré : le bot ne lit
// aucune présence — c'est `rg-cron.service` qui tient la télémétrie. Le garder
// faisait transiter les mises à jour de présence des ~1984 membres pour rien.
// `GuildMembers` reste nécessaire à `guild.members.fetch()` (/sync, /member).
const client = new Client({
	intents: [IntentsBitField.Flags.Guilds, IntentsBitField.Flags.GuildMembers],
	partials: [Partials.GuildMember, Partials.User],
	silent: false,
	// Intersection entre les guildes VOULUES et celles où le bot est réellement
	// présent. Lister en dur une guilde qu'il n'a pas encore rejointe ferait
	// échouer l'enregistrement des commandes (l'API refuse une guilde inconnue)
	// et priverait AUSSI l'autre serveur des siennes. Ici, une guilde pas encore
	// autorisée est simplement ignorée, et prise en compte au redémarrage suivant.
	botGuilds: [(bot: Client) => bot.guilds.cache.map((g) => g.id).filter((id) => GUILD_IDS.includes(id))],
});

client.once("ready", async () => {
	try {
		await client.initApplicationCommands();
	} catch (err) {
		console.error("✗ initApplicationCommands failed:", err instanceof Error ? err.message : err);
	}

	// Dire OÙ les commandes ont atterri, et surtout où elles manquent : un bot en
	// ligne mais sans commande sur un serveur est indiscernable d'un bot en panne
	// pour qui le regarde depuis Discord.
	const servies = client.guilds.cache.filter((g) => GUILD_IDS.includes(g.id));
	const absentes = GUILD_IDS.filter((id) => !client.guilds.cache.has(id));
	console.log(
		`✓ Commandes enregistrées sur ${servies.size} serveur(s) : ${servies.map((g) => g.name).join(", ") || "aucun"}`
	);
	if (absentes.length > 0) {
		console.warn(
			`⚠ Guilde(s) configurée(s) mais non rejointe(s) : ${absentes.join(", ")} — le bot doit y être autorisé via l'URL OAuth2 avant que ses commandes n'y apparaissent.`
		);
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
