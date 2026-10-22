/**
 * `/clan manage` — panneau de gestion d'un clan (profil Achilléa).
 *
 * Port de `ManageClanCommand` (legacy `commands/General/clan-manage.ts`) et
 * de `ClanManagementButtons` (`events/components/clan-management-buttons.ts`).
 *
 * Chaque clic relit l'état par l'API, au nom de qui clique : le panneau ne
 * garde rien en mémoire, survit aux redémarrages et n'accorde aucun droit que
 * l'API n'accorde pas (modifier le clan : Président ou administrateur ;
 * promouvoir, exclure, révoquer : selon les rangs, comme sur le site).
 *
 * Écarts assumés avec l'ancien bot :
 *  - le panneau est PRIVÉ : il exposait les invitations en cours et les dates
 *    d'activité des membres à tout le salon ;
 *  - le logo se dépose dans un champ fichier de la modale, au lieu d'un
 *    message à poster dans les 60 s dans le salon (qui supprimait ensuite le
 *    message et échouait sans droit de gestion des messages) ;
 *  - le bouton « Révoquer » n'est plus grisé selon une règle inversée
 *    (`inviter.role <= acteur.role`) : l'API tranche.
 */
import { ButtonComponent, Discord, ModalComponent, SelectMenuComponent, Slash, SlashGroup } from "discordx";
import {
  type ActionRowBuilder,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type MessageActionRowComponentBuilder,
  MessageFlags,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction,
} from "discord.js";
import { ClanMemberRole } from "@rosegriffon/achillea-core/enums";
import type { ClanDTO, ClanInviteDTO, ClanMemberDTO } from "@rosegriffon/achillea-types/domain/clan";

import { lireApi } from "../../lib/achillea-ui";
import type { AchilleaClientResult, ClientAchilleaDelegue } from "../../lib/achillea-api";
import {
  bornerPageMembres,
  decoderIdGestion,
  distinctionsDepuisValeurs,
  embedInfosClan,
  embedInvitation,
  embedListeInvitations,
  embedListeMembres,
  embedMembre,
  logoAccepte,
  MEMBRES_PAR_PAGE,
  modaleBiographie,
  modaleExpulsion,
  modaleLogo,
  modaleNom,
  modaleReseaux,
  patchBascule,
  rangeeConfirmationRevocation,
  rangeeEditionInfos,
  rangeeGestionInvitation,
  rangeeGestionMembre,
  rangeeMenuPrincipal,
  rangeePaginationGestion,
  rangeeParametres,
  rangeeRetourMembre,
  selecteurDistinctions,
  selecteurInvitations,
  selecteurMembres,
} from "../../lib/achillea-clan-vues";
import { differer, echec, repondre, succes } from "../../lib/ui";

type Interaction = ChatInputCommandInteraction | ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction;
type Rangee = ActionRowBuilder<MessageActionRowComponentBuilder>;

/** Rang minimal pour ouvrir le panneau (garde `ClanRole(SubCaptain)` de l'ancien bot). */
export const RANG_PANNEAU = ClanMemberRole.SubCaptain;

export interface ContexteClan {
  clanId: number;
  role: number;
  clan: ClanDTO;
  membres: ClanMemberDTO[];
}

/**
 * Signale un échec sans détruire le panneau : sur une commande, la réponse
 * différée devient l'échec ; sur un composant, l'échec part en message privé
 * et le panneau reste tel quel.
 */
async function signaler(interaction: Interaction, titre: string, motif: string): Promise<void> {
  if (interaction.isChatInputCommand()) {
    await repondre(interaction, echec(titre, motif));
    return;
  }
  await interaction.followUp({ ...echec(titre, motif), flags: MessageFlags.Ephemeral });
}

/** Appel API au nom de qui clique ; `null` après avoir signalé l'échec. */
async function api<T>(
  interaction: Interaction,
  appel: (client: ClientAchilleaDelegue) => Promise<AchilleaClientResult<T>>,
  titre: string,
): Promise<T | null> {
  const resultat = await lireApi(interaction, appel);
  if (resultat.ok) return resultat.valeur;
  await signaler(interaction, titre, resultat.motif);
  return null;
}

