import { Discord, Slash, SlashChoice, SlashOption } from "@rpbey/discordx";
import {
	ApplicationCommandOptionType,
	AttachmentBuilder,
	type ChatInputCommandInteraction,
} from "discord.js";

import { renderTeamGrid } from "../lib/canvas/cards";
import { sql } from "../lib/db";

const TEAMS: Record<string, string> = {
	bureauteam: "Bureau de l'Association",
	assoteam: "Association",
	collabteam: "Partenaires & Collaborateurs",
	achilleateam: "Équipe Achilléa",
	azaleeteam: "Équipe Azalée",
	loreteam: "Équipe Lore",
	dessinateurteam: "Équipe Dessinateur",
	mediationteam: "Cellule de Médiation",
	productionteam: "Équipe Production",
	socialteam: "Équipe Réseaux",
};

@Discord()
export class StaffCommand {
	@Slash({ name: "staff", description: "Affiche une équipe Rose Griffon (carte image)" })
	async run(
		@SlashChoice(
			{ name: "Bureau de l'Association", value: "bureauteam" },
			{ name: "Association", value: "assoteam" },
			{ name: "Partenaires & Collaborateurs", value: "collabteam" },
			{ name: "Équipe Achilléa", value: "achilleateam" },
			{ name: "Équipe Azalée", value: "azaleeteam" },
			{ name: "Équipe Lore", value: "loreteam" },
			{ name: "Équipe Dessinateur", value: "dessinateurteam" },
			{ name: "Cellule de Médiation", value: "mediationteam" },
			{ name: "Équipe Production", value: "productionteam" },
			{ name: "Équipe Réseaux", value: "socialteam" }
		)
		@SlashOption({
			name: "team",
			description: "Choisir une équipe (par défaut: bureau)",
			type: ApplicationCommandOptionType.String,
			required: false,
		})
		team: string | undefined,
		@SlashOption({
			name: "role",
			description: "Filtrer par rôle (ex: modérateur)",
			type: ApplicationCommandOptionType.String,
			required: false,
		})
		role: string | undefined,
		interaction: ChatInputCommandInteraction
	) {
		await interaction.deferReply();
		const teamId = team ?? "bureauteam";
		const title = TEAMS[teamId] ?? "Équipe Rose Griffon";

		try {
			const members = role
				? await sql<{ name: string; role: string; image_url: string | null }[]>`
            SELECT name, role, image_url FROM team_members
            WHERE team_id = ${teamId} AND is_active = true AND role ILIKE ${`%${role}%`}
            ORDER BY order_index, display_index NULLS LAST, name
          `
				: await sql<{ name: string; role: string; image_url: string | null }[]>`
            SELECT name, role, image_url FROM team_members
            WHERE team_id = ${teamId} AND is_active = true
            ORDER BY order_index, display_index NULLS LAST, name
          `;

			if (members.length === 0) {
				await interaction.editReply({
					content: role
						? `Aucun membre trouvé dans **${title}** pour le rôle « ${role} »`
						: `Aucun membre trouvé dans **${title}**`,
				});
				return;
			}

			const png = await renderTeamGrid(
				members.slice(0, 24),
				title,
				role
					? `Filtré : ${role}`
					: members.length > 24
						? `${members.length} membres — affichage des 24 premiers`
						: undefined
			);
			const file = new AttachmentBuilder(png, { name: `rg-${teamId}.png` });
			await interaction.editReply({ files: [file] });
		} catch (err) {
			await interaction.editReply({
				content: `❌ Erreur: ${err instanceof Error ? err.message : String(err)}`,
			});
		}
	}
}
