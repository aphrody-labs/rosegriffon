/**
 * `/tweets` — l'archive de la veille X (13 000 posts) dans Discord.
 *
 *  - `/tweets liste`  : navigation paginée, filtrable, ouverte à tous ;
 *  - `/tweets voir`   : un post précis, avec son image et ses métriques ;
 *  - `/tweets suivi`  : état de la notification (staff) ;
 *  - `/tweets regler` : pilotage de la notification (admin) ;
 *  - `/tweets test`   : simulation d'un drain, sans publier ni bouger le curseur.
 *
 * Le rendu reste en EMBEDS : la couche canvas du bot appartient à un autre
 * chantier et n'est pas touchée ici.
 */
import { ButtonComponent, Discord, Slash, SlashGroup, SlashOption } from "@rpbey/discordx";
import {
	ActionRowBuilder,
	ApplicationCommandOptionType,
	ButtonBuilder,
	ButtonStyle,
	MessageFlags,
	type AutocompleteInteraction,
	type ButtonInteraction,
	type ChatInputCommandInteraction,
	type InteractionEditReplyOptions,
} from "discord.js";

import { logAdminAction } from "../lib/audit";
import { rgEmbed, truncate } from "../lib/embeds";
import { withRgAdmin } from "../lib/rbac";
import {
	bornerPage,
	decoderEtatListe,
	encoderEtatListe,
	formaterMetriques,
	horodatageDiscord,
	imagesTweet,
	ligneListe,
	nombreDePages,
	corpsTweet,
	urlTweet,
	type EtatListeTweets,
	type FiltreTweets,
} from "../lib/tweets-format";
import {
	auteursConnus,
	categoriesConnues,
	ecrireFiltreNotification,
	lireCurseur,
	lireFiltreNotification,
	lireTweet,
	listerTweets,
} from "../services/tweets";
import { drainerTweets, resoudreSalon } from "../services/tweetsNotifier";

const PAR_PAGE = 5;

/** Construit la réponse (embed + boutons) d'une page de liste. */
async function rendrePage(etat: EtatListeTweets): Promise<InteractionEditReplyOptions> {
	const premier = await listerTweets({
		auteur: etat.auteur,
		categorie: etat.categorie,
		recherche: etat.recherche,
		page: etat.page,
		parPage: PAR_PAGE,
	});
	// Une page demandée au-delà de la dernière ne doit pas répondre « vide » :
	// on la ramène dans les bornes et on relit.
	const page = bornerPage(etat.page, premier.total, PAR_PAGE);
	const resultat =
		page === premier.page
			? premier
			: await listerTweets({
					auteur: etat.auteur,
					categorie: etat.categorie,
					recherche: etat.recherche,
					page,
					parPage: PAR_PAGE,
				});

	const criteres = [
		etat.auteur ? `@${etat.auteur}` : null,
		etat.categorie,
		etat.recherche ? `« ${etat.recherche} »` : null,
	]
		.filter(Boolean)
		.join(" · ");
	const pages = nombreDePages(resultat.total, PAR_PAGE);

	const embed = rgEmbed()
		.setTitle(`Veille X — ${resultat.total.toLocaleString("fr-FR")} post${resultat.total > 1 ? "s" : ""}`)
		.setURL("https://rosegriffon.fr/iergday");
	if (criteres.length > 0) {
		embed.setAuthor({ name: `Filtres : ${truncate(criteres, 200)}` });
	}
	if (resultat.lignes.length === 0) {
		embed.setDescription("Aucun post ne correspond.");
	} else {
		embed.setDescription(resultat.lignes.map((tweet) => ligneListe(tweet)).join("\n\n"));
		embed.setFooter({ text: `Page ${page}/${pages} · rosegriffon.fr` });
	}

	const composants: Array<ActionRowBuilder<ButtonBuilder>> = [];
	const idPrecedent = encoderEtatListe({ ...etat, page: page - 1 });
	const idSuivant = encoderEtatListe({ ...etat, page: page + 1 });
	if (pages > 1 && idPrecedent && idSuivant) {
		composants.push(
			new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder()
					.setCustomId(idPrecedent)
					.setLabel("Précédent")
					.setStyle(ButtonStyle.Secondary)
					.setDisabled(page <= 1),
				new ButtonBuilder()
					.setCustomId(idSuivant)
					.setLabel("Suivant")
					.setStyle(ButtonStyle.Secondary)
					.setDisabled(page >= pages)
			)
		);
	}
	return { embeds: [embed], components: composants };
}