/** Clan de l'acteur, son rang, la fiche et l'effectif — refuse sous le rang de Vice-Président. */
export async function chargerContexte(interaction: Interaction): Promise<ContexteClan | null> {
  const appartenance = await api(interaction, c => c.clanTeams.membership(), "Clan introuvable");
  if (!appartenance) return null;
  if (appartenance.clanId === null || appartenance.clanRole === null) {
    await signaler(interaction, "Aucun clan", "Tu n'es membre d'aucun clan actif.");
    return null;
  }
  if (appartenance.clanRole < RANG_PANNEAU) {
    await signaler(interaction, "Accès refusé", "La gestion du clan est réservée au Président et aux Vice-Présidents.");
    return null;
  }
  const clanId = appartenance.clanId;
  const [clan, membres] = await Promise.all([
    api(interaction, c => c.clans.get(clanId), "Fiche du clan indisponible"),
    api(interaction, c => c.clans.members(clanId), "Effectif du clan indisponible"),
  ]);
  if (!clan || !membres) return null;
  return { clanId, role: appartenance.clanRole, clan, membres };
}

async function afficher(interaction: Interaction, embeds: unknown[], components: Array<Rangee | ActionRowBuilder<never>>) {
  await interaction.editReply({ embeds, components } as never);
}

// ─── Vues composées ──────────────────────────────────────────────────────────

export async function vueMenu(interaction: Interaction, ctx: ContexteClan) {
  await afficher(interaction, [embedInfosClan(ctx.clan, ctx.membres)], [rangeeMenuPrincipal() as never]);
}

export async function vueMembres(interaction: Interaction, ctx: ContexteClan, page: number) {
  const p = bornerPageMembres(page, ctx.membres.length);
  const pages = Math.max(1, Math.ceil(ctx.membres.length / MEMBRES_PAR_PAGE));
  const rangees: Rangee[] = [rangeePaginationGestion("members", p, pages) as never];
  const selecteur = selecteurMembres(ctx.membres, p);
  if (selecteur) rangees.push(selecteur as never);
  await afficher(interaction, [embedListeMembres(ctx.clan, ctx.membres, p)], rangees);
}

export async function vueMembre(interaction: Interaction, ctx: ContexteClan, membreId: string) {
  const membre = ctx.membres.find(m => m.user.id === membreId);
  if (!membre) {
    await signaler(interaction, "Membre introuvable", "Ce joueur n'est plus membre du clan.");
    await vueMembres(interaction, ctx, 1);
    return;
  }
  await afficher(interaction, [embedMembre(membre)], [rangeeGestionMembre(membre, ctx.role, ctx.clanId) as never]);
}

async function vueInvitations(interaction: Interaction, ctx: ContexteClan, page: number) {
  const invitations = await api(interaction, c => c.clans.invites(), "Invitations indisponibles");
  if (!invitations) return;
  const p = bornerPageMembres(page, invitations.length);
  const pages = Math.max(1, Math.ceil(invitations.length / MEMBRES_PAR_PAGE));
  const rangees: Rangee[] = [rangeePaginationGestion("invites", p, pages) as never];
  const selecteur = selecteurInvitations(invitations, p);
  if (selecteur) rangees.push(selecteur as never);
  await afficher(interaction, [embedListeInvitations(ctx.clan, invitations, p)], rangees);
}

async function trouverInvitation(interaction: Interaction, id: number): Promise<ClanInviteDTO | null> {
  const invitations = await api(interaction, c => c.clans.invites(), "Invitations indisponibles");
  if (!invitations) return null;
  const invitation = invitations.find(i => i.id === id);
  if (!invitation) await signaler(interaction, "Invitation introuvable", "Elle a déjà été acceptée, refusée ou révoquée.");
  return invitation ?? null;
}

/** Téléverse la pièce jointe vers l'hébergement d'images de l'API et rend son URL publique. */
async function televerserLogo(
  interaction: ModalSubmitInteraction,
  piece: { url: string; name: string; contentType: string | null },
): Promise<string | null> {
  let octets: Blob;
  try {
    const reponse = await fetch(piece.url, { signal: AbortSignal.timeout(15_000) });
    if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
    octets = new Blob([await reponse.arrayBuffer()], { type: piece.contentType ?? "image/png" });
  } catch (err) {
    await signaler(interaction, "Logo illisible", `Discord n'a pas rendu le fichier (${err instanceof Error ? err.message : String(err)}).`);
    return null;
  }
  const image = await api(interaction, c => c.admin.uploadImage(octets, piece.name), "Échec du téléversement du logo");
  return image?.url ?? null;
}

