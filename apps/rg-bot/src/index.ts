import "reflect-metadata";
import { Client } from "@rpbey/discordx";
import { IntentsBitField, MessageFlags, Partials } from "discord.js";

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
// Veille X (`/tweets`), données de jeu IEVR via `@rosegriffon/azalee` (`/ievr`)
// et pilotage de rg-cron par la socket UNIX (`/cron`).
import "./commands/tweets.ts";
import "./commands/ievr.ts";
import "./commands/admin/cron.ts";
import "./commands/admin/stats.ts";
import "./commands/admin/user.ts";
import "./commands/admin/article.ts";
import "./commands/admin/event.ts";
import "./commands/admin/stream.ts";
import "./commands/admin/settings.ts";
import "./commands/admin/team.ts";
import "./events/ready.ts";
import "./events/memberEvents.ts";
import { closeCache } from "./lib/cache";
import { DISCORD_TOKEN, GUILD_IDS } from "./lib/config";
import { sql } from "./lib/db";
import { demarrerNotifieurTweets } from "./services/tweetsNotifier";

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

/** Coupe le notifieur de tweets (minuteurs + abonnement au pont cron). */
let arreterNotifieur: (() => void) | null = null;

// `clientReady`, pas `ready` : discord.js 14.26 déprécie le second (« The ready
// event has been renamed to clientReady […] and will only emit under that name
// in v15 », WebSocketManager.js). L'écouter émettait un `DeprecationWarning` à
// chaque démarrage et aurait rendu le bot muet en v15. Les deux sont émis à la
// suite dans cette version, la bascule est donc sans effet de bord.
client.once("clientReady", async () => {
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

	// Notification des nouveaux tweets. Démarrée APRÈS `ready` : le drain a
	// besoin d'un client capable de résoudre un salon. Le bot est le SEUL
	// écrivain Discord pour les tweets — rg-cron se contente de signaler.
	// La fonction d'arrêt était jetée : son minuteur de 5 min et sa connexion
	// d'abonnement survivaient donc au `client.destroy()` et retenaient la
	// boucle d'événements (arrêt du service en timeout, puis SIGKILL).
	arreterNotifieur = demarrerNotifieurTweets(client);
});

/**
 * Filet de dernier recours des interactions.
 *
 * Deux situations très différentes arrivaient ici avec le MÊME message :
 *   - la commande n'existe plus côté serveur (client Discord avec une liste
 *     périmée) : `executeInteraction` ne trouve rien et ne répond rien ;
 *   - la commande a levé : le membre lisait « commande inconnue ou expirée »,
 *     un diagnostic faux qui envoyait chercher au mauvais endroit.
 *
 * Et quand la commande avait déjà fait `deferReply()` avant de lever, personne
 * ne reprenait la main : l'interaction restait sur « réfléchit… » pour
 * toujours. `editReply` est le seul chemin possible dans cet état — `reply()`
 * lèverait `InteractionAlreadyReplied`.
 */
client.on("interactionCreate", async (interaction) => {
	let echec: unknown;
	try {
		await client.executeInteraction(interaction);
	} catch (err) {
		echec = err;
		console.error(
			"✗ executeInteraction a levé :",
			err instanceof Error ? (err.stack ?? err.message) : err
		);
	}

	// Une interaction d'autocomplétion n'est pas répondable : elle se sert par
	// `respond()`, et la laisser passer ici lèverait à chaque frappe.
	if (!interaction.isRepliable()) {
		return;
	}

	try {
		if (interaction.replied) {
			// La commande a déjà parlé : ne rien ajouter.
			return;
		}
		if (interaction.deferred) {
			if (echec) {
				await interaction.editReply({
					content: "❌ La commande a échoué. Le détail est dans le journal du service.",
				});
			}
			return;
		}
		await interaction.reply({
			content: echec
				? "❌ La commande a échoué. Le détail est dans le journal du service."
				: "Commande inconnue ou expirée. Recharge Discord (Ctrl+R) pour rafraîchir la liste.",
			flags: MessageFlags.Ephemeral,
		});
	} catch {
		// Jeton d'interaction expiré (3 s pour la première réponse, 15 min ensuite).
	}
});

/**
 * Arrêt propre.
 *
 * `systemctl stop/restart` envoie SIGTERM : sans écouteur, Bun tue le processus
 * en laissant la passerelle Discord se faire couper à chaud (le bot reste
 * affiché « en ligne » plusieurs minutes) et la connexion Postgres ouverte
 * côté serveur jusqu'à son expiration. On coupe donc dans l'ordre : minuteurs,
 * passerelle, cache Redis, pool Postgres.
 */
let arretEnCours = false;

async function arreter(signal: string): Promise<void> {
	if (arretEnCours) {
		return;
	}
	arretEnCours = true;
	console.log(`↔ ${signal} reçu — arrêt propre.`);

	arreterNotifieur?.();
	arreterNotifieur = null;

	try {
		await client.destroy();
	} catch (err) {
		console.error("✗ fermeture de la passerelle Discord :", err instanceof Error ? err.message : err);
	}

	closeCache();

	try {
		// `timeout` en SECONDES : on laisse les requêtes en vol finir, sans jamais
		// bloquer l'arrêt du service au-delà de ce délai.
		await sql.close({ timeout: 5 });
	} catch (err) {
		console.error("✗ fermeture de la connexion Postgres :", err instanceof Error ? err.message : err);
	}

	process.exit(0);
}

process.on("SIGTERM", () => void arreter("SIGTERM"));
process.on("SIGINT", () => void arreter("SIGINT"));

await client.login(DISCORD_TOKEN);
