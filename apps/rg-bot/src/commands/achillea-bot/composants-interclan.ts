/**
 * Boutons et fenêtres des messages d'interclan (profil Achilléa).
 *
 * Port de `InterclanButtons` de l'ancien bot, `custom_id` identiques (des
 * messages déjà publiés les portent) :
 *
 *   interclan_approval:<id>:<1|0>              accepter / refuser le défi
 *   interclan_lineup:<id>:<0|1>                ouvrir la composition d'un clan
 *   lineup_manager_modal:<clanId>:<id>         enregistrer la composition
 *   lock_interclan_lineup:<id>:<0|1>           verrouiller une composition
 *   cancel_interclan:<id>                      demander l'annulation
 *   cancel_interclan_confirmation:<id>:<1|0>   confirmer / renoncer
 *   start_interclan:<id>                       lancer l'interclan
 *   interclan_match:<id>:<lobbyId>             ouvrir la saisie d'un score
 *   interclan_match_result_modal:<lobbyId>     enregistrer un score
 *
 * Chaque action est un appel à `/interclans` au nom de qui clique : l'API
 * décide des droits (rôle dans le clan) et des transitions. Un refus part en
 * message privé et ne touche JAMAIS au message public cliqué.
 *
 * Corrigé au passage : la saisie d'un score n'avait aucune garde dans
 * l'ancien bot (n'importe quel membre du serveur pouvait l'écrire), et le
 * lancement acceptait un dirigeant de n'importe quel clan.
 */
import { ButtonComponent, Discord, ModalComponent } from "discordx";
import type {
  ButtonInteraction,
  InteractionReplyOptions,
  ModalComponentData,
  ModalSubmitInteraction,
  RepliableInteraction,
} from "discord.js";

import {
  boutonsAccepterRefuser,
  compositionDe,
  embedComposition,
  embedScores,
  embedSucces,
  fenetreComposition,
  fenetreScore,
  messagePourEtat,
  type DetailInterclan,
} from "../../api/modules/achillea/interclans/messages";
import { ETAT, ETATS_ANNULABLES, ROLE_CLAN } from "../../api/modules/achillea/interclans/regles";
import type { AchilleaClientResult, ClientAchilleaDelegue } from "../../lib/achillea-api";
import { lireApi } from "../../lib/achillea-ui";
import { echec, refus, succes } from "../../lib/ui";
import { chargeBrute } from "./interclan";

/** Champs numériques d'un `custom_id` legacy `<prefixe>:<a>:<b>`. */
export function champsNumeriques(customId: string, nombre: number): number[] | null {
  const parties = customId.split(":").slice(1);
  if (parties.length < nombre) return null;
  const valeurs = parties.slice(0, nombre).map(Number);
  return valeurs.every(v => Number.isInteger(v) && v >= 0) ? valeurs : null;
}

/** Échec en message privé, sans toucher au message cliqué. */
async function signaler(interaction: RepliableInteraction, titre: string, motif: string): Promise<void> {
  const charge = echec(titre, motif) as InteractionReplyOptions;
  if (interaction.deferred || interaction.replied) await interaction.followUp(charge);
  else await interaction.reply(charge);
}

/** Appel API ; en cas d'échec, message privé et `null`. */
async function appel<T>(
  interaction: RepliableInteraction,
  fn: (c: ClientAchilleaDelegue) => Promise<AchilleaClientResult<T>>,
  titre: string,
): Promise<T | null> {
  const resultat = await lireApi(interaction, fn);
  if (resultat.ok) return resultat.valeur;
  await signaler(interaction, titre, resultat.motif);
  return null;
}

/** Le lecteur dirige-t-il ce clan (Vice-Président+ ou administrateur) ? Vrai si l'API n'a pas rendu de lecteur. */
export function dirige(detail: DetailInterclan, clanId: number, minimum: number = ROLE_CLAN.VICE_PRESIDENT): boolean {
  const v = detail.viewer;
  if (!v) return true;
  return v.isAdmin || (v.clanId === clanId && (v.clanRole ?? -1) >= minimum);
}

/** Composition saisie dans la fenêtre : champs `lineup_member_1..5` non vides. */
export function placementsSaisis(lire: (champ: string) => string): Array<{ userId: string; position: number }> {
  const placements: Array<{ userId: string; position: number }> = [];
  for (let position = 1; position <= 5; position++) {
    const valeur = (lire(`lineup_member_${position}`) ?? "").trim().replace(/^<@!?(\d+)>$/u, "$1");
    if (valeur !== "") placements.push({ userId: valeur, position });
  }
  return placements;
}