/** Salon réellement utilisé par le drain : le réglage, sinon la variable d'env. */
function salonEffectif(filtre: FiltreTweets): string | null {
	return filtre.salon ?? Bun.env.DISCORD_NEWS_CHANNEL_ID ?? null;
}

/** Résumé lisible d'un réglage de notification. */
function decrireFiltre(filtre: FiltreTweets): string {
	const salon = salonEffectif(filtre);
	return [
		`État : **${filtre.actif ? "actif" : "coupé"}**`,
		`Comptes suivis (${filtre.comptes.length}) : ${
			filtre.comptes.length > 0 ? filtre.comptes.map((c) => `@${c}`).join(", ") : "*aucun*"
		}`,
		`Catégories exclues : ${
			filtre.categories_exclues.length > 0 ? filtre.categories_exclues.join(", ") : "*aucune*"
		} (+ leak, exclu en dur)`,
		`Lot détaillé au maximum : **${filtre.max_par_lot}** posts (au-delà : un embed de synthèse)`,
		// Afficher « DISCORD_NEWS_CHANNEL_ID » se lisait comme « c'est configuré »
		// alors que la variable peut pointer sur un salon que le bot ne voit pas.
		salon ? `Salon : <#${salon}> (\`${salon}\`)` : "Salon : **aucun** (ni réglage, ni `DISCORD_NEWS_CHANNEL_ID`)",
	].join("\n");
}

@Discord()
@SlashGroup({ name: "tweets", description: "Veille X : archive des posts et notification" })
@SlashGroup("tweets")
export class TweetsCommand {
	@Slash({ name: "liste", description: "Parcourt l'archive des posts X, avec filtres et pages" })
	async liste(
		@SlashOption({
			name: "auteur",
			description: "Compte X (sans @)",
			type: ApplicationCommandOptionType.String,
			required: false,
			autocomplete: async (interaction: AutocompleteInteraction) => {
				try {
					const saisie = String(interaction.options.getFocused() ?? "").toLowerCase();
					const auteurs = await auteursConnus();
					await interaction.respond(
						auteurs
							.filter((a) => a.toLowerCase().includes(saisie))
							.slice(0, 25)
							.map((a) => ({ name: `@${a}`, value: a }))
					);
				} catch {
					await interaction.respond([]);
				}
			},
		})
		auteur: string | undefined,
		@SlashOption({
			name: "categorie",
			description: "Catégorie (news, patch-note, media…)",
			type: ApplicationCommandOptionType.String,
			required: false,
			autocomplete: async (interaction: AutocompleteInteraction) => {
				try {
					const saisie = String(interaction.options.getFocused() ?? "").toLowerCase();
					const categories = await categoriesConnues();
					await interaction.respond(
						categories
							.filter((c) => c.toLowerCase().includes(saisie))
							.slice(0, 25)
							.map((c) => ({ name: c, value: c }))
					);
				} catch {
					await interaction.respond([]);
				}
			},
		})
		categorie: string | undefined,
		@SlashOption({
			name: "recherche",
			description: "Texte à chercher (texte original ET traduction)",
			type: ApplicationCommandOptionType.String,
			required: false,
		})
		recherche: string | undefined,
		@SlashOption({
			name: "page",
			description: "Numéro de page",
			type: ApplicationCommandOptionType.Integer,
			required: false,
			minValue: 1,
		})
		page: number | undefined,
		interaction: ChatInputCommandInteraction
	) {
		await interaction.deferReply();
		try {
			const reponse = await rendrePage({
				page: page ?? 1,
				auteur: auteur ?? null,
				categorie: categorie ?? null,
				recherche: recherche ?? null,
			});
			await interaction.editReply(reponse);
		} catch (err) {
			await interaction.editReply({
				content: `❌ ${err instanceof Error ? err.message : String(err)}`,
			});
		}
	}

