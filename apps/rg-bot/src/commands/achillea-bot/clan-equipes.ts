/**
 * `/clan teams` — équipes internes d'un clan (profil Achilléa).
 *
 * Port de `ClanTeamCommand` (legacy `commands/General/clan-teams.ts`) et de
 * `TeamManagerButtons` (`events/components/team-manager-buttons.ts`), avec
 * les mêmes `custom_id` : les panneaux déjà affichés continuent de répondre.
 *
 * Toute écriture passe par `/clans/teams` de l'API, au nom de qui clique :
 * l'effectif, le capitaine et les limites (5 joueurs, 2 remplaçants, 1 coach,
 * une seule place par membre) sont vérifiés là-bas, pas ici.
 *
 * Corrections par rapport à l'ancien bot :
 *  - un clan validé avant l'introduction des équipes n'a pas de lignes
 *    `clan_team` : l'ancien `/clan teams` levait « Main team not found ». Le
 *    panneau crée désormais les équipes manquantes (Vice-Président et plus) ;
 *  - `team_settings_btn` répondait à un identifiant invalide par un `followUp`
 *    sans réponse préalable, qui levait à son tour ;
 *  - le bouton `team_manager_btn` d'un AUTRE clan était ignoré en silence.
 */
import { ButtonComponent, Discord, ModalComponent, Slash, SlashGroup } from "discordx";
import {
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  MessageFlags,
  type ModalSubmitInteraction,
} from "discord.js";
import { ClanMemberRole } from "@rosegriffon/achillea-core/enums";
import type { ClanTeam, ClanTeamsMembership } from "@rosegriffon/achillea-client";

import { lireApi } from "../../lib/achillea-ui";
import type { AchilleaClientResult, ClientAchilleaDelegue } from "../../lib/achillea-api";
import {
  embedEquipe,
  embedMenuEquipes,
  estRoleEquipe,
  idChampEffectif,
  modaleEffectif,
  modaleParametresEquipe,
  rangeeGestionEquipe,
  rangeeMenuEquipes,
  ROLES_EQUIPE,
  typeDepuisNumero,
} from "../../lib/achillea-clan-vues";
import { differer, echec, repondre, succes } from "../../lib/ui";

type Interaction = ChatInputCommandInteraction | ButtonInteraction | ModalSubmitInteraction;

/** Rang minimal pour gérer les équipes (garde `ClanRole(SubCaptain)` de l'ancien bot). */
export const RANG_EQUIPES = ClanMemberRole.SubCaptain;

type Appartenance = ClanTeamsMembership & { clanId: number; clanRole: number; clan: NonNullable<ClanTeamsMembership["clan"]> };

async function signaler(interaction: Interaction, titre: string, motif: string): Promise<void> {
  if (interaction.isChatInputCommand() || !(interaction.deferred || interaction.replied)) {
    await repondre(interaction, echec(titre, motif));
    return;
  }
  await interaction.followUp({ ...echec(titre, motif), flags: MessageFlags.Ephemeral });
}

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

/** Clan de l'acteur, au rang de Vice-Président ou plus. */
async function appartenance(interaction: Interaction): Promise<Appartenance | null> {
  const lu = await api(interaction, c => c.clanTeams.membership(), "Clan introuvable");
  if (!lu) return null;
  if (lu.clanId === null || lu.clanRole === null || !lu.clan) {
    await signaler(interaction, "Aucun clan", "Tu n'es membre d'aucun clan actif.");
    return null;
  }
  if (lu.clanRole < RANG_EQUIPES) {
    await signaler(interaction, "Accès refusé", "Gérer les équipes est réservé au Président et aux Vice-Présidents.");
    return null;
  }
  return lu as Appartenance;
}

/**
 * Équipes du clan, en créant celles qui manquent (principale, secondaire).
 * Un clan validé avant les équipes n'en avait aucune ligne.
 */