/** Score saisi : entier de 0 à 99, sinon `null`. */
export function scoreSaisi(valeur: string): number | null {
  const texte = (valeur ?? "").trim();
  if (!/^\d{1,2}$/u.test(texte)) return null;
  return Number(texte);
}

@Discord()
export class InterclanComposants {
  @ButtonComponent({ id: /^interclan_approval:\d+:[01]$/ })
  async approbation(interaction: ButtonInteraction) {
    await interaction.deferUpdate();
    const [id, drapeau] = champsNumeriques(interaction.customId, 2) ?? [];
    if (id === undefined) return;
    const accepte = drapeau === 1;
    const detail = await appel(interaction, c => c.interclans.respond(id, accepte), "Réponse impossible");
    if (!detail) return;
    await interaction.editReply(
      chargeBrute({
        embeds: [
          accepte
            ? embedSucces("Vous avez accepté le défi. Les compositions se font dans le salon de l'interclan !")
            : { color: 0xed4245, title: "❌ Vous avez refusé le défi. L'Interclan a été annulé." },
        ],
        components: [],
      }),
    );
  }

  @ButtonComponent({ id: /^interclan_lineup:\d+:[01]$/ })
  async composition(interaction: ButtonInteraction) {
    const [id, cote] = champsNumeriques(interaction.customId, 2) ?? [];
    if (id === undefined) return;
    const detail = await appel(interaction, c => c.interclans.get(id), "Interclan introuvable");
    if (!detail) return;
    const lineup = compositionDe(detail, cote === 1 ? 1 : 0);
    const clan = cote === 1 ? detail.clanB : detail.clanA;
    if (!lineup) {
      await interaction.reply(refus("Aucune lineup trouvée pour ce clan.") as InteractionReplyOptions);
      return;
    }
    if (!dirige(detail, clan.id)) {
      await interaction.reply(refus(`Seul le staff du clan ${clan.name} peut effectuer cette action.`) as InteractionReplyOptions);
      return;
    }
    if (lineup.lockedIn || detail.state !== ETAT.ACCEPTE) {
      await interaction.reply(refus("Cette lineup n'est plus modifiable.") as InteractionReplyOptions);
      return;
    }
    await interaction.showModal(fenetreComposition(detail, cote === 1 ? 1 : 0) as unknown as ModalComponentData);
  }

  @ModalComponent({ id: /^lineup_manager_modal:\d+:\d+$/ })
  async enregistrerComposition(interaction: ModalSubmitInteraction) {
    await interaction.deferUpdate();
    const [clanId, id] = champsNumeriques(interaction.customId, 2) ?? [];
    if (id === undefined || clanId === undefined) return;
    const placements = placementsSaisis(champ => interaction.fields.getTextInputValue(champ));
    const detail = await appel(interaction, c => c.interclans.setLineup(id, clanId, placements), "Lineup refusée");
    if (!detail) return;
    await interaction.editReply(chargeBrute(messagePourEtat(detail)));
    await interaction.followUp({ embeds: [embedComposition(detail, clanId)], flags: 64 } as InteractionReplyOptions);
  }

  @ButtonComponent({ id: /^lock_interclan_lineup:\d+:[01]$/ })
  async verrouiller(interaction: ButtonInteraction) {
    await interaction.deferUpdate();
    const [id, cote] = champsNumeriques(interaction.customId, 2) ?? [];
    if (id === undefined) return;
    const avant = await appel(interaction, c => c.interclans.get(id), "Interclan introuvable");
    if (!avant) return;
    const clan = cote === 1 ? avant.clanB : avant.clanA;
    const detail = await appel(interaction, c => c.interclans.lockLineup(id, clan.id), "Verrouillage impossible");
    if (!detail) return;
    await interaction.editReply(chargeBrute(messagePourEtat(detail)));
    await interaction.followUp(
      succes(
        "La lineup a été verrouillée !",
        detail.state === ETAT.PRET ? "Les deux lineups sont verrouillées : l'interclan peut être lancé à l'heure prévue." : undefined,
        { prive: true },
      ) as InteractionReplyOptions,
    );
  }

