/**
 * `/achillea` — les serveurs scannés par le bot Achillea, vus depuis Rose Griffon.
 *
 * ── CE QUE ÇA BRANCHE ──────────────────────────────────────────────────────
 * Achillea (le serveur compétitif) et Rose Griffon partagent une machine et une
 * communauté, mais pas un dépôt : son bot tient sa propre base et expose une API
 * (`achillea-bot.service`, :4000) dont `GET /guilds` publie les métadonnées, les
 * rôles et les salons de chaque serveur qu'il a rejoint. Rien, jusqu'ici, ne
 * traversait cette frontière : pour connaître les rôles d'Achillea depuis Rose
 * Griffon, il fallait ouvrir Discord et les lire à la main.
 *
 * ── DEUX CHOSES QUI ÉTAIENT CASSÉES, ET QUI NE LE SONT PLUS ────────────────
 *  1. Le contrôleur `/guilds` d'Achillea se disait alimenté par
 *     `scripts/ops/discord/scan-guilds.ts --db` — un script qui n'existait pas.
 *     `guild_role` et `guild_channel` étaient vides, `guild` avait toutes ses
 *     colonnes de scan à NULL, et l'API répondait `{"data":[],"total":0}`. Le
 *     script a été écrit côté Achillea ; le premier scan a relevé 102 rôles et
 *     113 salons.
 *  2. Un serveur jamais scanné répond 200 avec des champs nuls et des listes
 *     vides. La commande le DIT (« jamais scanné, lancez le scan ») au lieu
 *     d'afficher une fiche vide qui ressemblerait à un serveur désert.
 *
 * ── OÙ EST LA LOGIQUE ──────────────────────────────────────────────────────
 * Le transport et la validation sont dans `services/achillea.ts` (schémas Zod :
 * une dérive de l'API d'en face devient une erreur nommée, pas un affichage
 * faux). La mise en forme — types de salons, groupement par catégorie, découpage
 * au budget d'un champ d'embed — est dans `lib/achillea-format.ts`, où elle est
 * testée sans Discord.
 */

import { Discord, Slash, SlashGroup, SlashOption } from "@rpbey/discordx";
import { ApplicationCommandOptionType, type ChatInputCommandInteraction } from "discord.js";

import {
	bloquerLignes,
	compterRolesGeres,
	couleurHex,
	dateScan,
	grouperParCategorie,
	libelleType,
	repartitionParType,
	rolesUtiles,
} from "../lib/achillea-format";
import { differer, echec, fiche, info, piedDeCommande, repondre } from "../lib/ui";
import {
	detailGuilde,
	estScanne,
	statistiquesGuildes,
	type GuildeDetaillee,
	type Resultat,
} from "../services/achillea";

/** Serveur visé par défaut : Achillea, celui pour lequel la passerelle a été ouverte. */
const ACHILLEA = "1055585286320554055";

/**
 * Un échec de la passerelle se raconte par sa cause : ce n'est pas la même chose à
 * réparer, et ce n'est pas le même message pour qui lit.
 */
function messageEchec(raison: "injoignable" | "http" | "forme", detail: string): [string, string] {
	switch (raison) {
		case "injoignable": {
			return [
				"Achillea ne répond pas",
				`Son API est injoignable (${detail}). Vérifiez \`systemctl status achillea-bot\`.`,
			];
		}
		case "http": {
			return ["Achillea a refusé la demande", `${detail}. Le serveur demandé existe-t-il ?`];
		}
		default: {
			return [
				"Réponse inattendue d'Achillea",
				`Son API a changé de forme : ${detail}. Le client de ce dépôt (\`services/achillea.ts\`) doit être mis à jour.`,
			];
		}
	}
}

/** Résout l'identifiant : celui donné, sinon le serveur courant, sinon Achillea. */
function serveurVise(saisi: string | undefined, interaction: ChatInputCommandInteraction): string {
	if (saisi && /^\d{15,25}$/u.test(saisi)) return saisi;
	return interaction.guildId ?? ACHILLEA;
}