// ─── Commande et composants ──────────────────────────────────────────────────

@Discord()
@SlashGroup("clan")
export class ClanGestion {
  @Slash({ name: "manage", description: "Gérez votre Clan (Président et Vice-Présidents)" })
  async manage(interaction: ChatInputCommandInteraction): Promise<void> {
    await differer(interaction, { prive: true });
    const ctx = await chargerContexte(interaction);
    if (!ctx) return;
    await vueMenu(interaction, ctx);
  }

  @ButtonComponent({ id: /^clan_manage:/ })
  async bouton(interaction: ButtonInteraction): Promise<void> {
    const id = decoderIdGestion(interaction.customId);
    if (!id) return;
    const { action, args } = id;

    // Les modales s'ouvrent en PREMIÈRE réponse : pas de `deferUpdate` avant.
    if (action === "name" || action === "bio" || action === "socials" || action === "kick") {
      const ctx = await chargerContexteSansDiffere(interaction);
      if (!ctx) return;
      if (action === "name") return interaction.showModal(modaleNom(ctx.clan));
      if (action === "bio") return interaction.showModal(modaleBiographie(ctx.clan));
      if (action === "socials") return interaction.showModal(modaleReseaux(ctx.clan));
      const membre = ctx.membres.find(m => m.user.id === args[0]);
      if (!membre) {
        await interaction.reply({ ...echec("Membre introuvable", "Ce joueur n'est plus membre du clan."), flags: MessageFlags.Ephemeral });
        return;
      }
      return interaction.showModal(modaleExpulsion(membre.user.id, membre.user.username));
    }
    if (action === "logo") return interaction.showModal(modaleLogo());

    await interaction.deferUpdate();
    const ctx = await chargerContexte(interaction);
    if (!ctx) return;

    switch (action) {
      case "menu": {
        return vueMenu(interaction, ctx);
      }
      case "infos": {
        return afficher(interaction, [embedInfosClan(ctx.clan, ctx.membres)], [rangeeEditionInfos() as never]);
      }
      case "settings": {
        return afficher(interaction, [embedInfosClan(ctx.clan, ctx.membres)], [rangeeParametres(ctx.clan) as never]);
      }
      case "members": {
        return vueMembres(interaction, ctx, Number(args[0] ?? 1));
      }
      case "invites": {
        return vueInvitations(interaction, ctx, Number(args[0] ?? 1));
      }
      case "toggle": {
        const patch = patchBascule(args[0] ?? "", ctx.clan);
        if (!patch) return;
        const resultat = await api(interaction, c => c.clans.update(ctx.clanId, patch), "Paramètre non modifié");
        if (!resultat) return;
        const clan = { ...ctx.clan, ...patch };
        return afficher(interaction, [embedInfosClan(clan, ctx.membres)], [rangeeParametres(clan) as never]);
      }
      case "role": {
        const [membreId, roleBrut] = args;
        const membre = ctx.membres.find(m => m.user.id === membreId);
        const role = Number(roleBrut);
        if (!membre || !Number.isInteger(role)) {
          await signaler(interaction, "Membre introuvable", "Ce joueur n'est plus membre du clan.");
          return;
        }
        const reponse = await api(
          interaction,
          c => c.clans.updateMember({ ...membre, clanRole: role }),
          "Changement de rôle refusé",
        );
        if (!reponse) return;
        const membres = reponse.members ?? ctx.membres.map(m => (m.user.id === membre.user.id ? { ...m, clanRole: role } : m));
        const promu = role > membre.clanRole;
        await interaction.followUp({
          ...succes(
            promu ? "Promotion" : "Rétrogradation",
            `<@${membre.user.id}> est désormais **${role === ClanMemberRole.SubCaptain ? "Vice-Président" : "Membre"}**.`,
          ),
          flags: MessageFlags.Ephemeral,
        });
        return vueMembre(interaction, { ...ctx, membres }, membre.user.id);
      }
      case "revoke": {
        const invitation = await trouverInvitation(interaction, Number(args[0]));
        if (!invitation) return;
        return afficher(
          interaction,
          [embedInvitation(invitation)],
          [rangeeConfirmationRevocation(invitation.id) as never],
        );
      }
      case "revoke_ok": {
        const invitation = await trouverInvitation(interaction, Number(args[0]));
        if (!invitation) return;
        const fait = await api(interaction, c => c.clans.revokeInvite(invitation), "Révocation refusée");
        if (!fait) return;
        await interaction.followUp({
          ...succes("Invitation révoquée", `L'invitation de <@${invitation.user.id}> est retirée.`),
          flags: MessageFlags.Ephemeral,
        });
        return vueInvitations(interaction, ctx, 1);
      }
      case "invite": {
        const invitation = await trouverInvitation(interaction, Number(args[0]));
        if (!invitation) return;
        return afficher(interaction, [embedInvitation(invitation)], [rangeeGestionInvitation(invitation) as never]);
      }
      default: {
        return;
      }
    }
  }