	/**
	 * Boutons de pagination. Tout l'état tient dans le `customId` : aucune
	 * mémoire de processus à conserver, donc un redémarrage du bot ne laisse
	 * jamais de boutons morts.
	 */
	@ButtonComponent({ id: /^tw\|/ })
	async paginer(interaction: ButtonInteraction) {
		const etat = decoderEtatListe(interaction.customId);
		if (!etat) {
			await interaction.reply({ content: "Pagination illisible.", flags: MessageFlags.Ephemeral });
			return;
		}
		await interaction.deferUpdate();
		try {
			await interaction.editReply(await rendrePage(etat));
		} catch (err) {
			await interaction.followUp({
				content: `❌ ${err instanceof Error ? err.message : String(err)}`,
				flags: MessageFlags.Ephemeral,
			});
		}
	}

	@Slash({ name: "voir", description: "Affiche un post précis (image, traduction, métriques)" })
	async voir(
		@SlashOption({
			name: "id",
			description: "Identifiant du post X",
			type: ApplicationCommandOptionType.String,
			required: true,
		})
		id: string,
		interaction: ChatInputCommandInteraction
	) {
		await interaction.deferReply();
		try {
			const tweet = await lireTweet(id.trim());
			if (!tweet) {
				await interaction.editReply({ content: `Aucun post archivé sous l'identifiant \`${truncate(id, 40)}\`.` });
				return;
			}
			const embed = rgEmbed()
				.setTitle(
					tweet.author_username ? `@${tweet.author_username}` : "Post X"
				)
				.setURL(urlTweet(tweet))
				.setDescription(corpsTweet(tweet, 1_500));
			const images = imagesTweet(tweet.media);
			if (images[0]) {
				embed.setImage(images[0].url);
			}
			const metriques = formaterMetriques(tweet.metrics);
			if (metriques) {
				embed.addFields({ name: "Portée", value: metriques });
			}
			embed.addFields({
				name: "Publié",
				value: horodatageDiscord(tweet),
				inline: true,
			});
			if (tweet.category) {
				embed.addFields({ name: "Catégorie", value: tweet.category, inline: true });
			}
			await interaction.editReply({ embeds: [embed] });
		} catch (err) {
			await interaction.editReply({
				content: `❌ ${err instanceof Error ? err.message : String(err)}`,
			});
		}
	}

	@Slash({ name: "suivi", description: "État de la notification des nouveaux posts (staff)" })
	async suivi(interaction: ChatInputCommandInteraction) {
		await withRgAdmin(async (_admin, i) => {
			await i.deferReply({ flags: MessageFlags.Ephemeral });
			const [filtre, curseur] = await Promise.all([lireFiltreNotification(), lireCurseur()]);
			const embed = rgEmbed()
				.setTitle("Notification des nouveaux posts X")
				.setDescription(decrireFiltre(filtre))
				.addFields({
					name: "Curseur",
					value: curseur
						? `Position : <t:${Math.floor(curseur.curseurLe.getTime() / 1000)}:f>\n` +
							`Dernier post consommé : \`${curseur.dernierTweetId ?? "—"}\`\n` +
							// Le compteur additionne des POSTS annoncés, pas des messages :
							// un lot résumé en compte autant qu'il contient de posts.
							`Posts annoncés (cumul) : **${curseur.annonces}**`
						: "Jamais amorcé — il sera créé à `now()` au prochain drain, sans rejouer l'archive.",
				});

			// Le salon est le point de panne n°1 : une variable d'env définie ne dit
			// rien des droits du bot dessus. On vérifie, ici, en direct.
			const salonId = salonEffectif(filtre);
			if (salonId) {
				const { salon, raison } = await resoudreSalon(i.client, salonId);
				embed.addFields({
					name: "Salon de destination",
					value: salon
						? `✓ <#${salonId}> — le bot peut y écrire.`
						: `⚠ ${truncate(raison ?? "injoignable", 900)}`,
				});
			}
			await i.editReply({ embeds: [embed] });
		})(interaction);
	}

