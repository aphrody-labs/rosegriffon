/**
 * Copyright 2026 Rose Griffon
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Intégrations Discord du ranked Achilléa : trois tâches, une par service de
 * l'ancien bot (`events/ranked-integrations.ts` les démarrait sur `ready` avec
 * un `setInterval` de 10 min chacun, donc seulement tant que la passerelle
 * vivait, et en double à chaque reconnexion mal nettoyée).
 *
 *   - `achillea:classement-annonce` (`LeaderboardAnnounceService`) : top 10
 *     1v1 et 2v2 de la saison active, un message unique édité en place dans
 *     🏅・leaderboard ;
 *   - `achillea:ranked-file` (`RankedQueuePanelService`) : panneau « Jouer sur
 *     le site », joueurs classés et cinq derniers résultats 1v1 dans
 *     🎮・ranked-queue ;
 *   - `achillea:ranked-promotions` (`RankedPromotionService`) : montées de
 *     palier 1v1 depuis le passage précédent, annoncées dans 🚨・annonces-ranked
 *     et félicitées (mentions) dans 💬・général-ranked.
 *
 * Lecture seule sur le ranked (`user_elo`, `lobby`) ; la seule écriture est la
 * mémoire `achillea.data` (identifiants de message, relevé des paliers), avec
 * les clés de l'ancien bot pour reprendre ses messages.
 */
import { sql } from "../lib/db.js";
import {
  configAchilleaCron,
  discordAchillea,
  motifEchec,
  publierOuEditer,
  publierSalon,
  type ConfigAchilleaCron,
  type MessageDiscord,
  type PorteDiscordAchillea,
} from "../lib/achillea-discord.js";
import { ecrireJson, lireJson, memoireAchillea, type MemoireAchillea } from "../lib/achillea-memoire.js";

export const CLE_MESSAGE_CLASSEMENT = "leaderboardMessageId";
export const CLE_MESSAGE_FILE = "rankedQueueMessageId";
export const CLE_RELEVE_PALIERS = "rankedTierSnapshot";
/** Au-delà, une passe est jugée anormale (réinitialisation, relevé corrompu) : rien n'est annoncé. */
export const PROMOTIONS_MAX_PAR_PASSE = 10;

export const MODE_1V1 = 2;
export const MODE_2V2 = 4;

export interface Palier {
  key: string;
  minElo: number;
  maxElo: number;
  emojiId: string;
  emojiKey: string;
}

export interface EntreeClassement {
  userId: string;
  nom: string;
  elo: number;
  parties: number;
  rang: number;
}

/** Émoji de palier (`<:cle:id> `), vide sans émoji. */
export function emojiPalier(palier: Palier | undefined): string {
  return palier?.emojiId ? `<:${palier.emojiKey || palier.key}:${palier.emojiId}> ` : "";
}

/** Indice du palier d'un Elo dans la liste triée par `minElo` (0 si hors bornes, comme l'ancien bot). */
export function indicePalier(paliers: readonly Palier[], elo: number): number {
  const i = paliers.findIndex(p => elo >= p.minElo && elo <= p.maxElo);
  return i === -1 ? 0 : i;
}

export function trierPaliers(paliers: readonly Palier[]): Palier[] {
  return [...paliers].sort((a, b) => a.minElo - b.minElo);
}

function ligneClassement(entree: EntreeClassement, paliers: readonly Palier[]): string {
  const medaille = entree.rang === 1 ? "🥇" : entree.rang === 2 ? "🥈" : entree.rang === 3 ? "🥉" : `\`#${entree.rang}\``;
  const parties = `${entree.parties} partie${entree.parties > 1 ? "s" : ""}`;
  return `${medaille} ${emojiPalier(paliers[indicePalier(paliers, entree.elo)])}**${entree.nom}** — ${entree.elo} pts · ${parties}`;
}

/** Embed du classement (texte de `LeaderboardAnnounceService.buildEmbed`). */
export function messageClassement(
  saison: string,
  solo: readonly EntreeClassement[],
  duo: readonly EntreeClassement[],
  paliers: readonly Palier[],
  maintenant: Date,
): MessageDiscord {
  const tries = trierPaliers(paliers);
  const bloc = (entrees: readonly EntreeClassement[]) =>
    entrees.length > 0 ? entrees.map(e => ligneClassement(e, tries)).join("\n") : "_Aucun joueur classé._";
  return {
    embeds: [
      {
        title: "🏅 Classement Ranked",
        description: `Saison **${saison}** · mis à jour automatiquement toutes les 10 min`,
        fields: [
          { name: "🎮 1v1", value: bloc(solo), inline: false },
          { name: "👥 2v2", value: bloc(duo), inline: false },
        ],
        color: 0xf1c40f,
        footer: { text: "rosegriffon.fr/achillea" },
        timestamp: maintenant.toISOString(),
      },
    ],
  };
}