  @ButtonComponent({ id: /^cancel_interclan:\d+$/ })
  async annuler(interaction: ButtonInteraction) {
    await interaction.deferReply({ flags: 64 });
    const [id] = champsNumeriques(interaction.customId, 1) ?? [];
    if (id === undefined) return;
    const detail = await appel(interaction, c => c.interclans.get(id), "Interclan introuvable");
    if (!detail) return;
    if (!dirige(detail, detail.clanA.id, ROLE_CLAN.PRESIDENT) && !dirige(detail, detail.clanB.id, ROLE_CLAN.PRESIDENT)) {
      await interaction.editReply(
        chargeBrute({
          embeds: [
            {
              color: 0xed4245,
              title: `❌ Seuls les Présidents des clans ${detail.clanA.name} ou ${detail.clanB.name} peuvent annuler cet interclan.`.slice(0, 256),
            },
          ],
        }),
      );
      return;
    }
    if (!ETATS_ANNULABLES.includes(detail.state)) {
      await interaction.editReply(
        chargeBrute({
          embeds: [
            {
              color: 0xed4245,
              title: `❌ Cet interclan a déjà été ${detail.state === ETAT.ANNULE ? "annulé" : "lancé ou terminé"}.`,
            },
          ],
        }),
      );
      return;
    }
    await interaction.editReply(
      chargeBrute({
        content: "Souhaitez-vous annuler cet Interclan ?",
        components: [boutonsAccepterRefuser("cancel_interclan_confirmation", id)],
      }),
    );
  }

  @ButtonComponent({ id: /^cancel_interclan_confirmation:\d+:[01]$/ })
  async confirmerAnnulation(interaction: ButtonInteraction) {
    await interaction.deferUpdate();
    const [id, reponse] = champsNumeriques(interaction.customId, 2) ?? [];
    if (id === undefined) return;
    if (reponse !== 1) {
      await interaction.deleteReply();
      return;
    }
    const detail = await appel(interaction, c => c.interclans.cancel(id), "Annulation impossible");
    if (!detail) return;
    await interaction.editReply(
      chargeBrute({ embeds: [embedSucces(`L'interclan ${detail.name} a été annulé. Les deux clans ont été prévenus.`)], components: [] }),
    );
  }

  @ButtonComponent({ id: /^start_interclan:\d+$/ })
  async lancer(interaction: ButtonInteraction) {
    await interaction.deferUpdate();
    const [id] = champsNumeriques(interaction.customId, 1) ?? [];
    if (id === undefined) return;
    const detail = await appel(interaction, c => c.interclans.start(id), "Lancement impossible");
    if (!detail) return;
    await interaction.editReply(chargeBrute(messagePourEtat(detail)));
  }

  @ButtonComponent({ id: /^interclan_match:\d+:\d+$/ })
  async ouvrirScore(interaction: ButtonInteraction) {
    const [id, lobbyId] = champsNumeriques(interaction.customId, 2) ?? [];
    if (id === undefined || lobbyId === undefined) return;
    const detail = await appel(interaction, c => c.interclans.get(id), "Interclan introuvable");
    if (!detail) return;
    const match = detail.matches.find(m => m.id === lobbyId);
    const fenetre = match ? fenetreScore(match) : null;
    if (!match || !fenetre) {
      await interaction.reply(refus(`⚠️ Impossible de trouver le match #${lobbyId}.`) as InteractionReplyOptions);
      return;
    }
    if (match.state === "Finished") {
      await interaction.reply(refus(`Le score du match #${lobbyId} est déjà enregistré.`) as InteractionReplyOptions);
      return;
    }
    await interaction.showModal(fenetre as unknown as ModalComponentData);
  }

  @ModalComponent({ id: /^interclan_match_result_modal:\d+$/ })
  async enregistrerScore(interaction: ModalSubmitInteraction) {
    await interaction.deferUpdate();
    const [lobbyId] = champsNumeriques(interaction.customId, 1) ?? [];
    if (lobbyId === undefined) return;
    const scoreA = scoreSaisi(interaction.fields.getTextInputValue("score_a"));
    const scoreB = scoreSaisi(interaction.fields.getTextInputValue("score_b"));
    if (scoreA === null || scoreB === null) {
      await signaler(interaction, "Score refusé", "Les scores doivent être des nombres positifs (0 à 99).");
      return;
    }
    const resultat = await appel(interaction, c => c.interclans.reportScore(lobbyId, scoreA, scoreB), "Score refusé");
    if (!resultat) return;
    await interaction.editReply(
      chargeBrute(resultat.termine ? { embeds: [embedScores(resultat.detail)], components: [] } : messagePourEtat(resultat.detail)),
    );
    const m = resultat.match;
    await interaction.followUp(
      succes(
        "Score mis à jour",
        `${m.joueurA} ${m.scoreA}–${m.scoreB} ${m.joueurB}` +
          (resultat.termine ? "\nTous les matchs sont joués : le vote de validation est ouvert dans le salon." : ""),
        { prive: true },
      ) as InteractionReplyOptions,
    );
  }
}