  @SelectMenuComponent({ id: /^clan_manage:(member_select|invite_select)$/ })
  async selection(interaction: StringSelectMenuInteraction): Promise<void> {
    await interaction.deferUpdate();
    const ctx = await chargerContexte(interaction);
    if (!ctx) return;
    const valeur = interaction.values[0] ?? "";
    if (interaction.customId.endsWith("member_select")) {
      await vueMembre(interaction, ctx, valeur);
      return;
    }
    const invitation = await trouverInvitation(interaction, Number(valeur));
    if (!invitation) return;
    await afficher(interaction, [embedInvitation(invitation)], [rangeeGestionInvitation(invitation) as never]);
  }

  @ModalComponent({ id: /^clan_manage:(name|bio|socials|logo|kick)_modal/ })
  async modale(interaction: ModalSubmitInteraction): Promise<void> {
    await interaction.deferUpdate();
    const id = decoderIdGestion(interaction.customId);
    if (!id) return;
    const ctx = await chargerContexte(interaction);
    if (!ctx) return;

    switch (id.action) {
      case "name_modal": {
        const name = interaction.fields.getTextInputValue("nameInput").trim();
        const shortenedName = interaction.fields.getTextInputValue("shortNameInput").trim();
        if (name === ctx.clan.name && shortenedName === ctx.clan.shortenedName) {
          await signaler(interaction, "Aucun changement", "Ces noms sont déjà ceux de votre Clan.");
          return;
        }
        const patch = {
          ...(name === ctx.clan.name ? {} : { name }),
          ...(shortenedName === ctx.clan.shortenedName ? {} : { shortenedName }),
        };
        return this.modifier(interaction, ctx, patch, "Nom du clan changé");
      }
      case "bio_modal": {
        const clanBiography = interaction.fields.getTextInputValue("textInput").trim();
        return this.modifier(interaction, ctx, { clanBiography }, "Biographie du clan changée");
      }
      case "socials_modal": {
        const lire = (champ: string) => interaction.fields.getTextInputValue(champ).trim() || null;
        return this.modifier(
          interaction,
          ctx,
          { xUrl: lire("xInput"), instagramUrl: lire("instagramInput"), tiktokUrl: lire("tikTokInput") },
          "Réseaux du clan mis à jour",
        );
      }
      case "logo_modal": {
        const piece = interaction.fields.getUploadedFiles("logoInput")?.first();
        if (!piece) {
          await signaler(interaction, "Aucun fichier", "Dépose une image png, jpg ou jpeg.");
          return;
        }
        if (!logoAccepte(piece.contentType)) {
          await signaler(interaction, "Format refusé", "Le logo doit être une image png, jpg ou jpeg.");
          return;
        }
        const url = await televerserLogo(interaction, piece);
        if (!url) return;
        return this.modifier(interaction, ctx, { clanAvatarUrl: url }, "Logo changé");
      }
      case "kick_modal": {
        const membreId = id.args[0] ?? "";
        const raison = interaction.fields.getTextInputValue("textInput").trim();
        const reponse = await api(interaction, c => c.clans.kickMember(membreId, raison), "Expulsion refusée");
        if (!reponse) return;
        await interaction.followUp({
          ...succes("Membre expulsé", `<@${membreId}> a été exclu du clan.\nRaison : ${raison}`),
          flags: MessageFlags.Ephemeral,
        });
        return vueMenu(interaction, { ...ctx, membres: reponse.members ?? ctx.membres.filter(m => m.user.id !== membreId) });
      }
      default: {
        return;
      }
    }
  }