/**
 * Récupère la fiche et tranche les trois cas : panne, serveur non scanné, données.
 * Rendre ce chemin commun évite que chaque sous-commande invente sa propre façon
 * d'échouer — c'est là que naissent les messages contradictoires.
 */
async function chargerFiche(
	interaction: ChatInputCommandInteraction,
	id: string
): Promise<GuildeDetaillee | null> {
	const resultat: Resultat<GuildeDetaillee> = await detailGuilde(id);
	if (!resultat.ok) {
		const [titre, description] = messageEchec(resultat.raison, resultat.detail);
		await repondre(interaction, echec(titre, description));
		return null;
	}
	if (!estScanne(resultat.valeur)) {
		await repondre(
			interaction,
			info(
				"Serveur jamais scanné",
				`Achillea connaît \`${id}\` mais n'a pas encore relevé ses données. ` +
					"Lancez `bun scripts/ops/discord/scan-guilds.ts --db --guild " +
					id +
					"` sur le dépôt Achillea."
			)
		);
		return null;
	}
	return resultat.valeur;
}

@Discord()
@SlashGroup({
	name: "achillea",
	description: "Les serveurs scannés par le bot Achillea : métadonnées, rôles, salons",
})
@SlashGroup("achillea")
export class AchilleaCommand {
	@Slash({
		name: "serveur",
		description: "Fiche d'un serveur scanné : membres, rôles, salons, date du dernier scan",
	})
	async serveur(
		@SlashOption({
			name: "identifiant",
			description: "Identifiant du serveur (par défaut : celui-ci, sinon Achillea)",
			type: ApplicationCommandOptionType.String,
			required: false,
		})
		identifiant: string | undefined,
		interaction: ChatInputCommandInteraction
	) {
		await differer(interaction);
		const guilde = await chargerFiche(interaction, serveurVise(identifiant, interaction));
		if (!guilde) return;

		const roles = rolesUtiles(guilde.roles);
		const geres = compterRolesGeres(guilde.roles);
		const repartition = repartitionParType(guilde.channels);

		const embed = fiche({
			titre: guilde.name ?? guilde.id,
			description: guilde.description ?? undefined,
			intention: "marque",
		})
			.champs([
				{
					name: "Membres",
					value:
						guilde.member_count === null
							? "—"
							: `${guilde.member_count.toLocaleString("fr-FR")}${
									guilde.presence_count === null
										? ""
										: ` · ${guilde.presence_count.toLocaleString("fr-FR")} en ligne`
								}`,
					inline: true,
				},
				{
					name: "Rôles",
					value: `${roles.length}${geres > 0 ? ` · dont ${geres} d'intégration` : ""}`,
					inline: true,
				},
				{ name: "Salons", value: String(guilde.channels.length), inline: true },
				{ name: "Dernier scan", value: dateScan(guilde.scanned_at), inline: true },
				{
					name: "Niveau de boost",
					value: guilde.premium_tier === null ? "—" : `niveau ${guilde.premium_tier}`,
					inline: true,
				},
				{
					name: "Vérification",
					value: guilde.verification_level === null ? "—" : `niveau ${guilde.verification_level}`,
					inline: true,
				},
			])
			.bloc(
				"Répartition des salons",
				bloquerLignes(repartition.map(([type, nombre]) => `\`${nombre}\` ${type}`))
			);

		if (guilde.icon) {
			embed.miniature(
				`https://cdn.discordapp.com/icons/${guilde.id}/${guilde.icon}.${guilde.icon.startsWith("a_") ? "gif" : "png"}?size=128`
			);
		}

		const construit = embed.finir();
		piedDeCommande(construit, interaction);
		await repondre(interaction, { embeds: [construit] });
	}

