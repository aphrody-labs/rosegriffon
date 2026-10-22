/**
 * `/owner` — liste noire, rôles du bot, maintenance, réindexation des comptes.
 *
 * Port des commandes `Owner/*` de l'ancien bot, désactivées là-bas (garde
 * `Disabled`) et réellement servies ici. Les droits ne sont plus décidés par
 * le bot : l'API exige Administrateur pour la liste noire et les rôles
 * (`/blacklist`, `/admin/ops/users/:id/role`), Super-administrateur pour la
 * maintenance (`/admin/ops/maintenance`), Administrateur pour la réindexation
 * (`/users/resync-avatars`).
 *
 * `bot-role admin` pose aussi le rôle Discord d'administration quand
 * `ACHILLEA_ADMIN_ROLE_ID` est renseigné (comportement de l'ancien bot, dont
 * l'identifiant était codé en dur).
 */
import { UserRole } from "@rosegriffon/achillea-core";
import { Discord, Slash, SlashChoice, SlashGroup, SlashOption } from "discordx";
import {
  ApplicationCommandOptionType,
  MessageFlags,
  type ChatInputCommandInteraction,
  type GuildMember,
  type User,
} from "discord.js";

import { appelApi } from "../../lib/achillea-ui";
import { utilisateurDe } from "../../lib/achillea-moderation";
import { attention, echapper, repondre, succes } from "../../lib/ui";

export const ROLES_BOT: Readonly<Record<string, { role: UserRole; libelle: string }>> = Object.freeze({
  mod: { role: UserRole.Moderator, libelle: "modérateur" },
  admin: { role: UserRole.Administrator, libelle: "administrateur" },
  superadmin: { role: UserRole.SuperAdministrator, libelle: "super-administrateur" },
});

/** Rôle à écrire : celui demandé à l'ajout, `User` au retrait (comportement de l'ancien dépôt). */
export function roleCible(action: string, role: string): UserRole | null {
  const entree = ROLES_BOT[role];
  if (!entree || (action !== "add" && action !== "remove")) return null;
  return action === "add" ? entree.role : UserRole.User;
}

function nomDe(cible: User): string {
  return echapper(cible.displayName ?? cible.username);
}

@Discord()
@SlashGroup({ name: "owner", description: "Administration du bot Achilléa" })
@SlashGroup("owner")
export class CommandeOwner {
  @Slash({ name: "blacklist-add", description: "Ajouter un joueur à la liste noire" })
  async ajouter(
    @SlashOption({ name: "user", description: "Joueur à exclure", type: ApplicationCommandOptionType.User, required: true })
    brut: User | GuildMember,
    @SlashOption({ name: "reason", description: "Motif", type: ApplicationCommandOptionType.String, required: true })
    raison: string,
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    await interaction.deferReply();
    const cible = utilisateurDe(brut);
    const entree = await appelApi(interaction, c => c.blacklist.add(cible.id, raison), "Ajout à la liste noire refusé");
    if (!entree) return;
    await repondre(interaction, succes("Liste noire", `L'utilisateur ${nomDe(cible)} a été ajouté à la liste noire.`));
  }

  @Slash({ name: "blacklist-remove", description: "Retirer un joueur de la liste noire" })
  async retirer(
    @SlashOption({ name: "user", description: "Joueur à réintégrer", type: ApplicationCommandOptionType.User, required: true })
    brut: User | GuildMember,
    @SlashOption({ name: "reason", description: "Motif du retrait", type: ApplicationCommandOptionType.String, required: true })
    raison: string,
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    await interaction.deferReply();
    const cible = utilisateurDe(brut);
    const retrait = await appelApi(interaction, c => c.blacklist.remove(cible.id), "Retrait de la liste noire refusé");
    if (!retrait) return;
    console.info(`[owner] ${interaction.user.id} retire ${cible.id} de la liste noire : ${raison}`);
    await repondre(interaction, succes("Liste noire", `L'utilisateur ${nomDe(cible)} a été retiré de la liste noire.`));
  }

  @Slash({ name: "bot-role", description: "Donner ou retirer un rôle du bot à un utilisateur" })
  async botRole(
    @SlashChoice({ name: "Add", value: "add" })
    @SlashChoice({ name: "Remove", value: "remove" })
    @SlashOption({ name: "action", description: "Ajouter ou retirer", type: ApplicationCommandOptionType.String, required: true })
    action: string,
    @SlashOption({ name: "user", description: "Utilisateur", type: ApplicationCommandOptionType.User, required: true })
    brut: User | GuildMember,
    @SlashChoice({ name: "Admin", value: "admin" })
    @SlashChoice({ name: "Mod", value: "mod" })
    @SlashChoice({ name: "Super Admin", value: "superadmin" })
    @SlashOption({ name: "role", description: "Rôle du bot", type: ApplicationCommandOptionType.String, required: true })
    role: string,
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    await interaction.deferReply();
    const cible = utilisateurDe(brut);
    const valeur = roleCible(action, role);
    if (valeur === null) {
      await repondre(interaction, attention("Choix invalide", "Action `add`/`remove` et rôle `admin`/`mod`/`superadmin`."));
      return;
    }
    const resultat = await appelApi(interaction, c => c.admin.setUserRole(cible.id, valeur), "Changement de rôle refusé");
    if (!resultat) return;

    let note = "";
    const roleDiscord = (Bun.env.ACHILLEA_ADMIN_ROLE_ID ?? "").trim();
    if (role === "admin" && /^\d{15,25}$/u.test(roleDiscord) && interaction.guild) {
      try {
        const membre = await interaction.guild.members.fetch(cible.id);
        if (action === "add") await membre.roles.add(roleDiscord);
        else await membre.roles.remove(roleDiscord);
      } catch (err) {
        note = `\nRôle Discord non modifié : ${err instanceof Error ? err.message : String(err)}`;
      }
    }
    const libelle = ROLES_BOT[role]?.libelle ?? role;
    await repondre(
      interaction,
      succes(
        "Rôle du bot",
        `${nomDe(cible)} ${action === "add" ? "est désormais" : "n'est plus"} ${libelle} du bot.${note}`,
      ),
    );
  }

  @Slash({ name: "maintenance", description: "Activer ou couper le mode maintenance" })
  async maintenance(
    @SlashOption({ name: "state", description: "Maintenance active ?", type: ApplicationCommandOptionType.Boolean, required: true })
    etat: boolean,
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const resultat = await appelApi(interaction, c => c.admin.setMaintenance(etat), "Maintenance non modifiée");
    if (!resultat) return;
    await repondre(
      interaction,
      succes("Maintenance", `Le mode maintenance est désormais **${resultat.maintenance ? "activé" : "désactivé"}**.`),
    );
  }

  @Slash({ name: "resync-users", description: "Réindexe pseudo, nom et avatar de tous les comptes depuis Discord" })
  async resync(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const resultat = await appelApi(interaction, c => c.users.resyncAvatars(), "Réindexation refusée");
    if (!resultat) return;
    await repondre(
      interaction,
      resultat.started
        ? succes("Réindexation lancée", "Tous les comptes sont relus depuis Discord par lots de 10 ; comptez une à deux minutes.")
        : attention("Réindexation déjà en cours", "Un relevé tourne déjà ; relancez une fois qu'il aura fini."),
    );
  }
}
