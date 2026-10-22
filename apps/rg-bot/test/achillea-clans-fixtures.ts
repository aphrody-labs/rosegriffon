/** Réponses d'API factices pour les tests des commandes de clan Achilléa. */

export const JOUEUR_TEST = "111111111111111111";
export const PRESIDENT_TEST = "222222222222222222";

/** `GET /clans/fiche/:ref`. */
export function ficheFactice(surcharge: Record<string, unknown> = {}) {
  return {
    id: 42,
    name: "Paris Griffon",
    shortName: "PSG",
    avatarUrl: "https://cdn.example/psg.png",
    biography: "Un clan de test au long cours.",
    fame: 120,
    emojiId: "",
    isRecruiting: true,
    isDisbanded: false,
    isInactive: false,
    autoAcceptMembers: false,
    underMemberLimit: false,
    state: 2,
    createdAt: "2026-01-01T00:00:00.000Z",
    level: 3,
    totalXp: 450,
    socials: { x: "https://x.com/psg", instagram: null, tiktok: null },
    languages: ["FR"],
    origin: "FR",
    guildId: null,
    president: { id: PRESIDENT_TEST, name: "Chef" },
    members: [{ id: PRESIDENT_TEST, name: "Chef", role: 3, distinctions: ["Staff"], joinedAt: "2026-01-01T00:00:00.000Z" }],
    ...surcharge,
  };
}

/** `GET /clans/history/:userId` — `role` du clan actuel, `null` hors clan. */
export function carriereFactice(role: number | null) {
  return {
    userId: JOUEUR_TEST,
    displayName: "joueur",
    since: "2025-06-01T00:00:00.000Z",
    current:
      role === null
        ? []
        : [{ clanId: 42, clanName: "Paris Griffon", shortName: "PSG", emojiId: "", role, joinedAt: "2026-02-01T00:00:00.000Z" }],
    past: [],
  };
}