export interface ResultatRecent {
  p1: string | null;
  s1: number | null;
  p2: string | null;
  s2: number | null;
}

/** Panneau de la file (texte de `RankedQueuePanelService.refresh`). */
export function messageFile(joueursClasses: number, resultats: readonly ResultatRecent[], urlRanked: string): MessageDiscord {
  const flux =
    resultats.length > 0
      ? resultats
          .map(r => {
            const p1 = r.p1 ?? "Joueur";
            const p2 = r.p2 ?? "Joueur";
            const s1 = r.s1 ?? 0;
            const s2 = r.s2 ?? 0;
            return `${s1 >= s2 ? `**${p1}**` : p1} ${s1}–${s2} ${s2 > s1 ? `**${p2}**` : p2}`;
          })
          .join("\n")
      : "_Aucun match récent._";
  return {
    embeds: [
      {
        title: "🎮 File Ranked",
        description:
          "Rejoins la file et joue tes matchs classés **directement sur le site** — " +
          "le résultat, ton Elo et ton palier sont mis à jour en temps réel.",
        fields: [
          { name: "Joueurs classés", value: `**${joueursClasses}**`, inline: true },
          { name: "Derniers résultats (1v1)", value: flux, inline: false },
        ],
        color: 0x5865f2,
        footer: { text: "Le matchmaking se fait sur le site." },
      },
    ],
    components: [
      { type: 1, components: [{ type: 2, style: 5, label: "🔗 Jouer sur le site", url: urlRanked }] },
    ],
  };
}

/**
 * Promotions depuis le relevé précédent. Premier passage (relevé vide) : aucune
 * annonce, seulement l'initialisation — sinon tout le classement « monterait ».
 */
export function detecterPromotions(
  precedent: Readonly<Record<string, number>> | null,
  actuels: ReadonlyArray<{ userId: string; elo: number }>,
  paliers: readonly Palier[],
): { releve: Record<string, number>; promotions: Array<{ userId: string; indice: number }>; premierPassage: boolean } {
  const tries = trierPaliers(paliers);
  const releve: Record<string, number> = {};
  const promotions: Array<{ userId: string; indice: number }> = [];
  for (const { userId, elo } of actuels) {
    const indice = indicePalier(tries, elo);
    releve[userId] = indice;
    const avant = precedent?.[userId];
    if (avant !== undefined && indice > avant) promotions.push({ userId, indice });
  }
  return { releve, promotions, premierPassage: !precedent || Object.keys(precedent).length === 0 };
}

export function messagesPromotions(
  promotions: ReadonlyArray<{ userId: string; indice: number }>,
  paliers: readonly Palier[],
  noms: ReadonlyMap<string, string>,
): { annonce: MessageDiscord; felicitations: MessageDiscord } {
  const tries = trierPaliers(paliers);
  const lignes = promotions.map(p => {
    const palier = tries[p.indice];
    return `${emojiPalier(palier)}**${noms.get(p.userId) ?? "Joueur"}** accède au palier **${palier?.key ?? "?"}**`;
  });
  return {
    annonce: { embeds: [{ title: "🎉 Promotions de palier", description: lignes.join("\n"), color: 0xf1c40f }] },
    felicitations: {
      content: `👏 Félicitations ${promotions.map(p => `<@${p.userId}>`).join(" ")} pour votre montée de palier !`,
      mentionsUtilisateurs: promotions.map(p => p.userId),
    },
  };
}

// ─── Lectures ───────────────────────────────────────────────────────────────

export interface DepotRanked {
  saisonActive(): Promise<{ id: string; name: string } | null>;
  /** Top N des joueurs ayant joué, rang dense sur tout le mode/saison (`LeaderboardService.getTop`). */
  top(saisonId: string | null, mode: number, limite: number): Promise<EntreeClassement[]>;
  paliers(): Promise<Palier[]>;
  joueursClasses(): Promise<number>;
  resultatsRecents(): Promise<ResultatRecent[]>;
  elos1v1(): Promise<Array<{ userId: string; elo: number }>>;
  noms(ids: readonly string[]): Promise<Map<string, string>>;
}