  private async modifier(
    interaction: ModalSubmitInteraction,
    ctx: ContexteClan,
    patch: Parameters<ClientAchilleaDelegue["clans"]["update"]>[1],
    message: string,
  ): Promise<void> {
    const resultat = await api(interaction, c => c.clans.update(ctx.clanId, patch), "Modification refusée");
    if (!resultat) return;
    await interaction.followUp({ ...succes(message), flags: MessageFlags.Ephemeral });
    const clan = { ...ctx.clan, ...patch } as ClanDTO;
    await afficher(interaction, [embedInfosClan(clan, ctx.membres)], [rangeeEditionInfos() as never]);
  }

  // ─── Identifiants legacy : distinctions d'un membre ────────────────────────

  @ButtonComponent({ id: /^editDistinctions:.+/ })
  async editerDistinctions(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferUpdate();
    const [, membreId] = interaction.customId.split(":");
    const ctx = await chargerContexte(interaction);
    if (!ctx) return;
    const membre = ctx.membres.find(m => m.user.id === membreId);
    if (!membre) {
      await signaler(interaction, "Membre introuvable", "Membre sélectionné introuvable.");
      return;
    }
    await afficher(interaction, [embedMembre(membre)], [
      selecteurDistinctions(membre, ctx.clanId) as never,
      rangeeRetourMembre(membre.user.id, ctx.clanId) as never,
    ]);
  }

  @ButtonComponent({ id: /^return_to_member_menu:.+/ })
  async retourMembre(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferUpdate();
    const [, membreId] = interaction.customId.split(":");
    const ctx = await chargerContexte(interaction);
    if (!ctx) return;
    await vueMembre(interaction, ctx, membreId ?? "");
  }

  @SelectMenuComponent({ id: /^edit_distinctions:.+/ })
  async choisirDistinctions(interaction: StringSelectMenuInteraction): Promise<void> {
    await interaction.deferUpdate();
    const [, membreId] = interaction.customId.split(":");
    const ctx = await chargerContexte(interaction);
    if (!ctx) return;
    const membre = ctx.membres.find(m => m.user.id === membreId);
    if (!membre) {
      await signaler(interaction, "Membre introuvable", "Membre cible introuvable.");
      return;
    }
    const distinctions = distinctionsDepuisValeurs(interaction.values);
    if (distinctions.length === 0) {
      await signaler(interaction, "Distinctions invalides", "Choisis au moins une distinction connue.");
      return;
    }
    const reponse = await api(
      interaction,
      c => c.clans.updateMember({ ...membre, distinctions }),
      "Distinctions non modifiées",
    );
    if (!reponse) return;
    await interaction.followUp({
      ...succes("Distinctions éditées", `Distinctions de <@${membre.user.id}> : ${distinctions.join(", ")}.`),
      flags: MessageFlags.Ephemeral,
    });
    const membres = reponse.members ?? ctx.membres.map(m => (m.user.id === membre.user.id ? { ...m, distinctions } : m));
    await vueMembre(interaction, { ...ctx, membres }, membre.user.id);
  }
}

/**
 * Contexte pour un bouton qui ouvre une modale : la modale doit être la
 * PREMIÈRE réponse, donc pas de `deferUpdate`. Un échec répond en privé.
 */
async function chargerContexteSansDiffere(interaction: ButtonInteraction): Promise<ContexteClan | null> {
  const repondreEchec = async (titre: string, motif: string) => {
    await interaction.reply({ ...echec(titre, motif), flags: MessageFlags.Ephemeral });
  };
  const appartenance = await lireApi(interaction, c => c.clanTeams.membership());
  if (!appartenance.ok) {
    await repondreEchec("Clan introuvable", appartenance.motif);
    return null;
  }
  const { clanId, clanRole } = appartenance.valeur;
  if (clanId === null || clanRole === null) {
    await repondreEchec("Aucun clan", "Tu n'es membre d'aucun clan actif.");
    return null;
  }
  if (clanRole < RANG_PANNEAU) {
    await repondreEchec("Accès refusé", "La gestion du clan est réservée au Président et aux Vice-Présidents.");
    return null;
  }
  const [clan, membres] = await Promise.all([
    lireApi(interaction, c => c.clans.get(clanId)),
    lireApi(interaction, c => c.clans.members(clanId)),
  ]);
  if (!clan.ok || !membres.ok) {
    await repondreEchec("Clan indisponible", !clan.ok ? clan.motif : !membres.ok ? membres.motif : "");
    return null;
  }
  return { clanId, role: clanRole, clan: clan.valeur, membres: membres.valeur };
}
