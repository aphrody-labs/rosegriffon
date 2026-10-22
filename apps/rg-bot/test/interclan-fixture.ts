/**
 * Fiche d'interclan de référence pour les tests (forme JSON de `GET /interclans/:id`).
 */
import type { DetailInterclan } from "../src/api/modules/achillea/interclans/messages";

export const CLAN_A = {
  id: 7,
  name: "Aigles Rouges",
  shortName: "AR",
  normalizedShortName: "ar",
  emojiId: "1300000000000000001",
  avatarUrl: "https://cdn.example/ar.png",
  roleId: "1400000000000000007",
  channelId: "1500000000000000007",
};
export const CLAN_B = {
  id: 9,
  name: "Brume Bleue",
  shortName: "BB",
  normalizedShortName: "bb",
  emojiId: null,
  avatarUrl: "https://cdn.example/bb.png",
  roleId: "1400000000000000009",
  channelId: "1500000000000000009",
};

const joueurs = (prefixe: string) =>
  Array.from({ length: 5 }, (_, i) => ({ userId: `${prefixe}${i + 1}`.padEnd(18, "0"), displayName: `${prefixe}-${i + 1}`, position: i + 1 }));

export function ficheInterclan(surcharge: Partial<DetailInterclan> = {}): DetailInterclan {
  return {
    id: 42,
    name: "AR vs BB",
    description: "Revanche",
    state: 1,
    stateLabel: "🟢 Accepté",
    fixedDate: "2026-10-25T18:00:00.000Z",
    createdAt: "2026-10-22T10:00:00.000Z",
    updatedAt: "2026-10-22T10:05:00.000Z",
    discordChannelId: "1600000000000000042",
    winnerClanId: null,
    clanA: CLAN_A,
    clanB: CLAN_B,
    lineups: [
      { id: 1, clanId: 7, lockedIn: false, valid: true, members: joueurs("1") },
      { id: 2, clanId: 9, lockedIn: false, valid: false, members: joueurs("2").slice(0, 3) },
    ],
    matches: [],
    validation: null,
    viewer: { clanId: 7, clanRole: 3, isAdmin: false },
    ...surcharge,
  };
}

/** Matchs d'un interclan lancé : le premier est joué (2–1), les autres non. */
export function matchsEnCours() {
  return Array.from({ length: 5 }, (_, i) => ({
    id: 100 + i,
    state: i === 0 ? "Finished" : "Fresh",
    players: [
      { userId: `1${i + 1}`.padEnd(18, "0"), displayName: `1-${i + 1}`, team: 1, score: i === 0 ? 2 : 0 },
      { userId: `2${i + 1}`.padEnd(18, "0"), displayName: `2-${i + 1}`, team: 2, score: i === 0 ? 1 : 0 },
    ],
  }));
}
