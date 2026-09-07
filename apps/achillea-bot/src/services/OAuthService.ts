import crypto from "node:crypto";

import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";

import { urlsConfig } from "@/configs";
import { Service } from "@/decorators";
import { OauthCsrf } from "@/entities";
import { env } from "@/env";

import { Database } from "./Database";

@Service()
export class OAuthService {
	constructor(private db: Database) {}

	private async createOauthState(discordId: string) {
		const token = crypto.randomBytes(24).toString("hex");
		const nonce = new OauthCsrf();
		nonce.discordId = discordId;
		nonce.token = token;

		await this.db.em.persist(nonce).flush();

		return `${discordId}:${token}`;
	}

	async getTwitchOAuthUrl(discordId: string) {
		const twitchUrl = `https://id.twitch.tv/oauth2/authorize`;
		const clientArg = `?client_id=${env.TWITCH_CLIENT_ID}`;
		const redirectArg = `&redirect_uri=${encodeURIComponent(`${urlsConfig.oauthCallback}?provider=twitch`)}`;
		const scopeArg = `&response_type=code&scope=user:read:email`;
		const stateArg = `&state=${encodeURIComponent(await this.createOauthState(discordId))}`;

		return twitchUrl + clientArg + redirectArg + scopeArg + stateArg;
	}

	async getChallongeOAuthUrl(discordId: string) {
		const baseUrl = `https://api.challonge.com/oauth/authorize`;
		const clientId = `?client_id=${env.isProd ? env.CHALLONGE_CLIENT_ID : env.CHALLONGE_CLIENT_ID_TEST}`;
		const redirectUri = `&redirect_uri=${encodeURIComponent(`${urlsConfig.oauthCallback}?provider=challonge`)}`;
		const scope = `&response_type=code&scope=${encodeURIComponent("me tournaments:read tournaments:write participants:write")}`;
		const stateRaw = await this.createOauthState(discordId);
		const state = `&state=${encodeURIComponent(stateRaw)}`;

		return baseUrl + clientId + redirectUri + scope + state;
	}

	OAuthButtons(url: string) {
		const button = new ButtonBuilder()
			.setLabel("Me connecter à Twitch")
			.setStyle(ButtonStyle.Link)
			.setURL(url)
			.setEmoji(`<:twitch_logo:${env.isDev ? "1392212865808732452" : "1436631494146658326"}>`);

		const dismissBtn = new ButtonBuilder()
			.setLabel("Je refuse la connexion")
			.setStyle(ButtonStyle.Danger)
			.setCustomId("dismiss-message")
			.setEmoji("🙅‍♂️");

		return new ActionRowBuilder<ButtonBuilder>().addComponents(button, dismissBtn);
	}

	OAuthTwitchEmbed() {
		return new EmbedBuilder()
			.setDescription(
				"Ce procédé appelé OAuth permet à AchilleaBot :\n" +
					"- De récupérer votre identifiant Twitch \n" +
					"- De récupérer l'adresse mail utilisée pour créer le compte Twitch\n" +
					"\n" +
					"__AchilleaBot ne reçoit et ne stocke que l'identifiant Twitch.__\n" +
					"\n\n" +
					"**Pour quoi faire ?**\n" +
					"__Pour pouvoir vous mettre en avant lorsque vous streamez, le bot a besoin de cet identifiant pour interroger Twitch sur votre statut.__" +
					'\nEn effet, pour pouvoir demander à Twitch *"Monsieur X est-il en stream ?"*, il nous faut un moyen de lui indiquer de quel Monsieur X nous parlons !\n' +
					"\n\n" +
					"**Toujours pas convaincu ?**\n" +
					"[L'article 15 du RGPD](https://www.cnil.fr/fr/reglement-europeen-protection-donnees/chapitre3#Article15) nous impose un devoir de transparence quant au traitement de vos données.\n" +
					"__Vous pouvez donc à tout moment vous adresser à nous afin de confirmer les données vous concernant et la manière dont elles sont utilisées.__\n"
			)
			.setTitle(
				`<:twitch_logo:${env.isDev ? "1392212865808732452" : "1436631494146658326"}> Twitch - OAuth`
			)
			.setColor(0x9146ff)
			.setFooter({
				text: "Powered by alessss_",
				iconURL:
					"https://cdn.discordapp.com/avatars/238660901375442954/00febf9a57a91e1f922411b0531a9684",
			})
			.setTimestamp(new Date());
	}
}