export const depotRanked: DepotRanked = {
  async saisonActive() {
    const [ligne] = await sql<Array<{ id: string; name: string }>>`
      SELECT id, name FROM achillea.season WHERE state = 'Active' ORDER BY starts_at DESC LIMIT 1`;
    return ligne ?? null;
  },
  async top(saisonId, mode, limite) {
    const lignes = await sql<Array<{ user_id: string; elo: number; games_played: number; rang: number; nom: string | null }>>`
      SELECT r.user_id, r.elo, r.games_played, r.rang,
             COALESCE(NULLIF(u.display_name, ''), u.username, 'Joueur') AS nom
        FROM (
          SELECT ue.user_id, ue.elo, ue.games_played, DENSE_RANK() OVER (ORDER BY ue.elo DESC) AS rang
            FROM achillea.user_elo ue
           WHERE ue.season_id::text IS NOT DISTINCT FROM ${saisonId}::text
             AND ue.mode = ${mode}
        ) r
        LEFT JOIN achillea."user" u ON u.id = r.user_id
       WHERE r.games_played > 0
       ORDER BY r.rang, r.user_id
       LIMIT ${limite}`;
    return lignes.map(l => ({
      userId: l.user_id,
      nom: l.nom ?? "Joueur",
      elo: Number(l.elo),
      parties: Number(l.games_played),
      rang: Number(l.rang),
    }));
  },
  async paliers() {
    return sql<Palier[]>`
      SELECT key, min_elo AS "minElo", max_elo AS "maxElo", emoji_id AS "emojiId", emoji_key AS "emojiKey"
        FROM achillea.rank ORDER BY min_elo`;
  },
  async joueursClasses() {
    const [ligne] = await sql<Array<{ n: number }>>`SELECT count(*)::int AS n FROM achillea.user_elo WHERE games_played > 0`;
    return Number(ligne?.n ?? 0);
  },
  async resultatsRecents() {
    return sql<ResultatRecent[]>`
      SELECT max(COALESCE(NULLIF(u.display_name, ''), u.username)) FILTER (WHERE lu.team = 1) AS p1,
             max(lu.score) FILTER (WHERE lu.team = 1) AS s1,
             max(COALESCE(NULLIF(u.display_name, ''), u.username)) FILTER (WHERE lu.team = 2) AS p2,
             max(lu.score) FILTER (WHERE lu.team = 2) AS s2
        FROM achillea.lobby l
        JOIN achillea.lobby_user lu ON lu.lobby_id = l.id
        JOIN achillea."user" u ON u.id = lu.user_id
       WHERE l.event_type = 'RANKED' AND l.state = 'Finished' AND l.mode = ${MODE_1V1}
       GROUP BY l.id
       ORDER BY l.id DESC
       LIMIT 5`;
  },
  async elos1v1() {
    // Saison active ou, hors saison, les lignes sans saison : un même joueur n'a qu'une ligne par mode et saison.
    const lignes = await sql<Array<{ user_id: string; elo: number }>>`
      SELECT ue.user_id, ue.elo
        FROM achillea.user_elo ue
       WHERE ue.mode = ${MODE_1V1} AND ue.games_played > 0
         AND ue.season_id IS NOT DISTINCT FROM (
           SELECT id FROM achillea.season WHERE state = 'Active' ORDER BY starts_at DESC LIMIT 1
         )`;
    return lignes.map(l => ({ userId: l.user_id, elo: Number(l.elo) }));
  },
  async noms(ids) {
    if (ids.length === 0) return new Map();
    const lignes = await sql<Array<{ id: string; nom: string | null }>>`
      SELECT id, COALESCE(NULLIF(display_name, ''), username, 'Joueur') AS nom
        FROM achillea."user" WHERE id = ANY(${[...ids]}::text[])`;
    return new Map(lignes.map(l => [l.id, l.nom ?? "Joueur"]));
  },
};

// ─── Tâches ─────────────────────────────────────────────────────────────────

export interface ResultatPanneau {
  success: boolean;
  /** Intégration désactivée (salon vide dans la configuration). */
  ignore?: boolean;
  action?: "edite" | "publie";
  messageId?: string;
  error?: string;
}

