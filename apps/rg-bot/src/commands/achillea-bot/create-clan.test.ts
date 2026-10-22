/**
 * `/create-clan` : contrôles locaux, modale `createClan1`, dépôt du logo puis
 * création par l'API au nom du fondateur.
 */
import { afterEach, describe, expect, spyOn, test } from "bun:test";

import { fausseInteraction, installerApi, type Gestionnaire } from "../../../test/achillea-kit";
import { CreationClan, refusFondateurs, reprendreCreation, retenirCreation } from "./create-clan";

const AUTEUR = "111111111111111111";
const membres = ["300000000000000001", "300000000000000002", "300000000000000003", "300000000000000004"].map(id => ({
  id,
  bot: false,
}));
const logo = { url: "https://cdn.discordapp.com/attachments/1/2/logo.png?ex=1", name: "logo.png", contentType: "image/png" };
const champs = {
  clanName: "Paris Griffon",
  clanShortenedName: "PSG",
  clanBiography: "Le clan de test le plus sérieux du serveur.",
  socialMedia: "https://x.com/psg",
};

let restaurer: (() => void) | null = null;
let fetchEspion: ReturnType<typeof spyOn> | null = null;
afterEach(() => {
  restaurer?.();
  restaurer = null;
  fetchEspion?.mockRestore();
  fetchEspion = null;
});

function api(routes: Record<string, Gestionnaire | unknown>) {
  const installe = installerApi(routes);
  restaurer = installe.restaurer;
  return installe.appels;
}

/** Le téléchargement du logo depuis le CDN Discord passe par le `fetch` global. */
function cdnRepond(statut = 200) {
  fetchEspion = spyOn(globalThis, "fetch").mockImplementation((async () =>
    new Response(new Uint8Array([137, 80, 78, 71]), { status: statut, headers: { "content-type": "image/png" } })) as never);
}

const cmd = new CreationClan();

describe("contrôles avant la modale", () => {
  test("doublons et bots refusés", () => {
    expect(refusFondateurs(AUTEUR, [...membres.slice(0, 3), { id: AUTEUR, bot: false }])).toContain("dupliqués");
    expect(refusFondateurs(AUTEUR, [...membres.slice(0, 3), { id: "9", bot: true }])).toContain("bot");
    expect(refusFondateurs(AUTEUR, membres)).toBeNull();
  });

  test("logo dans un format refusé : pas de modale", async () => {
    const i = fausseInteraction({ utilisateur: { id: AUTEUR } });
    await cmd.creer(...(membres as never as [never, never, never, never]), { ...logo, contentType: "image/gif" } as never, i as never);
    expect(i.envois.some(e => e.via === "showModal")).toBe(false);
    expect(i.texte()).toContain("format");
  });

  test("l'état attend dix minutes, puis expire", () => {
    retenirCreation("5", { fondateurs: [], logo: { url: "", nom: "", type: "" }, expireLe: 1000 }, 0);
    expect(reprendreCreation("5", 2000)).toBeNull();
    retenirCreation("5", { fondateurs: ["a"], logo: { url: "", nom: "", type: "" }, expireLe: 5000 }, 0);
    expect(reprendreCreation("5", 1000)?.fondateurs).toEqual(["a"]);
    expect(reprendreCreation("5", 1000)).toBeNull();
  });
});

describe("modale createClan1", () => {
  test("nominal : logo déposé puis clan créé au nom du fondateur", async () => {
    const appels = api({
      "POST /proxy/upload": { id: "img1", url: "https://images.rosegriffon.fr/psg.png" },
      "POST /clans/create": { success: true, clanId: 42 },
    });
    cdnRepond();
    const i = fausseInteraction({ utilisateur: { id: AUTEUR } });
    await cmd.creer(...(membres as never as [never, never, never, never]), logo as never, i as never);
    expect(i.texte()).toContain("createClan1");

    const modale = fausseInteraction({ utilisateur: { id: AUTEUR }, customId: "createClan1", champs });
    await cmd.valider(modale as never);
    expect(appels.map(a => a.chemin)).toEqual(["/proxy/upload", "/clans/create"]);
    expect(appels[1]?.corps).toMatchObject({
      founders: membres.map(m => ({ id: m.id })),
      logo: "https://images.rosegriffon.fr/psg.png",
      name: "Paris Griffon",
      shortName: "PSG",
      normalizedShortName: "PSG",
      twitter: "https://x.com/psg",
    });
    expect(modale.texte()).toContain("en fondation");
  });

  test("refus de l'API (fondateur déjà en clan) : motif affiché", async () => {
    api({
      "POST /proxy/upload": { id: "img1", url: "https://images.rosegriffon.fr/psg.png" },
      "POST /clans/create": [400, { success: false, error: "Un des membres fondateurs fait déjà partie d'un Clan.", code: "FOUNDERS" }],
    });
    cdnRepond();
    const i = fausseInteraction({ utilisateur: { id: AUTEUR } });
    await cmd.creer(...(membres as never as [never, never, never, never]), logo as never, i as never);
    const modale = fausseInteraction({ utilisateur: { id: AUTEUR }, customId: "createClan1", champs });
    await cmd.valider(modale as never);
    expect(modale.texte()).toContain("déjà partie d'un Clan");
  });

  test("réseau social inconnu : aucun appel", async () => {
    const appels = api({});
    const i = fausseInteraction({ utilisateur: { id: AUTEUR } });
    await cmd.creer(...(membres as never as [never, never, never, never]), logo as never, i as never);
    const modale = fausseInteraction({
      utilisateur: { id: AUTEUR },
      customId: "createClan1",
      champs: { ...champs, socialMedia: "https://facebook.com/psg" },
    });
    await cmd.valider(modale as never);
    expect(appels).toHaveLength(0);
    expect(modale.texte()).toContain("réseau est invalide");
  });

  test("modale sans commande préalable : délai dépassé", async () => {
    const modale = fausseInteraction({ utilisateur: { id: "999999999999999998" }, customId: "createClan1", champs });
    await cmd.valider(modale as never);
    expect(modale.texte()).toContain("Délai");
  });
});