export async function equipesDuClan(interaction: Interaction, clanId: number): Promise<ClanTeam[] | null> {
  const equipes = await api(interaction, c => c.clanTeams.list(clanId), "Équipes indisponibles");
  if (!equipes) return null;
  for (const type of [0, 1] as const) {
    if (equipes.some(e => e.type === type)) continue;
    const creee = await api(interaction, c => c.clanTeams.create(clanId, type), "Création de l'équipe refusée");
    if (!creee) return null;
    equipes.push(creee);
  }
  return equipes.sort((a, b) => a.type - b.type);
}

async function equipeDuType(interaction: Interaction, clanId: number, type: 0 | 1): Promise<ClanTeam | null> {
  const equipes = await equipesDuClan(interaction, clanId);
  if (!equipes) return null;
  const equipe = equipes.find(e => e.type === type) ?? null;
  if (!equipe) await signaler(interaction, "Équipe introuvable", `L'équipe ${type + 1} n'existe pas.`);
  return equipe;
}

async function afficherEquipe(interaction: Interaction, membre: Appartenance, equipe: ClanTeam) {
  await interaction.editReply({ embeds: [embedEquipe(membre.clan, equipe)], components: [rangeeGestionEquipe(equipe)] });
}

/** Valeurs saisies dans la modale d'effectif, dans l'ordre des champs, vides écartés. */
export function lireEffectif(
  champs: { getTextInputValue(id: string): string },
  role: 0 | 1 | 2,
  equipe: Pick<ClanTeam, "type" | "clanId">,
): string[] {
  const ids: string[] = [];
  for (let rang = 1; rang <= ROLES_EQUIPE[role].max; rang++) {
    let valeur = "";
    try {
      valeur = champs.getTextInputValue(idChampEffectif(role, rang, equipe));
    } catch {
      // Champ absent de la modale (ancien message) : rien à lire.
    }
    if (valeur.trim() !== "") ids.push(valeur.trim());
  }
  return ids;
}

@Discord()
@SlashGroup("clan")
export class ClanEquipes {
  @Slash({ name: "teams", description: "Gérez les équipes de votre Clan" })
  async teams(interaction: ChatInputCommandInteraction): Promise<void> {
    await differer(interaction, { prive: true });
    const membre = await appartenance(interaction);
    if (!membre) return;
    const equipes = await equipesDuClan(interaction, membre.clanId);
    if (!equipes) return;
    await interaction.editReply({
      embeds: [embedMenuEquipes(membre.clan, equipes)],
      components: [rangeeMenuEquipes(membre.clanId)],
    });
  }

  @ButtonComponent({ id: /^team_manager_btn:.+/ })
  async ouvrirEquipe(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferUpdate();
    const [, clanIdBrut, numero] = interaction.customId.split(":");
    const membre = await appartenance(interaction);
    if (!membre) return;
    if (Number(clanIdBrut) !== membre.clanId) {
      await signaler(interaction, "Autre clan", "Ce panneau appartient à un autre clan que le tien.");
      return;
    }
    const type = typeDepuisNumero(numero);
    if (type === null) {
      await signaler(interaction, "Équipe introuvable", `L'équipe ${numero} n'existe pas.`);
      return;
    }
    const equipe = await equipeDuType(interaction, membre.clanId, type);
    if (!equipe) return;
    await afficherEquipe(interaction, membre, equipe);
  }

  @ButtonComponent({ id: "return_teams_menu" })
  async retourMenu(interaction: ButtonInteraction): Promise<void> {
    await interaction.deferUpdate();
    const membre = await appartenance(interaction);
    if (!membre) return;
    const equipes = await equipesDuClan(interaction, membre.clanId);
    if (!equipes) return;
    await interaction.editReply({
      embeds: [embedMenuEquipes(membre.clan, equipes)],
      components: [rangeeMenuEquipes(membre.clanId)],
    });
  }

