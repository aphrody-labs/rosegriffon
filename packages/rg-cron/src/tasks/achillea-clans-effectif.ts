/**
 * Copyright 2026 Rose Griffon
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * `achillea:clans-effectif` — dissolution des clans restés sous l'effectif minimal.
 *
 * Remplace `ClanJobs.checkClanMemberCount` de l'ancien bot. Quand un départ fait
 * passer un clan sous cinq membres, l'API pose `clan.under_member_limit = true`
 * (`apps/rg-bot/src/api/modules/achillea/clans/management.ts`) ; l'ancien bot
 * posait en plus un travail BullMQ à +24 h. Ici, la base fait foi : un clan
 * signalé depuis plus de 24 h est réexaminé à chaque passage —
 *
 *   - toujours sous cinq membres → dissous comme `disbandClan(…, job = true)` :
 *     salon et rôle du clan supprimés sur le serveur central, rôle de capitaine
 *     retiré au Président, membres retirés, annonce dans le salon de diffusion
 *     du serveur du clan et dans le salon des annonces de clans ;
 *   - revenu à cinq membres ou plus → le drapeau est levé.
 *
 * « Depuis plus de 24 h » se mesure au DERNIER départ (`clan_member_history`),
 * et à défaut à la dernière mise à jour du clan : c'est le départ qui a armé le
 * drapeau, et un clan qui perd encore un membre entre-temps repart pour 24 h,
 * comme le faisait l'ancien travail ré-armé à chaque départ.
 */
import { sql } from "../lib/db.js";
import {
  configAchilleaCron,
  discordAchillea,
  motifEchec,
  publierSalon,
  type ConfigAchilleaCron,
  type MessageDiscord,
  type PorteDiscordAchillea,
} from "../lib/achillea-discord.js";

/** Effectif minimal d'un clan (`MIN_CLAN_MEMBERS` de l'API). */
export const EFFECTIF_MINIMAL = 5;
/** Délai de grâce après le passage sous l'effectif minimal. */
export const DELAI_GRACE_MS = 24 * 60 * 60 * 1000;
/** Rôle de Président dans `clan_member.role` (`ClanMemberRole.Captain`). */
export const ROLE_PRESIDENT = 3;
/** Motif de départ consigné (`LeaveReason.Leave`) et précision lisible. */
export const MOTIF_DEPART_QUITTE = 3;
export const PRECISION_DISSOLUTION = "Dissolution automatique : effectif inférieur à 5 membres pendant 24 h";

export interface ClanSousEffectif {
  id: number;
  name: string;
  roleId: string;
  channelId: string;
  avatarUrl: string;
  founders: string[];
  fame: number;
  createdAt: Date;
  /** Salon de diffusion du serveur Discord du clan (`guild.broadcast_channel`). */
  salonDiffusion: string | null;
  membres: Array<{ userId: string; role: number }>;
}

export interface DepotClans {
  /** Clans signalés dont le délai de grâce est écoulé. */
  aExaminer(limite: Date): Promise<ClanSousEffectif[]>;
  leverDrapeau(clanId: number): Promise<void>;
  /** Retire les membres (avec historique), purge invitations et candidatures, marque dissous. */
  dissoudre(clan: ClanSousEffectif): Promise<boolean>;
}

