/**
 * `/cron` — pilotage de `rg-cron.service` depuis Discord, par la socket UNIX.
 *
 * ── GARDES ─────────────────────────────────────────────────────────────────
 *  - lecture (`taches`, `metriques`, `statut`, `telemetrie`) : admin ou staff ;
 *  - déclenchement : le niveau dépend de la tâche (`lib/cron-taches.ts`) ;
 *  - 4 tâches sont REFUSÉES quoi qu'il arrive (`db`, `crawl`, `github-publish`,
 *    `discord:backfill`) — et le cron revérifie la même liste de son côté : un
 *    garde qui ne vit que chez l'appelant n'est pas un garde.
 *
 * ── HONNÊTETÉ SUR LES TÂCHES LONGUES ───────────────────────────────────────
 * `executeTask` est lancé sans `await` côté cron (c'est déjà le cas pour la
 * route HTTP, qui répond 202). La commande annonce donc « démarrée », JAMAIS
 * « réussie » : le verdict arrive plus tard par l'événement `task.done` sur la
 * connexion d'abonnement, et se relit à la demande avec `/cron statut`.
 */
import { Discord, Slash, SlashGroup, SlashOption } from "@rpbey/discordx";
import {
	ApplicationCommandOptionType,
	MessageFlags,
	type AutocompleteInteraction,
	type ChatInputCommandInteraction,
} from "discord.js";

import { logAdminAction } from "../../lib/audit";
import { appelerCron, CHEMIN_SOCKET_CRON, CronInjoignableError } from "../../lib/cron-ipc";
import { rgEmbed, truncate } from "../../lib/embeds";
import {
	TACHES_CRON,
	niveauTache,
	raisonRefus,
	resoudreTache,
	suggererTaches,
} from "../../lib/cron-taches";
import { NotAdminError, requireRgAdmin, requireRgAdminStrict } from "../../lib/rbac";

interface DerniereExecution {
	time?: string;
	durationMs?: number;
	success?: boolean;
	error?: string;
}

interface MetriquesCron {
	startedAt?: string;
	tasksTriggered?: number;
	tasksSucceeded?: number;
	tasksFailed?: number;
	lastExecution?: Record<string, DerniereExecution>;
}

/** Message d'aide quand la socket n'existe pas encore. */
function messagePontAbsent(err: unknown): string {
	if (err instanceof CronInjoignableError) {
		return (
			`Le pont IPC est injoignable (\`${CHEMIN_SOCKET_CRON}\`).\n` +
			"Il n'existe qu'après un redémarrage de `rg-cron.service` avec le pont branché : " +
			"`sudo systemctl restart rg-cron.service`."
		);
	}
	return err instanceof Error ? err.message : String(err);
}

function formaterExecution(derniere: DerniereExecution | null | undefined): string {
	if (!derniere?.time) {
		return "jamais exécutée depuis le dernier démarrage du démon";
	}
	const horodatage = `<t:${Math.floor(new Date(derniere.time).getTime() / 1000)}:R>`;
	const duree = typeof derniere.durationMs === "number" ? ` en ${derniere.durationMs} ms` : "";
	const verdict = derniere.success ? "succès" : `échec — ${truncate(derniere.error ?? "?", 200)}`;
	return `${horodatage}${duree} · ${verdict}`;
}

