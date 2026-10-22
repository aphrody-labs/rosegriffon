/**
 * Jeux de données API communs aux tests de `/clan manage` et `/clan teams`.
 * Formes exactes que valident les schémas zod du client Achilléa.
 */
export const CLAN_ID = 42;
export const PRESIDENT = "100000000000000001";
export const VICE = "100000000000000002";
export const MEMBRE = "100000000000000005";

export function appartenance(role: number | null) {
  return role === null
    ? { clanId: null, clanRole: null, clan: null }
    : {
        clanId: CLAN_ID,
        clanRole: role,
        clan: { id: CLAN_ID, name: "Raimon", shortenedName: "RMN", avatarUrl: "https://cdn.test/raimon.png" },
      };
}

export const CLAN = {
  id: CLAN_ID,
  founders: [PRESIDENT, VICE],
  name: "Raimon",
  shortenedName: "RMN",
  normalizedShortName: "rmn",
  clanAvatarUrl: "https://cdn.test/raimon.png",
  clanBiography: "Le clan de Raimon",
  fame: 10,
  xUrl: null,
  instagramUrl: null,
  tiktokUrl: null,
  isRecruiting: true,
  isInactive: false,
  isHidden: false,
  isDisbanded: false,
  autoAcceptMembers: false,
  state: 2,
  createdAt: "2026-01-01T00:00:00.000Z",
  languages: ["fr"],
  origin: "fr",
  experience: { currentLevel: 1, totalXp: 0 },
  membersCount: 3,
  president: { id: PRESIDENT, username: "Endou" },
};

function membreDto(id: string, role: number, nom: string) {
  return {
    clanRole: role,
    distinctions: ["Joueur"],
    clanFameContributed: 0,
    createdAt: "2026-02-01T00:00:00.000Z",
    updatedAt: "2026-02-01T00:00:00.000Z",
    user: { id, username: nom },
  };
}

export const MEMBRES = [membreDto(PRESIDENT, 3, "Endou"), membreDto(VICE, 2, "Kazemaru"), membreDto(MEMBRE, 0, "Kabeyama")];

export const INVITATION = {
  id: 9,
  user: { id: "100000000000000009", username: "Fubuki" },
  clan: CLAN,
  inviter: membreDto(VICE, 2, "Kazemaru"),
  distinctions: ["Joueur"],
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
  lastNotifiedAt: "2026-10-01T00:00:00.000Z",
};

export function equipe(type: 0 | 1, id = 70 + type) {
  return {
    id,
    clanId: CLAN_ID,
    name: type === 0 ? "Equipe principale" : "Equipe secondaire",
    type,
    captainUserId: type === 0 ? MEMBRE : null,
    updatedAt: "2026-10-01T00:00:00.000Z",
    members: type === 0 ? [{ linkId: 1, userId: MEMBRE, displayName: "Kabeyama", avatar: null, role: 0 }] : [],
    valid: false,
    errors: ["Il faut au moins 3 joueurs."],
  };
}

/** Routes de lecture d'un clan, au rang demandé. */
export function routesClan(role: number | null): Record<string, unknown> {
  return {
    "GET /clans/teams/membership": appartenance(role),
    [`GET /clans/${CLAN_ID}`]: CLAN,
    [`GET /clans/${CLAN_ID}/members`]: MEMBRES,
    "GET /clans/invites": [INVITATION],
  };
}
