/**
 * `/create-clan` — fonder un Clan Achilléa (profil `achillea`).
 *
 * Même parcours que l'ancien bot, sans ses points fragiles :
 *
 *   1. la commande désigne les quatre fondateurs ET joint le logo (option
 *      `logo`). L'ancien bot demandait le logo APRÈS la modale, dans le salon
 *      du clan, par un collecteur de messages : un redémarrage pendant ces dix
 *      minutes laissait un rôle et un salon orphelins sur le serveur central ;
 *   2. une modale (`createClan1`, champs de l'ancien bot) recueille nom, sigle,
 *      biographie et réseau social ;
 *   3. le logo est déposé par `POST /proxy/upload` (même stockage que le site),
 *      puis `POST /clans/create` crée le clan, son rôle, son salon et le vote
 *      de fondation — c'est l'API qui fait tout le reste, comme pour le site.
 *
 * Entre la commande et la modale, les fondateurs et le logo attendent en
 * mémoire (dix minutes, une entrée par joueur) : une modale ne transporte
 * qu'un `custom_id` de 100 caractères, trop court pour eux.
 *
 * Écart : le champ « serveur du clan » de l'ancienne modale n'existe plus ici ;
 * on lie son serveur ensuite par `/guild settings`, qui vérifie les droits
 * côté API.
 */
import { Discord, ModalComponent, Slash, SlashOption } from "discordx";
import {
  ApplicationCommandOptionType,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type Attachment,
  type ChatInputCommandInteraction,
  type ModalSubmitInteraction,
  type User,
} from "discord.js";
import { normalizeNames } from "@rosegriffon/achillea-core";

import { appelApi } from "../../lib/achillea-ui";
import { logoAccepte, reseauDe } from "../../lib/achillea-clan-format";
import { echapper, echec, repondre, succes } from "../../lib/ui";

/** Délai pour remplir la modale (l'ancien bot accordait 5 min + 10 min pour le logo). */
export const DELAI_CREATION_MS = 10 * 60 * 1000;

export interface CreationEnAttente {
  fondateurs: string[];
  logo: { url: string; nom: string; type: string };
  expireLe: number;
}

const enAttente = new Map<string, CreationEnAttente>();

/** Garde l'état d'une création ; purge au passage ce qui a expiré. */
export function retenirCreation(joueurId: string, creation: CreationEnAttente, maintenant = Date.now()): void {
  for (const [cle, valeur] of enAttente) if (valeur.expireLe <= maintenant) enAttente.delete(cle);
  enAttente.set(joueurId, creation);
}

/** Reprend (et consomme) l'état d'une création encore valide. */
export function reprendreCreation(joueurId: string, maintenant = Date.now()): CreationEnAttente | null {
  const creation = enAttente.get(joueurId) ?? null;
  enAttente.delete(joueurId);
  return creation && creation.expireLe > maintenant ? creation : null;
}

/** Refus d'une liste de fondateurs, ou `null` si elle convient. */
export function refusFondateurs(auteurId: string, membres: readonly Pick<User, "id" | "bot">[]): string | null {
  const ids = [auteurId, ...membres.map(m => m.id)];
  if (new Set(ids).size !== ids.length) return "Vous ne pouvez pas créer un Clan avec des utilisateurs dupliqués !";
  if (membres.some(m => m.bot)) return "Un bot ne peut pas être fondateur d'un Clan.";
  return null;
}

/** Modale de l'ancien bot (`buildClanCreationModal`), mêmes identifiants de champs. */
export function modaleCreation(): ModalBuilder {
  const champ = (id: string, style: TextInputStyle, min: number, max: number, aide: string, requis = true) =>
    new TextInputBuilder().setCustomId(id).setStyle(style).setMinLength(min).setMaxLength(max).setPlaceholder(aide).setRequired(requis);
  return new ModalBuilder()
    .setTitle("Création de Clan")
    .setCustomId("createClan1")
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Nom du Clan")
        .setTextInputComponent(champ("clanName", TextInputStyle.Short, 2, 30, "Les noms inappropriés seront rejetés")),
      new LabelBuilder()
        .setLabel("Sigle du Clan")
        .setTextInputComponent(champ("clanShortenedName", TextInputStyle.Short, 2, 6, "ex. PSG, 𝕯𝕽, etc.")),
      new LabelBuilder()
        .setLabel("Biographie de Clan")
        .setTextInputComponent(champ("clanBiography", TextInputStyle.Paragraph, 15, 1500, "La présentation de votre Clan...")),
      new LabelBuilder()
        .setLabel("Réseau social du Clan")
        .setTextInputComponent(champ("socialMedia", TextInputStyle.Short, 10, 100, "Lien X, Instagram ou TikTok")),
    );
}