export const depotClans: DepotClans = {
  async aExaminer(limite) {
    const clans = await sql<
      Array<{
        id: number;
        name: string;
        role_id: string;
        channel_id: string;
        clan_avatar_url: string;
        founders: string[];
        clan_fame: number;
        created_at: Date;
        broadcast_channel: string | null;
      }>
    >`
      SELECT c.id, c.name, c.role_id, c.channel_id, c.clan_avatar_url, c.founders, c.clan_fame, c.created_at,
             g.broadcast_channel
        FROM achillea.clan c
        LEFT JOIN achillea.guild g ON g.id = c.guild_id AND g.deleted = false
       WHERE c.under_member_limit = true
         AND c.is_disbanded = false
         AND COALESCE(
               (SELECT max(h.created_at) FROM achillea.clan_member_history h WHERE h.clan_id = c.id),
               c.updated_at
             ) <= ${limite}
       ORDER BY c.id`;
    if (clans.length === 0) return [];
    const ids = clans.map(c => c.id);
    const membres = await sql<Array<{ clan_id: number; user_id: string; role: number }>>`
      SELECT clan_id, user_id, role FROM achillea.clan_member WHERE clan_id = ANY(${ids}::int[])`;
    return clans.map(c => ({
      id: c.id,
      name: c.name,
      roleId: c.role_id,
      channelId: c.channel_id,
      avatarUrl: c.clan_avatar_url,
      founders: c.founders ?? [],
      fame: Number(c.clan_fame ?? 0),
      createdAt: new Date(c.created_at),
      salonDiffusion: c.broadcast_channel,
      membres: membres.filter(m => m.clan_id === c.id).map(m => ({ userId: m.user_id, role: Number(m.role) })),
    }));
  },
  async leverDrapeau(clanId) {
    await sql.begin(async tx => {
      await tx`SET LOCAL ROLE service_role`;
      await tx`UPDATE achillea.clan SET under_member_limit = false, updated_at = now() WHERE id = ${clanId}`;
    });
  },
  async dissoudre(clan) {
    return sql.begin(async tx => {
      await tx`SET LOCAL ROLE service_role`;
      // Verrou de ligne : un départ ou une adhésion concurrente attend la fin de la décision.
      const [etat] = await tx<Array<{ is_disbanded: boolean; under_member_limit: boolean }>>`
        SELECT is_disbanded, under_member_limit FROM achillea.clan WHERE id = ${clan.id} FOR UPDATE`;
      if (!etat || etat.is_disbanded || !etat.under_member_limit) return false;
      const [compte] = await tx<Array<{ n: number }>>`
        SELECT count(*)::int AS n FROM achillea.clan_member WHERE clan_id = ${clan.id}`;
      if (Number(compte?.n ?? 0) >= EFFECTIF_MINIMAL) return false;

      // La carrière du joueur garde la trace du clan, comme pour un départ.
      await tx`
        INSERT INTO achillea.clan_member_history
               (created_at, updated_at, user_id, clan_id, join_date, leave_reason, kick_reason, clan_fame_contributed, role)
        SELECT now(), now(), user_id, clan_id, created_at, ${MOTIF_DEPART_QUITTE}, ${PRECISION_DISSOLUTION},
               clan_fame_contributed, role
          FROM achillea.clan_member WHERE clan_id = ${clan.id}`;
      await tx`DELETE FROM achillea.clan_team_member WHERE member_clan_id = ${clan.id}`;
      await tx`DELETE FROM achillea.clan_member WHERE clan_id = ${clan.id}`;
      await tx`DELETE FROM achillea.clan_invite WHERE clan_id = ${clan.id}`;
      await tx`DELETE FROM achillea.clan_application WHERE clan_id = ${clan.id}`;
      await tx`
        UPDATE achillea.clan
           SET is_disbanded = true, under_member_limit = false, is_recruiting = false, updated_at = now()
         WHERE id = ${clan.id}`;
      return true;
    });
  },
};

/** Décision pour un clan signalé. */
export function decision(clan: Pick<ClanSousEffectif, "membres">): "dissoudre" | "lever" {
  return clan.membres.length < EFFECTIF_MINIMAL ? "dissoudre" : "lever";
}

const mention = (id: string) => `<@${id}>`;