	@Slash({ name: "regler", description: "Pilote la notification sans redéployer (admin)" })
	async regler(
		@SlashOption({
			name: "actif",
			description: "Allume ou coupe la notification",
			type: ApplicationCommandOptionType.Boolean,
			required: false,
		})
		actif: boolean | undefined,
		@SlashOption({
			name: "salon",
			description: "Salon de destination",
			type: ApplicationCommandOptionType.Channel,
			required: false,
		})
		salon: { id: string } | undefined,
		@SlashOption({
			name: "max",
			description: "Posts détaillés au maximum par lot (au-delà : un résumé)",
			type: ApplicationCommandOptionType.Integer,
			required: false,
			minValue: 1,
			maxValue: 10,
		})
		max: number | undefined,
		@SlashOption({
			name: "ajouter",
			description: "Compte X à suivre (sans @)",
			type: ApplicationCommandOptionType.String,
			required: false,
		})
		ajouter: string | undefined,
		@SlashOption({
			name: "retirer",
			description: "Compte X à ne plus suivre (sans @)",
			type: ApplicationCommandOptionType.String,
			required: false,
		})
		retirer: string | undefined,
		interaction: ChatInputCommandInteraction
	) {
		await withRgAdmin(
			async (admin, i) => {
				await i.deferReply({ flags: MessageFlags.Ephemeral });
				const avant = await lireFiltreNotification();
				let comptes = [...avant.comptes];
				if (ajouter) {
					const propre = ajouter.trim().replace(/^@/, "");
					if (propre.length > 0 && !comptes.some((c) => c.toLowerCase() === propre.toLowerCase())) {
						comptes.push(propre);
					}
				}
				if (retirer) {
					const propre = retirer.trim().replace(/^@/, "").toLowerCase();
					comptes = comptes.filter((c) => c.toLowerCase() !== propre);
				}

				// Vérifier le salon AVANT d'enregistrer : accepter un salon que le bot
				// ne voit pas, c'est promettre une notification qui n'arrivera jamais
				// et qui ne se signalera que dans le journal du service.
				if (salon) {
					const { salon: joignable, raison } = await resoudreSalon(i.client, salon.id);
					if (!joignable) {
						await i.editReply({
							content: `❌ Réglage non enregistré. ${truncate(raison ?? "Salon injoignable.", 1_500)}`,
						});
						return;
					}
				}

				const patch = {
					...(actif === undefined ? {} : { actif }),
					...(salon ? { salon: salon.id } : {}),
					...(max === undefined ? {} : { max_par_lot: max }),
					comptes,
				};
				await logAdminAction({
					adminId: admin.profileId,
					discordId: admin.discordId,
					action: "tweets.regler",
					targetType: "settings",
					targetId: "tweets.notification",
					details: { avant, patch },
				});
				const apres = await ecrireFiltreNotification(patch);
				await i.editReply({
					embeds: [rgEmbed().setTitle("Notification mise à jour").setDescription(decrireFiltre(apres))],
				});
			},
			{ strict: true }
		)(interaction);
	}

	@Slash({
		name: "test",
		description: "Simule un drain : ce qui SERAIT annoncé, sans publier ni avancer le curseur (admin)",
	})
	async test(interaction: ChatInputCommandInteraction) {
		await withRgAdmin(
			async (admin, i) => {
				await i.deferReply({ flags: MessageFlags.Ephemeral });
				await logAdminAction({
					adminId: admin.profileId,
					discordId: admin.discordId,
					action: "tweets.test",
					targetType: "tweets",
					targetId: "drain",
				});
				const resultat = await drainerTweets(i.client, { simulation: true });
				const explications: Record<string, string> = {
					inactif: "La notification est coupée (`actif: false`).",
					amorce: "Aucun curseur en base — il sera créé à `now()` au premier drain réel.",
					rien: "Aucun post nouveau au-delà du curseur.",
					publie: "Des posts seraient annoncés en détail.",
					resume: "Le lot dépasse le seuil : un seul embed de synthèse serait publié.",
					"sans-salon": "Aucun salon de destination joignable.",
					concurrent: "Un drain est déjà en cours.",
					echec: "Le drain a échoué (voir le détail).",
				};
				const detail = resultat.detail ? `\n${resultat.detail}` : "";
				await i.editReply({
					content: `**Simulation** — ${explications[resultat.etat] ?? resultat.etat}\nCandidats : **${resultat.candidats}** · retenus : **${resultat.publies}**${detail}\n\nAucun message n'a été publié et le curseur n'a pas bougé.`,
				});
			},
			{ strict: true }
		)(interaction);
	}
}
