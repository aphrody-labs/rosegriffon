import { afterEach, describe, expect, test } from "bun:test";

import { fausseInteraction, installerApi, type AppelApi } from "../../../test/achillea-kit";
import { bilan, boutonsFicheJoueur, CommandeCarteJoueur, CommandeListeNoire, CommandePlayer } from "./joueur";

let restaurer: (() => void) | null = null;
afterEach(() => {
  restaurer?.();
  restaurer = null;
});
function api(routes: Parameters<typeof installerApi>[0]): AppelApi[] {
  const installation = installerApi(routes);
  restaurer = installation.restaurer;
  return installation.appels;
}

const MOI = "111111111111111111";
const AUTRE = { id: "333333333333333333", username: "akira", bot: false };
const stats = { total: 4, wins: 3, losses: 1, draws: 0, goalsScoredAvg: 2, goalsReceivedAvg: 1, personalTotal: 4, personalWins: 3, personalLosses: 1, personalDraws: 0 };
const modeStats = (mode: number) => ({ mode, total: 0, wins: 0, losses: 0, draws: 0, goalsScored: 0, goalsReceived: 0 });
const profil = (id: string, champs: Record<string, unknown> = {}) => ({
  id,
  username: "akira",
  avatar: "https://cdn.discordapp.com/avatars/1/a.png",
  soloRank: { elo: 1200, key: "Or", gradient: [] },
  interclans: stats,
  tournaments: stats,
  ranked: { solo: modeStats(2), duo: modeStats(4) },
  bio: null,
  twitchUrl: null,
  ...champs,
});

describe("présentation", () => {
  test("bilan et boutons legacy", () => {
    expect(bilan({ total: 0, wins: 0, losses: 0, draws: 0 })).toBe("Aucun match");
    expect(bilan(stats)).toBe("4 matchs · 3V 0N 1D");
    expect(boutonsFicheJoueur("42").toJSON().components.map(c => (c as { custom_id?: string }).custom_id)).toEqual([
      "init_invite:42",
      "get_clan_history:42",
    ]);
  });
});

describe("/player infos", () => {
  test("fiche d'un autre joueur, avec les boutons legacy", async () => {
    const appels = api({ [`GET /users/${AUTRE.id}`]: profil(AUTRE.id) });
    const interaction = fausseInteraction();
    await new CommandePlayer().infos(AUTRE as never, interaction as never);
    expect(appels[0]?.chemin).toBe(`/users/${AUTRE.id}`);
    expect(interaction.texte()).toContain("Or (1200)");
    expect(interaction.texte()).toContain(`init_invite:${AUTRE.id}`);
  });

  test("joueur inconnu de l'API : message clair", async () => {
    api({ [`GET /users/${MOI}`]: [404, { message: "User not found" }] });
    const interaction = fausseInteraction();
    await new CommandePlayer().infos(undefined, interaction as never);
    expect(interaction.texte()).toContain("profil joueur actif");
    expect(interaction.texte()).toContain("User not found");
  });
});

describe("/player settings", () => {
  test("Twitch non lié : lien d'association généré par l'API", async () => {
    const appels = api({
      [`GET /users/${MOI}`]: profil(MOI),
      "GET /auth/oauth/twitch/start": { url: "https://id.twitch.tv/oauth2/authorize?state=x" },
    });
    const interaction = fausseInteraction();
    await new CommandePlayer().settings(interaction as never);
    expect(appels.map(a => a.chemin)).toEqual([`/users/${MOI}`, "/auth/oauth/twitch/start"]);
    expect(interaction.texte()).toContain("id.twitch.tv");
  });

  test("Twitch déjà lié", async () => {
    api({ [`GET /users/${MOI}`]: profil(MOI, { twitchUrl: "https://twitch.tv/akira" }) });
    const interaction = fausseInteraction();
    await new CommandePlayer().settings(interaction as never);
    expect(interaction.texte()).toContain("déjà lié");
  });

  test("refus (401) de l'API", async () => {
    api({ [`GET /users/${MOI}`]: profil(MOI), "GET /auth/oauth/twitch/start": [403, { message: "Authentication required" }] });
    const interaction = fausseInteraction();
    await new CommandePlayer().settings(interaction as never);
    expect(interaction.texte()).toContain("Authentication required");
  });
});

describe("/player-card", () => {
  test("PNG joint", async () => {
    api({
      [`GET /users/${MOI}`]: profil(MOI),
      [`GET /users/${MOI}/card.png`]: () => new Response(new Uint8Array([137, 80, 78, 71]), { headers: { "content-type": "image/png" } }),
    });
    const interaction = fausseInteraction();
    await new CommandeCarteJoueur().carte(undefined, interaction as never);
    const derniere = interaction.envois.at(-1)?.charge as { files?: unknown[]; content?: string };
    expect(derniere.files).toHaveLength(1);
    expect(derniere.content).toContain("akira");
  });

  test("génération refusée (403)", async () => {
    api({ [`GET /users/${MOI}`]: profil(MOI), [`GET /users/${MOI}/card.png`]: [403, { message: "Carte privée" }] });
    const interaction = fausseInteraction();
    await new CommandeCarteJoueur().carte(undefined, interaction as never);
    expect(interaction.texte()).toContain("Carte privée");
  });
});

describe("/blacklist", () => {
  const entree = { userId: AUTRE.id, username: "akira", displayName: "Akira", reason: "triche", since: "2026-01-01T00:00:00.000Z" };

  test("liste complète", async () => {
    api({ "GET /blacklist": { data: [entree] } });
    const interaction = fausseInteraction();
    await new CommandeListeNoire().blacklist(undefined, interaction as never);
    expect(interaction.texte()).toContain(`\`${AUTRE.id}\` : Akira`);
  });

  test("un joueur présent / absent", async () => {
    api({
      [`GET /blacklist/${AUTRE.id}`]: { userId: AUTRE.id, entry: entree },
      "GET /blacklist/444444444444444444": { userId: "444444444444444444", entry: null },
    });
    const present = fausseInteraction();
    await new CommandeListeNoire().blacklist(AUTRE as never, present as never);
    expect(present.texte()).toContain("triche");
    const absent = fausseInteraction();
    await new CommandeListeNoire().blacklist({ id: "444444444444444444", username: "zed" } as never, absent as never);
    expect(absent.texte()).toContain("n'est pas sur la liste noire");
  });

  test("compte inconnu (404)", async () => {
    api({ [`GET /blacklist/${AUTRE.id}`]: [404, { message: "Ce joueur n'a pas de compte Achilléa." }] });
    const interaction = fausseInteraction();
    await new CommandeListeNoire().blacklist(AUTRE as never, interaction as never);
    expect(interaction.texte()).toContain("pas de compte");
  });
});