	@Slash({
		name: "roles",
		description: "Les rôles d'un serveur scanné, du plus haut au plus bas",
	})
	async roles(
		@SlashOption({
			name: "identifiant",
			description: "Identifiant du serveur (par défaut : celui-ci, sinon Achillea)",
			type: ApplicationCommandOptionType.String,
			required: false,
		})
		identifiant: string | undefined,
		interaction: ChatInputCommandInteraction
	) {
		await differer(interaction);
		const guilde = await chargerFiche(interaction, serveurVise(identifiant, interaction));
		if (!guilde) return;

		const roles = rolesUtiles(guilde.roles);
		const lignes = roles.map(
			(role) =>
				`\`${String(role.position).padStart(3, " ")}\` ${role.name}` +
				`${role.color === 0 ? "" : ` · ${couleurHex(role.color)}`}` +
				`${role.managed ? " · intégration" : ""}${role.hoist ? " · affiché à part" : ""}`
		);

		const embed = fiche({
			titre: `Rôles — ${guilde.name ?? guilde.id}`,
			contexte: `${roles.length} rôles hors @everyone · scan ${dateScan(guilde.scanned_at)}`,
			intention: "marque",
		})
			.bloc("Hiérarchie", bloquerLignes(lignes))
			.finir();
		piedDeCommande(embed, interaction);
		await repondre(interaction, { embeds: [embed] });
	}

	@Slash({
		name: "salons",
		description: "Les salons d'un serveur scanné, rangés sous leurs catégories",
	})
	async salons(
		@SlashOption({
			name: "identifiant",
			description: "Identifiant du serveur (par défaut : celui-ci, sinon Achillea)",
			type: ApplicationCommandOptionType.String,
			required: false,
		})
		identifiant: string | undefined,
		interaction: ChatInputCommandInteraction
	) {
		await differer(interaction);
		const guilde = await chargerFiche(interaction, serveurVise(identifiant, interaction));
		if (!guilde) return;

		const groupes = grouperParCategorie(guilde.channels);
		const embed = fiche({
			titre: `Salons — ${guilde.name ?? guilde.id}`,
			contexte: `${guilde.channels.length} salons · scan ${dateScan(guilde.scanned_at)}`,
			intention: "marque",
		});

		// Un embed est plafonné à 25 champs ET à 6 000 caractères : on n'affiche que les
		// premières catégories, et on dit combien restent, plutôt que de laisser Discord
		// rejeter le message entier.
		const AFFICHEES = 8;
		for (const groupe of groupes.slice(0, AFFICHEES)) {
			embed.bloc(
				groupe.categorie ?? "Sans catégorie",
				bloquerLignes(
					groupe.salons.map((salon) => `${salon.name} · ${libelleType(salon.type)}`),
					512
				)
			);
		}
		if (groupes.length > AFFICHEES) {
			embed.champs([
				{
					name: "Suite",
					value: `… et ${groupes.length - AFFICHEES} catégorie(s) de plus.`,
				},
			]);
		}

		const construit = embed.finir();
		piedDeCommande(construit, interaction);
		await repondre(interaction, { embeds: [construit] });
	}

	@Slash({
		name: "scan",
		description: "État du scan Achillea : serveurs relevés, membres cumulés, dernier passage",
	})
	async scan(interaction: ChatInputCommandInteraction) {
		await differer(interaction);
		const resultat = await statistiquesGuildes();
		if (!resultat.ok) {
			const [titre, description] = messageEchec(resultat.raison, resultat.detail);
			await repondre(interaction, echec(titre, description));
			return;
		}
		const stats = resultat.valeur;
		const embed = fiche({ titre: "Scan Achillea", intention: "marque" })
			.champs([
				{ name: "Serveurs scannés", value: String(stats.total_guilds), inline: true },
				{
					name: "Membres cumulés",
					value: stats.total_members.toLocaleString("fr-FR"),
					inline: true,
				},
				{ name: "Dernier passage", value: dateScan(stats.last_scan), inline: true },
			])
			.bloc(
				"Salons par type",
				bloquerLignes(
					stats.by_channel_type.map(({ type, count }) => `\`${count}\` ${libelleType(type)}`)
				)
			)
			.finir();
		piedDeCommande(embed, interaction);
		await repondre(interaction, { embeds: [embed] });
	}
}