@Discord()
export class CreationClan {
  @Slash({ name: "create-clan", description: "Créez votre propre Clan" })
  async creer(
    @SlashOption({ name: "member_1", description: "Premier membre fondateur", type: ApplicationCommandOptionType.User, required: true })
    membre1: User,
    @SlashOption({ name: "member_2", description: "Deuxième membre fondateur", type: ApplicationCommandOptionType.User, required: true })
    membre2: User,
    @SlashOption({ name: "member_3", description: "Troisième membre fondateur", type: ApplicationCommandOptionType.User, required: true })
    membre3: User,
    @SlashOption({ name: "member_4", description: "Quatrième membre fondateur", type: ApplicationCommandOptionType.User, required: true })
    membre4: User,
    @SlashOption({
      name: "logo",
      description: "Logo du Clan (PNG ou JPEG)",
      type: ApplicationCommandOptionType.Attachment,
      required: true,
    })
    logo: Attachment,
    interaction: ChatInputCommandInteraction,
  ): Promise<void> {
    const membres = [membre1, membre2, membre3, membre4];
    const refus = refusFondateurs(interaction.user.id, membres);
    if (refus) {
      await repondre(interaction, echec("Création impossible", refus));
      return;
    }
    if (!logoAccepte(logo.contentType)) {
      await repondre(interaction, echec("Logo refusé", "Ce format d'image n'est pas pris en charge : envoyez un PNG ou un JPEG."));
      return;
    }
    retenirCreation(interaction.user.id, {
      fondateurs: membres.map(m => m.id),
      logo: { url: logo.url, nom: logo.name, type: (logo.contentType ?? "image/png").split(";")[0]!.trim() },
      expireLe: Date.now() + DELAI_CREATION_MS,
    });
    await interaction.showModal(modaleCreation());
  }

  @ModalComponent({ id: "createClan1" })
  async valider(interaction: ModalSubmitInteraction): Promise<void> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const creation = reprendreCreation(interaction.user.id);
    if (!creation) {
      await repondre(interaction, echec("Délai dépassé", "Délai d'attente maximum dépassé ! Relancez `/create-clan`."));
      return;
    }
    const nom = interaction.fields.getTextInputValue("clanName").trim();
    const sigle = interaction.fields.getTextInputValue("clanShortenedName").trim();
    const biographie = interaction.fields.getTextInputValue("clanBiography").trim();
    const reseau = interaction.fields.getTextInputValue("socialMedia").trim();
    const plateforme = reseauDe(reseau);
    if (!plateforme) {
      await repondre(interaction, echec("Réseau social invalide", "L'url de ce réseau est invalide ! Donnez un lien X, Instagram ou TikTok."));
      return;
    }

    // Le logo transite par le stockage d'images de l'API : une URL de pièce jointe
    // Discord est signée et expire, elle ne peut pas servir d'avatar de clan.
    let fichier: Blob;
    try {
      const reponse = await fetch(creation.logo.url, { signal: AbortSignal.timeout(15_000) });
      if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
      fichier = new Blob([await reponse.arrayBuffer()], { type: creation.logo.type });
    } catch (err) {
      await repondre(
        interaction,
        echec("Logo illisible", `Téléchargement du logo échoué (${err instanceof Error ? err.message : String(err)}). Relancez la commande.`),
      );
      return;
    }
    const depot = await appelApi(interaction, c => c.admin.uploadImage(fichier, creation.logo.nom), "Logo non déposé");
    if (!depot) return;

    const cree = await appelApi(
      interaction,
      c =>
        c.clans.create({
          founders: creation.fondateurs.map(id => ({ id })),
          logo: depot.url,
          name: nom,
          normalizedName: normalizeNames(nom),
          shortName: sigle,
          normalizedShortName: normalizeNames(sigle),
          description: biographie,
          [plateforme]: reseau,
        }),
      "Création du Clan impossible",
    );
    if (!cree) return;
    if (!cree.success) {
      await repondre(interaction, echec("Création du Clan impossible", cree.error ?? cree.conflict ?? "Refus de l'API."));
      return;
    }
    await repondre(
      interaction,
      succes(
        `Clan ${nom} en fondation`,
        `Le salon de **${echapper(nom)}** est ouvert : les quatre fondateurs y ont 24 h pour voter. ` +
          "Le Clan est validé dès que la majorité accepte.",
      ),
    );
  }
}