/** Annonce publique de dissolution (`buildClanDisbandEmbed` de l'ancien bot). */
export function messageDissolution(clan: ClanSousEffectif, maintenant: Date): MessageDiscord {
  const jour = (d: Date) => d.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });
  return {
    embeds: [
      {
        color: 0xed4245,
        title: `Dissolution de Clan : ${clan.name}`,
        description: `__*Clan dissous le ${jour(maintenant)}*__`,
        ...(clan.avatarUrl.startsWith("http") ? { thumbnail: { url: clan.avatarUrl } } : {}),
        fields: [
          { name: "Fondateurs", value: clan.founders.map(f => `- ${mention(f)}`).join("\n") || "—", inline: true },
          { name: "Fondé le", value: jour(clan.createdAt), inline: true },
          { name: "Fame accumulée", value: String(clan.fame), inline: true },
        ],
      },
    ],
  };
}

/** Message au serveur du clan (`buildInfoEmbed` de l'ancien bot). */
export const MESSAGE_SERVEUR_CLAN: MessageDiscord = {
  embeds: [
    {
      color: 0x206694,
      title:
        "ℹ️ Votre Clan a été dissous car il ne respectait plus le minimum de membres requis ! Merci d'avoir contribué à la communauté et au plaisir de vous revoir.",
    },
  ],
};

export interface ResultatClansEffectif {
  success: true;
  examines: number;
  dissous: string[];
  drapeauxLeves: string[];
  avertissements: string[];
}

export async function runAchilleaClansEffectif(
  depot: DepotClans = depotClans,
  discord: PorteDiscordAchillea = discordAchillea,
  config: ConfigAchilleaCron = configAchilleaCron(),
  maintenant: Date = new Date(),
): Promise<ResultatClansEffectif> {
  const clans = await depot.aExaminer(new Date(maintenant.getTime() - DELAI_GRACE_MS));
  const resultat: ResultatClansEffectif = {
    success: true,
    examines: clans.length,
    dissous: [],
    drapeauxLeves: [],
    avertissements: [],
  };

  for (const clan of clans) {
    if (decision(clan) === "lever") {
      await depot.leverDrapeau(clan.id);
      resultat.drapeauxLeves.push(clan.name);
      console.info(`[achillea:clans-effectif] ${clan.name} est revenu à ${clan.membres.length} membres.`);
      continue;
    }
    if (!(await depot.dissoudre(clan))) continue;
    resultat.dissous.push(clan.name);
    console.warn(`[achillea:clans-effectif] ${clan.name} : ${clan.membres.length} membre(s) après 24 h, dissous.`);

    const raison = `Clan ${clan.name} dissous (effectif insuffisant)`;
    const guilde = config.guildeCentrale;
    const president = clan.membres.find(m => m.role === ROLE_PRESIDENT);
    const effets = await Promise.all([
      discord.rest("DELETE", `/channels/${clan.channelId}`, undefined, raison),
      discord.rest("DELETE", `/guilds/${guilde}/roles/${clan.roleId}`, undefined, raison),
      president && config.roleCapitaine
        ? discord.rest("DELETE", `/guilds/${guilde}/members/${president.userId}/roles/${config.roleCapitaine}`, undefined, raison)
        : Promise.resolve({ ok: true as const, data: null }),
      clan.salonDiffusion
        ? publierSalon(discord, clan.salonDiffusion, MESSAGE_SERVEUR_CLAN)
        : Promise.resolve({ ok: true as const, data: null }),
      config.salonAnnoncesClans
        ? publierSalon(discord, config.salonAnnoncesClans, messageDissolution(clan, maintenant))
        : Promise.resolve({ ok: true as const, data: null }),
    ]);
    const libelles = ["salon du clan", "rôle du clan", "rôle de capitaine", "salon de diffusion", "annonce"];
    effets.forEach((effet, index) => {
      // 404 : déjà supprimé à la main — l'état voulu est atteint.
      if (!effet.ok && effet.statut !== 404)
        resultat.avertissements.push(`${clan.name} — ${libelles[index]} : ${motifEchec(effet)}`);
    });
  }
  for (const avertissement of resultat.avertissements) console.warn(`[achillea:clans-effectif] ${avertissement}`);
  return resultat;
}