async function maintenirPanneau(
  discord: PorteDiscordAchillea,
  memoire: MemoireAchillea,
  salon: string,
  cle: string,
  message: MessageDiscord,
): Promise<ResultatPanneau> {
  const connu = await lireJson<string>(memoire, cle);
  const envoi = await publierOuEditer(discord, salon, typeof connu === "string" && connu !== "" ? connu : null, message);
  if (!envoi.ok) return { success: false, error: `salon ${salon} : ${motifEchec(envoi)}` };
  if (envoi.data.action === "publie") await ecrireJson(memoire, cle, envoi.data.id);
  return { success: true, action: envoi.data.action, messageId: envoi.data.id };
}

export async function runAchilleaClassementAnnonce(
  depot: DepotRanked = depotRanked,
  discord: PorteDiscordAchillea = discordAchillea,
  memoire: MemoireAchillea = memoireAchillea,
  config: ConfigAchilleaCron = configAchilleaCron(),
  maintenant: Date = new Date(),
): Promise<ResultatPanneau> {
  if (!config.salonClassement) return { success: true, ignore: true };
  const saison = await depot.saisonActive();
  const [solo, duo, paliers] = await Promise.all([
    depot.top(saison?.id ?? null, MODE_1V1, 10),
    depot.top(saison?.id ?? null, MODE_2V2, 10),
    depot.paliers(),
  ]);
  return maintenirPanneau(
    discord,
    memoire,
    config.salonClassement,
    CLE_MESSAGE_CLASSEMENT,
    messageClassement(saison?.name ?? "Saison en cours", solo, duo, paliers, maintenant),
  );
}

export async function runAchilleaRankedFile(
  depot: DepotRanked = depotRanked,
  discord: PorteDiscordAchillea = discordAchillea,
  memoire: MemoireAchillea = memoireAchillea,
  config: ConfigAchilleaCron = configAchilleaCron(),
): Promise<ResultatPanneau> {
  if (!config.salonFileRanked) return { success: true, ignore: true };
  const [joueurs, resultats] = await Promise.all([depot.joueursClasses(), depot.resultatsRecents()]);
  return maintenirPanneau(
    discord,
    memoire,
    config.salonFileRanked,
    CLE_MESSAGE_FILE,
    messageFile(joueurs, resultats, `${config.siteAchillea}/ranked`),
  );
}

export interface ResultatPromotions {
  success: true;
  joueurs: number;
  promotions: number;
  /** `initialisation` au premier passage, `anomalie` au-delà du plafond, `annoncees` sinon. */
  issue: "aucune" | "initialisation" | "anomalie" | "annoncees";
  avertissements: string[];
}

export async function runAchilleaRankedPromotions(
  depot: DepotRanked = depotRanked,
  discord: PorteDiscordAchillea = discordAchillea,
  memoire: MemoireAchillea = memoireAchillea,
  config: ConfigAchilleaCron = configAchilleaCron(),
): Promise<ResultatPromotions> {
  const paliers = await depot.paliers();
  if (paliers.length === 0) return { success: true, joueurs: 0, promotions: 0, issue: "aucune", avertissements: [] };
  const actuels = await depot.elos1v1();
  const precedent = await lireJson<Record<string, number>>(memoire, CLE_RELEVE_PALIERS);
  const { releve, promotions, premierPassage } = detecterPromotions(precedent, actuels, paliers);
  await ecrireJson(memoire, CLE_RELEVE_PALIERS, releve);

  const base = { success: true as const, joueurs: actuels.length, promotions: promotions.length, avertissements: [] as string[] };
  if (premierPassage) return { ...base, issue: "initialisation" };
  if (promotions.length === 0) return { ...base, issue: "aucune" };
  if (promotions.length > PROMOTIONS_MAX_PAR_PASSE) {
    console.warn(`[achillea:ranked-promotions] ${promotions.length} promotions en une passe : anomalie suspectée, rien n'est annoncé.`);
    return { ...base, issue: "anomalie" };
  }
  const noms = await depot.noms(promotions.map(p => p.userId));
  const { annonce, felicitations } = messagesPromotions(promotions, paliers, noms);
  for (const [salon, message] of [
    [config.salonAnnoncesRanked, annonce],
    [config.salonGeneralRanked, felicitations],
  ] as const) {
    if (!salon) continue;
    const envoi = await publierSalon(discord, salon, message);
    if (!envoi.ok) base.avertissements.push(`salon ${salon} : ${motifEchec(envoi)}`);
  }
  return { ...base, issue: "annoncees" };
}