  /** `team_edit_btn:<type 0|1>:<rôle 0|1|2>` — ouvre la modale d'effectif (première réponse : pas de différé). */
  @ButtonComponent({ id: /^team_edit_btn:.+/ })
  async editerEffectif(interaction: ButtonInteraction): Promise<void> {
    const [, typeBrut, roleBrut] = interaction.customId.split(":");
    const type = Number(typeBrut);
    const role = Number(roleBrut);
    if ((type !== 0 && type !== 1) || !estRoleEquipe(role)) {
      await signaler(interaction, "Bouton invalide", `Équipe ${typeBrut} ou rôle ${roleBrut} inconnu.`);
      return;
    }
    const membre = await appartenance(interaction);
    if (!membre) return;
    const equipe = await equipeDuType(interaction, membre.clanId, type);
    if (!equipe) return;
    await interaction.showModal(modaleEffectif(equipe, role));
  }

  /** `team_settings_btn:<équipe>` — ouvre la modale nom + capitaine. */
  @ButtonComponent({ id: /^team_settings_btn:.+/ })
  async parametres(interaction: ButtonInteraction): Promise<void> {
    const [, idBrut] = interaction.customId.split(":");
    const equipeId = Number(idBrut);
    if (!Number.isInteger(equipeId)) {
      await signaler(interaction, "Bouton invalide", `Équipe ${idBrut} invalide.`);
      return;
    }
    const membre = await appartenance(interaction);
    if (!membre) return;
    const equipe = await api(interaction, c => c.clanTeams.get(equipeId), "Équipe introuvable");
    if (!equipe) return;
    await interaction.showModal(modaleParametresEquipe(equipe));
  }

  @ModalComponent({ id: /^team_manager_modal:.+/ })
  async enregistrerEffectif(interaction: ModalSubmitInteraction): Promise<void> {
    await interaction.deferUpdate();
    const [, idBrut, roleBrut] = interaction.customId.split(":");
    const equipeId = Number(idBrut);
    const role = Number(roleBrut);
    if (!Number.isInteger(equipeId) || !estRoleEquipe(role)) {
      await signaler(interaction, "Modale invalide", `Équipe ${idBrut} ou rôle ${roleBrut} inconnu.`);
      return;
    }
    const membre = await appartenance(interaction);
    if (!membre) return;
    const equipe = await api(interaction, c => c.clanTeams.get(equipeId), "Équipe introuvable");
    if (!equipe) return;
    const ids = lireEffectif(interaction.fields, role, equipe);
    const misAJour = await api(interaction, c => c.clanTeams.setRoster(equipeId, role, ids), "Effectif non modifié");
    if (!misAJour) return;
    await afficherEquipe(interaction, membre, misAJour);
  }

  @ModalComponent({ id: /^team_settings_modal:.+/ })
  async enregistrerParametres(interaction: ModalSubmitInteraction): Promise<void> {
    await interaction.deferUpdate();
    const [, idBrut] = interaction.customId.split(":");
    const equipeId = Number(idBrut);
    if (!Number.isInteger(equipeId)) {
      await signaler(interaction, "Modale invalide", `Équipe ${idBrut} invalide.`);
      return;
    }
    const membre = await appartenance(interaction);
    if (!membre) return;
    const equipe = await api(interaction, c => c.clanTeams.get(equipeId), "Équipe introuvable");
    if (!equipe) return;

    const nom = interaction.fields.getTextInputValue(`team_settings_name:${equipeId}`)?.trim() ?? "";
    let capitaine: string | undefined;
    try {
      capitaine = interaction.fields.getStringSelectValues(`team_settings_captain:${equipeId}`).at(0);
    } catch {
      // Pas de menu capitaine (équipe sans joueur) : rien à changer.
    }
    const patch = {
      ...(nom !== "" && nom !== equipe.name ? { name: nom } : {}),
      ...(capitaine && capitaine !== equipe.captainUserId ? { captainUserId: capitaine } : {}),
    };
    if (Object.keys(patch).length === 0) {
      await interaction.followUp({ ...succes("Aucun changement détecté."), flags: MessageFlags.Ephemeral });
      return;
    }
    const misAJour = await api(interaction, c => c.clanTeams.update(equipeId, patch), "Paramètres non modifiés");
    if (!misAJour) return;
    await afficherEquipe(interaction, membre, misAJour);
  }
}