@Discord()
@SlashGroup({ name: "cron", description: "Pilotage du démon de tâches rg-cron (staff/admin)" })
@SlashGroup("cron")
export class CronCommand {
	@Slash({ name: "taches", description: "Liste les tâches, leur planification et leur niveau d'accès" })
	async taches(interaction: ChatInputCommandInteraction) {
		try {
			await requireRgAdmin(interaction.user.id);
		} catch (err) {
			await interaction.reply({
				content: `🚫 ${err instanceof NotAdminError ? err.message : "Erreur d'authentification RG"}`,
				flags: MessageFlags.Ephemeral,
			});
			return;
		}
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });
		try {
			const reponse = await appelerCron<{
				success: boolean;
				taches?: string[];
				schedules?: Record<string, string>;
			}>({ cmd: "tasks.list" });
			const planifications = reponse.schedules ?? {};
			const noms = reponse.taches ?? [...TACHES_CRON];
			const symboles: Record<string, string> = {
				interdit: "⛔",
				"admin-strict": "🔒",
				admin: "•",
			};
			const lignes = noms
				.map((nom) => {
					const niveau = niveauTache(nom);
					return `${symboles[niveau] ?? "•"} \`${nom}\` — ${planifications[nom] ?? "manuel"}`;
				})
				.join("\n");
			await interaction.editReply({
				embeds: [
					rgEmbed()
						.setTitle(`rg-cron — ${noms.length} tâches`)
						.setDescription(lignes)
						.setFooter({
							text: "⛔ jamais depuis Discord · 🔒 admin uniquement · • admin ou staff",
						}),
				],
			});
		} catch (err) {
			await interaction.editReply({ content: `❌ ${messagePontAbsent(err)}` });
		}
	}

	@Slash({ name: "metriques", description: "Compteurs d'exécution du démon" })
	async metriques(interaction: ChatInputCommandInteraction) {
		try {
			await requireRgAdmin(interaction.user.id);
		} catch (err) {
			await interaction.reply({
				content: `🚫 ${err instanceof NotAdminError ? err.message : "Erreur d'authentification RG"}`,
				flags: MessageFlags.Ephemeral,
			});
			return;
		}
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });
		try {
			const reponse = await appelerCron<{ success: boolean; metrics?: MetriquesCron }>({
				cmd: "metrics",
			});
			const metriques = reponse.metrics ?? {};
			const dernieres = Object.entries(metriques.lastExecution ?? {})
				.toSorted(([, a], [, b]) => String(b.time ?? "").localeCompare(String(a.time ?? "")))
				.slice(0, 10)
				.map(([nom, execution]) => `\`${nom}\` — ${formaterExecution(execution)}`)
				.join("\n");
			await interaction.editReply({
				embeds: [
					rgEmbed()
						.setTitle("rg-cron — métriques")
						.setDescription(
							[
								`Démarré : ${
									metriques.startedAt
										? `<t:${Math.floor(new Date(metriques.startedAt).getTime() / 1000)}:R>`
										: "?"
								}`,
								`Déclenchées : **${metriques.tasksTriggered ?? 0}** · réussies : **${
									metriques.tasksSucceeded ?? 0
								}** · échouées : **${metriques.tasksFailed ?? 0}**`,
							].join("\n")
						)
						.addFields({
							name: "Dernières exécutions",
							value: dernieres.length > 0 ? truncate(dernieres, 1000) : "aucune",
						}),
				],
			});
		} catch (err) {
			await interaction.editReply({ content: `❌ ${messagePontAbsent(err)}` });
		}
	}

	@Slash({ name: "statut", description: "Dernière exécution d'une tâche : succès, durée, erreur" })
	async statut(
		@SlashOption({
			name: "tache",
			description: "Nom de la tâche",
			type: ApplicationCommandOptionType.String,
			required: true,
			autocomplete: async (interaction: AutocompleteInteraction) => {
				await interaction.respond(
					suggererTaches(String(interaction.options.getFocused() ?? "")).map((nom) => ({
						name: nom,
						value: nom,
					}))
				);
			},
		})
		tache: string,
		interaction: ChatInputCommandInteraction
	) {
		try {
			await requireRgAdmin(interaction.user.id);
		} catch (err) {
			await interaction.reply({
				content: `🚫 ${err instanceof NotAdminError ? err.message : "Erreur d'authentification RG"}`,
				flags: MessageFlags.Ephemeral,
			});
			return;
		}
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });
		const nom = resoudreTache(tache);
		if (!nom) {
			await interaction.editReply({ content: `Tâche « ${truncate(tache, 60)} » inconnue.` });
			return;
		}
		try {
			const reponse = await appelerCron<{
				success: boolean;
				derniere?: DerniereExecution | null;
				enCours?: boolean;
			}>({ cmd: "task.status", nom });
			await interaction.editReply({
				embeds: [
					rgEmbed()
						.setTitle(`Tâche \`${nom}\``)
						.setDescription(
							[
								`Niveau d'accès : **${niveauTache(nom)}**`,
								`En cours : **${reponse.enCours ? "oui" : "non"}**`,
								`Dernière exécution : ${formaterExecution(reponse.derniere)}`,
							].join("\n")
						),
				],
			});
		} catch (err) {
			await interaction.editReply({ content: `❌ ${messagePontAbsent(err)}` });
		}
	}

	@Slash({ name: "telemetrie", description: "Télémétrie Discord tenue par le démon" })
	async telemetrie(interaction: ChatInputCommandInteraction) {
		try {
			await requireRgAdmin(interaction.user.id);
		} catch (err) {
			await interaction.reply({
				content: `🚫 ${err instanceof NotAdminError ? err.message : "Erreur d'authentification RG"}`,
				flags: MessageFlags.Ephemeral,
			});
			return;
		}
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });
		try {
			const reponse = await appelerCron<{ success: boolean; telemetry?: unknown; error?: string }>({
				cmd: "telemetry.discord",
			});
			if (!reponse.success) {
				await interaction.editReply({ content: `❌ ${reponse.error ?? "Télémétrie indisponible."}` });
				return;
			}
			await interaction.editReply({
				embeds: [
					rgEmbed()
						.setTitle("Télémétrie Discord (rg-cron)")
						.setDescription(
							`\`\`\`json\n${truncate(JSON.stringify(reponse.telemetry, null, 2), 1_500)}\n\`\`\``
						),
				],
			});
		} catch (err) {
			await interaction.editReply({ content: `❌ ${messagePontAbsent(err)}` });
		}
	}

	/**
	 * Annonce manuelle d'un article.
	 *
	 * Publiée par le BOT, pas par `POST :3006/announce` : ce chemin hérité est
	 * ouvert sur Internet et son secret retombe sur un littéral écrit dans le
	 * code (`"default-secret-key-12345"`), ce qui permet à n'importe qui de
	 * publier un embed arbitraire dans le salon d'annonces. Tant qu'il n'est pas
	 * refermé, on ne bâtit rien de neuf dessus.
	 */
	@Slash({ name: "annonce", description: "Publie l'annonce d'un article dans le salon dédié (admin)" })
	async annonce(
		@SlashOption({
			name: "type",
			description: "wiki (Azalée) ou website (rosegriffon.fr)",
			type: ApplicationCommandOptionType.String,
			required: true,
			autocomplete: async (interaction: AutocompleteInteraction) => {
				await interaction.respond([
					{ name: "wiki — azalee.rosegriffon.fr", value: "wiki" },
					{ name: "website — rosegriffon.fr", value: "website" },
				]);
			},
		})
		type: string,
		@SlashOption({
			name: "titre",
			description: "Titre de l'article",
			type: ApplicationCommandOptionType.String,
			required: true,
		})
		titre: string,
		@SlashOption({
			name: "slug",
			description: "Slug de l'article",
			type: ApplicationCommandOptionType.String,
			required: true,
		})
		slug: string,
		@SlashOption({
			name: "extrait",
			description: "Chapeau affiché sous le titre",
			type: ApplicationCommandOptionType.String,
			required: false,
		})
		extrait: string | undefined,
		@SlashOption({
			name: "image",
			description: "URL absolue de l'illustration",
			type: ApplicationCommandOptionType.String,
			required: false,
		})
		image: string | undefined,
		interaction: ChatInputCommandInteraction
	) {
		let admin;
		try {
			admin = await requireRgAdminStrict(interaction.user.id);
		} catch (err) {
			await interaction.reply({
				content: `🚫 ${err instanceof NotAdminError ? err.message : "Erreur d'authentification RG"}`,
				flags: MessageFlags.Ephemeral,
			});
			return;
		}
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		const estWiki = type === "wiki";
		const salonId = estWiki
			? (Bun.env.DISCORD_WIKI_ANNOUNCEMENTS_CHANNEL_ID ?? Bun.env.DISCORD_NEWS_CHANNEL_ID)
			: (Bun.env.DISCORD_WEBSITE_ANNOUNCEMENTS_CHANNEL_ID ?? Bun.env.DISCORD_NEWS_CHANNEL_ID);
		if (!salonId) {
			await interaction.editReply({
				content: "❌ Aucun salon d'annonces configuré (`DISCORD_NEWS_CHANNEL_ID`).",
			});
			return;
		}

		const lien = estWiki
			? `https://azalee.rosegriffon.fr/news/${slug}`
			: `https://rosegriffon.fr/chroniques/${slug}`;
		const embed = rgEmbed().setTitle(truncate(titre, 250)).setURL(lien).setTimestamp(new Date());
		if (extrait) {
			embed.setDescription(truncate(extrait, 1_000));
		}
		if (image?.startsWith("https://")) {
			embed.setImage(image);
		}

		try {
			const salon = await interaction.client.channels.fetch(salonId);
			if (!salon?.isSendable()) {
				await interaction.editReply({ content: `❌ Salon ${salonId} injoignable ou non textuel.` });
				return;
			}
			await logAdminAction({
				adminId: admin.profileId,
				discordId: admin.discordId,
				action: "cron.annonce",
				targetType: estWiki ? "article-wiki" : "article-website",
				targetId: slug,
				details: { titre, salonId },
			});
			await salon.send({ embeds: [embed] });
			await interaction.editReply({ content: `✓ Annonce publiée dans <#${salonId}>.` });
		} catch (err) {
			await interaction.editReply({
				content: `❌ ${err instanceof Error ? err.message : String(err)}`,
			});
		}
	}

	@Slash({ name: "lancer", description: "Déclenche une tâche du démon (accès selon la tâche)" })
	async lancer(
		@SlashOption({
			name: "tache",
			description: "Nom de la tâche",
			type: ApplicationCommandOptionType.String,
			required: true,
			autocomplete: async (interaction: AutocompleteInteraction) => {
				// Les tâches interdites ne sont même pas proposées : on ne fait pas
				// miroiter une action qui sera refusée deux fois.
				await interaction.respond(
					suggererTaches(String(interaction.options.getFocused() ?? ""), {
						exclureInterdites: true,
					}).map((nom) => ({ name: nom, value: nom }))
				);
			},
		})
		tache: string,
		interaction: ChatInputCommandInteraction
	) {
		const nom = resoudreTache(tache);
		const niveau = niveauTache(tache);

		if (!nom || niveau === "interdit") {
			await interaction.reply({
				content: `🚫 ${raisonRefus(tache)}`,
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		let admin;
		try {
			admin =
				niveau === "admin-strict"
					? await requireRgAdminStrict(interaction.user.id)
					: await requireRgAdmin(interaction.user.id);
		} catch (err) {
			await interaction.reply({
				content: `🚫 ${err instanceof NotAdminError ? err.message : "Erreur d'authentification RG"}`,
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		await interaction.deferReply();
		// Trace AVANT l'appel : si le cron tombe pendant l'exécution, l'audit
		// garde tout de même qui a demandé quoi.
		await logAdminAction({
			adminId: admin.profileId,
			discordId: admin.discordId,
			action: "cron.lancer",
			targetType: "cron-task",
			targetId: nom,
			details: { niveau },
		});

		try {
			const reponse = await appelerCron<{ success: boolean; error?: string; code?: string }>({
				cmd: "task.run",
				nom,
				discordId: admin.discordId,
				profileId: admin.profileId,
			});
			if (!reponse.success) {
				await interaction.editReply({ content: `❌ ${reponse.error ?? "Refusé par le démon."}` });
				return;
			}
			await interaction.editReply({
				content:
					`▶ Tâche \`${nom}\` **démarrée**. Le démon l'exécute en tâche de fond : ` +
					"le résultat ne sera connu qu'à la fin, lisible avec `/cron statut " +
					`${nom}\`.`,
			});
		} catch (err) {
			await interaction.editReply({ content: `❌ ${messagePontAbsent(err)}` });
		}
	}
}
