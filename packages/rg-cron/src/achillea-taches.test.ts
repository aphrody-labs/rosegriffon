/**
 * Tâches Achilléa reprises de l'ancien bot : règles pures, et chaque tâche
 * exécutée contre une base et un Discord simulés (aucun réseau, aucune base).
 */
import { describe, expect, test } from "bun:test";

import { REGISTRE_TACHES } from "./registry";
import { CATALOGUE_TACHES, PLANIFICATIONS, resoudreTache } from "@rosegriffon/types/cron";
import {
  configAchilleaCron,
  corpsMessage,
  estMpFerme,
  publierOuEditer,
  type MethodeRest,
  type PorteDiscordAchillea,
  type ResultatRest,
} from "./lib/achillea-discord";
import type { MemoireAchillea } from "./lib/achillea-memoire";
import {
  chargeSync,
  ciblesSync,
  effetInverse,
  politiqueAccepte,
  runAchilleaSanctions,
  signatureSync,
  type DepotSanctions,
  type SanctionEchue,
} from "./tasks/achillea-sanctions";
import {
  apparierElimination,
  apparierMonrad,
  apparierTourSuivant,
  classementSuisse,
  demarrerParApi,
  doitTerminer,
  melanger,
  planifier,
  premiereRonde,
  rondesSuisses,
  runAchilleaTournoisPhases,
  transitionsPlanning,
  vainqueur,
  type DepotTournois,
  type LobbyPhase,
  type PhaseTournoi,
} from "./tasks/achillea-tournois-phases";
import {
  detecterPromotions,
  indicePalier,
  messageClassement,
  messageFile,
  runAchilleaClassementAnnonce,
  runAchilleaRankedPromotions,
  type DepotRanked,
  type Palier,
} from "./tasks/achillea-ranked";

// ─── Doublures ──────────────────────────────────────────────────────────────

interface AppelDiscord {
  methode: MethodeRest;
  chemin: string;
  corps?: unknown;
  raison?: string;
}

/** Discord simulé : `reponses` indexé par "METHODE chemin" (préfixe accepté), 200 `{ id: "m1" }` sinon. */
function faussePorte(reponses: Record<string, ResultatRest<unknown>> = {}): PorteDiscordAchillea & { appels: AppelDiscord[] } {
  const appels: AppelDiscord[] = [];
  return {
    appels,
    async rest<T>(methode: MethodeRest, chemin: string, corps?: unknown, raison?: string) {
      appels.push({ methode, chemin, corps, raison });
      const cle = `${methode} ${chemin}`;
      const trouve = reponses[cle] ?? Object.entries(reponses).find(([k]) => cle.startsWith(k))?.[1];
      return (trouve ?? { ok: true, data: { id: "m1" } }) as ResultatRest<T>;
    },
  };
}

function fausseMemoire(initial: Record<string, string> = {}): MemoireAchillea & { valeurs: Record<string, string> } {
  const valeurs = { ...initial };
  return {
    valeurs,
    async lire(cle) {
      return valeurs[cle] ?? null;
    },
    async ecrire(cle, valeur) {
      valeurs[cle] = valeur;
    },
  };
}

const CONFIG = configAchilleaCron({ ACHILLEA_STAFF_CHANNEL_ID: "900" });

// ─── Registre et catalogue ──────────────────────────────────────────────────

describe("registre et catalogue", () => {
  const nouvelles = [
    "achillea:sanctions",
    "achillea:clans",
    "achillea:casts",
    "achillea:tournois-phases",
    "achillea:classement-annonce",
    "achillea:ranked-file",
    "achillea:ranked-promotions",
  ];

  test("chaque tâche reprise est au registre ET au catalogue, avec une planification", () => {
    for (const nom of nouvelles) {
      expect(REGISTRE_TACHES[nom]).toBeDefined();
      expect(CATALOGUE_TACHES.some(t => t.nom === nom)).toBe(true);
      expect((PLANIFICATIONS as Record<string, string>)[nom]).toMatch(/^[\d*/,\s-]+$/u);
      expect(REGISTRE_TACHES[nom]?.horsServerless).toBeUndefined();
    }
  });

  test("les noms avec tiret se résolvent malgré la normalisation", () => {
    expect(resoudreTache("achillea:weekly-payout")).toBe("achillea:weekly-payout");
    expect(resoudreTache("achillea-ranked-file")).toBe("achillea:ranked-file");
  });
});

// ─── Discord ────────────────────────────────────────────────────────────────

describe("Discord Achilléa", () => {
  test("aucune mention implicite, seulement les utilisateurs nommés", () => {
    expect(corpsMessage({ content: "@everyone" })).toEqual({ content: "@everyone", allowed_mentions: { parse: [], users: [] } });
    expect(corpsMessage({ content: "x", mentionsUtilisateurs: ["1"] })).toMatchObject({ allowed_mentions: { users: ["1"] } });
  });

  test("configuration : valeurs de production, surcharge par l'environnement", () => {
    expect(configAchilleaCron({}).salonClassement).toBe("1398801522749477034");
    expect(configAchilleaCron({ ACHILLEA_LEADERBOARD_CHANNEL_ID: "1" }).salonClassement).toBe("1");
    expect(configAchilleaCron({}).salonStaff).toBe("");
    expect(configAchilleaCron({ ACHILLEA_WEBSITE_URL: "https://x.fr/a/" }).siteAchillea).toBe("https://x.fr/a");
  });

  test("MP fermés reconnus au code 50007", () => {
    expect(estMpFerme({ ok: false, statut: 403, motif: '{"code": 50007}' })).toBe(true);
    expect(estMpFerme({ ok: false, statut: 403, motif: "Missing Access" })).toBe(false);
  });

  test("publierOuEditer édite le message du bot, republie sinon", async () => {
    const edite = faussePorte({
      "GET /channels/5/messages/77": { ok: true, data: { id: "77", author: { id: "bot" } } },
      "GET /users/@me": { ok: true, data: { id: "bot" } },
    });
    expect(await publierOuEditer(edite, "5", "77", { content: "a" })).toEqual({ ok: true, data: { id: "77", action: "edite" } });
    expect(edite.appels.some(a => a.methode === "PATCH")).toBe(true);

    const autreAuteur = faussePorte({
      "GET /channels/5/messages/77": { ok: true, data: { id: "77", author: { id: "autre" } } },
      "GET /users/@me": { ok: true, data: { id: "bot" } },
      "POST /channels/5/messages": { ok: true, data: { id: "88" } },
    });
    expect(await publierOuEditer(autreAuteur, "5", "77", { content: "a" })).toEqual({ ok: true, data: { id: "88", action: "publie" } });
  });
});

// ─── achillea:sanctions ─────────────────────────────────────────────────────

const sanction = (surcharge: Partial<SanctionEchue> = {}): SanctionEchue => ({
  id: "s1",
  userId: "100",
  guildId: "200",
  type: "ban",
  reason: "spam",
  durationSec: 3600,
  expiresAt: new Date("2026-10-22T10:00:00Z"),
  issuedBy: "300",
  createdAt: new Date("2026-10-22T09:00:00Z"),
  evidence: null,
  ...surcharge,
});

describe("achillea:sanctions", () => {
  test("effet inverse : unban, fin d'exclusion, rien pour un avertissement", () => {
    expect(effetInverse(sanction())).toMatchObject({ methode: "DELETE", chemin: "/guilds/200/bans/100" });
    expect(effetInverse(sanction({ type: "mute" }))).toMatchObject({
      methode: "PATCH",
      chemin: "/guilds/200/members/100",
      corps: { communication_disabled_until: null },
    });
    expect(effetInverse(sanction({ type: "warn" }))).toBeNull();
  });

  test("révoque en base puis lève l'effet ; 404 n'est pas un échec ; une révocation concurrente est sautée", async () => {
    const revoquees: string[] = [];
    const depot: DepotSanctions = {
      echues: async () => [sanction(), sanction({ id: "s2", type: "mute" }), sanction({ id: "s3", type: "warn" }), sanction({ id: "s4" })],
      revoquer: async id => {
        if (id === "s4") return false;
        revoquees.push(id);
        return true;
      },
    };
    const discord = faussePorte({ "PATCH /guilds/200/members/100": { ok: false, statut: 404, motif: "Unknown Member" } });
    const r = await runAchilleaSanctions(depot, discord, [], new Date());
    expect(revoquees).toEqual(["s1", "s2", "s3"]);
    expect(r).toMatchObject({ echues: 4, revoquees: 3, effetsLeves: 2, avertissements: [] });
    expect(discord.appels.map(a => `${a.methode} ${a.chemin}`)).toEqual(["DELETE /guilds/200/bans/100", "PATCH /guilds/200/members/100"]);
  });

  test("un refus Discord est consigné sans arrêter la tâche", async () => {
    const depot: DepotSanctions = { echues: async () => [sanction()], revoquer: async () => true };
    const r = await runAchilleaSanctions(depot, faussePorte({ "DELETE /guilds": { ok: false, statut: 403, motif: "Missing Permissions" } }), []);
    expect(r.revoquees).toBe(1);
    expect(r.avertissements[0]).toContain("403");
  });

  test("propagation inter-serveurs : cibles lues, politique, charge et signature", async () => {
    expect(ciblesSync({ ACHILLEA_CROSS_SYNC_TARGETS: "pas du json" })).toEqual([]);
    expect(ciblesSync({ ACHILLEA_CROSS_SYNC_TARGETS: '[{"url":"https://a","secret":"s","policy":"ban-only"},{"url":1}]' })).toHaveLength(1);
    expect(politiqueAccepte("ban-only", "mute")).toBe(false);
    expect(politiqueAccepte("ban-only", "ban")).toBe(true);
    expect(chargeSync(sanction(), "all")).toMatchObject({ version: "1.0", action: "revoke", sanction: { id: "s1", type: "ban" } });
    const attendu = new Bun.CryptoHasher("sha256", "secret").update("123.corps").digest("hex");
    expect(await signatureSync("123", "corps", "secret")).toBe(attendu);
  });
});

// ─── achillea:tournois-phases ───────────────────────────────────────────────

const lobby = (id: number, ronde: number | null, a: [string, number], b?: [string, number], state = "Finished"): LobbyPhase => ({
  id,
  state,
  ronde,
  joueurs: [
    { userId: a[0], team: 1, score: a[1], forfeit: false },
    ...(b ? [{ userId: b[0], team: 2, score: b[1], forfeit: false }] : []),
  ],
});

const phase = (surcharge: Partial<PhaseTournoi>): PhaseTournoi => ({
  id: "p1",
  index: 0,
  kind: "Swiss",
  status: "Active",
  config: null,
  qualifiersCount: 0,
  ...surcharge,
});

describe("règles de phases", () => {
  test("classement suisse : points, Buchholz, exemption", () => {
    const c = classementSuisse(
      [
        { joueurA: "a", joueurB: "b", scoreA: 1, scoreB: 0, ronde: 1, exempt: false },
        { joueurA: "c", joueurB: null, scoreA: 0, scoreB: 0, ronde: 1, exempt: true },
      ],
      ["a", "b", "c"],
    );
    expect(c.map(x => x.userId)).toEqual(["a", "c", "b"]);
    expect(c.find(x => x.userId === "a")?.buchholz).toBe(0);
    expect(c.find(x => x.userId === "c")?.exemptions).toBe(1);
  });

  test("Monrad évite les revanches et donne l'exemption au dernier non exempté", () => {
    const joues = [
      { joueurA: "a", joueurB: "b", scoreA: 1, scoreB: 0, ronde: 1, exempt: false },
      { joueurA: "e", joueurB: null, scoreA: 0, scoreB: 0, ronde: 1, exempt: true },
    ];
    const classement = ["a", "b", "c", "d", "e"].map((userId, i) => ({ userId, points: 5 - i, buchholz: 0 }));
    const paires = apparierMonrad(classement, joues);
    expect(paires[0]).toEqual({ joueurA: "d", joueurB: null });
    expect(paires).toContainEqual({ joueurA: "a", joueurB: "c" });
    expect(paires).toContainEqual({ joueurA: "b", joueurB: "e" });
  });

  test("élimination : têtes de série haute/basse, tour suivant deux à deux", () => {
    expect(apparierElimination(["1", "2", "3", "4"])).toEqual([
      { joueurA: "1", joueurB: "4" },
      { joueurA: "2", joueurB: "3" },
    ]);
    expect(apparierElimination(["1", "2", "3"])[0]).toEqual({ joueurA: "1", joueurB: null });
    expect(apparierTourSuivant(["a", "b", "c"])).toEqual([
      { joueurA: "a", joueurB: "b" },
      { joueurA: "c", joueurB: null },
    ]);
  });

  test("vainqueur : score, forfait, exemption, égalité indécidable", () => {
    expect(vainqueur(lobby(1, 1, ["a", 2], ["b", 1]))).toBe("a");
    expect(vainqueur(lobby(1, 1, ["a", 1], ["b", 1]))).toBeNull();
    expect(vainqueur(lobby(1, 1, ["a", 0]))).toBe("a");
    expect(vainqueur({ ...lobby(1, 1, ["a", 3], ["b", 0]), joueurs: [
      { userId: "a", team: 1, score: 3, forfeit: true },
      { userId: "b", team: 2, score: 0, forfeit: false },
    ] })).toBe("b");
  });

  test("nombre de rondes suisses et fin de tournoi", () => {
    expect(rondesSuisses({ config: { rounds: 5 } }, 8)).toBe(5);
    expect(rondesSuisses({ config: null }, 8)).toBe(3);
    expect(rondesSuisses({ config: null }, 1)).toBe(1);
    expect(doitTerminer([{ id: "a", status: "Completed" }, { id: "b", status: "Active" }], "b")).toBe(true);
    expect(doitTerminer([{ id: "a", status: "Pending" }, { id: "b", status: "Active" }], "b")).toBe(false);
  });

  test("Fisher-Yates : une permutation, déterministe avec un tirage fixé", () => {
    expect(melanger([1, 2, 3, 4], () => 0)).toEqual([2, 3, 4, 1]);
    expect(melanger([1, 2, 3, 4]).toSorted()).toEqual([1, 2, 3, 4]);
  });

  test("planifier : attendre, ronde suisse, tour d'élimination, phase suivante, fin", () => {
    expect(planifier([phase({})], [lobby(1, 1, ["a", 1], ["b", 0], "Ongoing")])).toEqual({ type: "attendre", motif: "lobbys en cours" });

    const suisse = planifier([phase({ config: { rounds: 2 } })], [lobby(1, 1, ["a", 1], ["b", 0]), lobby(2, 1, ["c", 1], ["d", 0])]);
    expect(suisse).toMatchObject({ type: "ronde", ronde: 2, format: "bo1" });

    const tour = planifier([phase({ kind: "SingleElim" })], [lobby(1, null, ["a", 2], ["d", 0]), lobby(2, null, ["b", 2], ["c", 1])]);
    expect(tour).toEqual({ type: "ronde", phaseId: "p1", ronde: 2, format: "bo3", paires: [{ joueurA: "a", joueurB: "b" }] });

    const suivante = planifier(
      [phase({ config: { rounds: 1 }, qualifiersCount: 2 }), phase({ id: "p2", index: 1, kind: "Top8Bracket", status: "Pending" })],
      [lobby(1, 1, ["a", 1], ["b", 0]), lobby(2, 1, ["c", 1], ["d", 0])],
    );
    expect(suivante).toMatchObject({ type: "avancer", phaseId: "p1", suivante: { id: "p2", format: "bo3", ronde: 1 } });
    if (suivante.type === "avancer") expect(suivante.suivante?.paires).toHaveLength(1);

    const fin = planifier(
      [phase({ id: "p0", index: 0, status: "Completed" }), phase({ id: "p1", index: 1, kind: "SingleElim" })],
      [lobby(1, 3, ["a", 2], ["b", 0])],
    );
    expect(fin).toEqual({ type: "avancer", phaseId: "p1", suivante: null, terminerTournoi: true });
  });
});

describe("achillea:tournois-phases", () => {
  test("planning en panne : l'avancement tourne quand même ; démarrage apparié ; phase avancée", async () => {
    const creees: unknown[] = [];
    const completees: string[] = [];
    const etatPhases = new Map<number, PhaseTournoi[]>([
      [1, [phase({ id: "x1", status: "Pending", config: { seeded: true } })]],
      [2, [phase({ id: "y1", config: { rounds: 1 } }), phase({ id: "y2", index: 1, status: "Pending", kind: "SingleElim" })]],
    ]);
    const depot: DepotTournois = {
      demarrer: async id => (id === 1 ? ["a", "b", "c", "d"] : null),
      demarrerSansPhase: async () => ({ ok: false, erreur: "Impossible de démarrer le tournoi : aucun arbre" }),
      joueursActifs: async () => [],
      tournoisEnCours: async () => [2],
      phases: async id => etatPhases.get(id) ?? [],
      lobbys: async () => [lobby(1, 1, ["a", 1], ["b", 0]), lobby(2, 1, ["c", 1], ["d", 0])],
      creerRonde: async input => (creees.push(input), true),
      completerPhase: async (_t, phaseId) => (completees.push(phaseId), true),
      terminerTournoi: async () => true,
    };
    const r = await runAchilleaTournoisPhases(depot, async () => {
      throw new Error("API_ADMIN_TOKEN absent");
    });
    expect(r.erreurPlanning).toContain("API_ADMIN_TOKEN");
    expect(r.demarres).toEqual([]);
    expect(completees).toEqual(["y1"]);
    expect(creees).toEqual([
      expect.objectContaining({ tournoiId: 2, phaseId: "y2", ronde: 1, format: "bo3", activerPhase: true }),
    ]);

    creees.length = 0;
    const r2 = await runAchilleaTournoisPhases(
      { ...depot, tournoisEnCours: async () => [] },
      async () => ({ transitions: [{ tournamentId: 1, from: "Pending", to: "Preregistering" }], aDemarrer: [1, 3] }),
    );
    expect(r2.demarres).toEqual([1]);
    // Le tournoi 3 n'a pas de phase : démarrage demandé à l'API, refus remonté tel quel.
    expect(r2.enAttente).toEqual([{ tournoi: 3, motif: "Impossible de démarrer le tournoi : aucun arbre" }]);
    expect(r2.transitions).toHaveLength(1);
    expect(creees).toEqual([
      expect.objectContaining({
        tournoiId: 1,
        phaseId: "x1",
        ronde: 1,
        format: "bo1",
        activerPhase: true,
        paires: [
          { joueurA: "a", joueurB: "b" },
          { joueurA: "c", joueurB: "d" },
        ],
      }),
    ]);
  });

  test("transitionsPlanning : jeton exigé, base interne, refus propagé", async () => {
    await expect(transitionsPlanning(new Date(), {})).rejects.toThrow(/API_ADMIN_TOKEN/);
    let vue = "";
    const ok = await transitionsPlanning(new Date("2026-10-22T00:00:00Z"), { API_ADMIN_TOKEN: "t", RG_CORE_PORT: "9001" }, (async (
      url: string | URL | Request,
      init?: RequestInit,
    ) => {
      vue = `${String(url)} ${new Headers(init?.headers).get("authorization")}`;
      return Response.json({ transitions: [], startCandidates: [4] });
    }) as typeof fetch);
    expect(vue).toBe("http://127.0.0.1:9001/api/tournaments/internal/schedule-transitions Bearer t");
    expect(ok.aDemarrer).toEqual([4]);
    await expect(
      transitionsPlanning(new Date(), { API_ADMIN_TOKEN: "t" }, (async () =>
        Response.json({ message: "Internal authentication required" }, { status: 401 })) as unknown as typeof fetch),
    ).rejects.toThrow(/Internal authentication/);
  });

  const depotVide = (surcharge: Partial<DepotTournois>): DepotTournois => ({
    demarrer: async () => null,
    demarrerSansPhase: async () => ({ ok: true, lobbies: 0 }),
    joueursActifs: async () => [],
    tournoisEnCours: async () => [],
    phases: async () => [],
    lobbys: async () => [],
    creerRonde: async () => true,
    completerPhase: async () => true,
    terminerTournoi: async () => true,
    ...surcharge,
  });

  test("démarrage automatique sans phase : délégué à l'API, sans passer par le dépôt SQL", async () => {
    const demandes: number[] = [];
    let sqlDirect = false;
    const r = await runAchilleaTournoisPhases(
      depotVide({
        demarrer: async () => ((sqlDirect = true), ["a", "b"]),
        demarrerSansPhase: async id => (demandes.push(id), { ok: true, lobbies: 4 }),
      }),
      async () => ({ transitions: [], aDemarrer: [5] }),
    );
    expect(demandes).toEqual([5]);
    expect(sqlDirect).toBe(false);
    expect(r.demarres).toEqual([5]);
    expect(r.rondesCreees).toEqual([]);
  });

  test("démarré à la main : la première phase encore en attente reçoit sa ronde 1", async () => {
    const creees: unknown[] = [];
    const r = await runAchilleaTournoisPhases(
      depotVide({
        tournoisEnCours: async () => [7],
        joueursActifs: async () => ["a", "b", "c"],
        phases: async () => [
          phase({ id: "z2", index: 1, status: "Pending", kind: "SingleElim" }),
          phase({ id: "z1", index: 0, status: "Pending", config: { seeded: true } }),
        ],
        creerRonde: async input => (creees.push(input), true),
      }),
      async () => ({ transitions: [], aDemarrer: [] }),
    );
    expect(creees).toEqual([
      expect.objectContaining({
        tournoiId: 7,
        phaseId: "z1",
        ronde: 1,
        format: "bo1",
        activerPhase: true,
        paires: [
          { joueurA: "c", joueurB: null },
          { joueurA: "a", joueurB: "b" },
        ],
      }),
    ]);
    expect(r.rondesCreees).toEqual([{ tournoi: 7, phase: "z1", ronde: 1 }]);

    // Une phase déjà close : le tournoi n'est pas « fraîchement démarré », rien n'est rejoué.
    creees.length = 0;
    await runAchilleaTournoisPhases(
      depotVide({
        tournoisEnCours: async () => [7],
        joueursActifs: async () => ["a", "b"],
        phases: async () => [phase({ id: "z1", status: "Completed" }), phase({ id: "z2", index: 1, status: "Pending" })],
        creerRonde: async input => (creees.push(input), true),
      }),
      async () => ({ transitions: [], aDemarrer: [] }),
    );
    expect(creees).toEqual([]);
  });

  test("première ronde : élimination en BO3 bornée aux qualifiés, suisse en BO1", () => {
    expect(premiereRonde(phase({ kind: "SingleElim", config: { seeded: true }, qualifiersCount: 4 }), ["a", "b", "c", "d", "e"])).toEqual({
      format: "bo3",
      paires: [
        { joueurA: "a", joueurB: "d" },
        { joueurA: "b", joueurB: "c" },
      ],
    });
    expect(premiereRonde(phase({ config: { seeded: true } }), ["a", "b"]).format).toBe("bo1");
  });

  test("demarrerParApi : route interne, jeton exigé, refus de l'API remonté", async () => {
    expect(await demarrerParApi(9, {})).toEqual({ ok: false, erreur: expect.stringContaining("API_ADMIN_TOKEN") });
    let vue = "";
    const ok = await demarrerParApi(9, { API_ADMIN_TOKEN: "t", RG_CORE_PORT: "9001" }, (async (url: string | URL | Request, init?: RequestInit) => {
      vue = `${init?.method} ${String(url)} ${new Headers(init?.headers).get("authorization")}`;
      return Response.json({ success: true, internalState: "Ongoing", phases: 0, lobbies: 4 });
    }) as typeof fetch);
    expect(vue).toBe("POST http://127.0.0.1:9001/api/tournaments/internal/9/start Bearer t");
    expect(ok).toEqual({ ok: true, lobbies: 4 });
    const refus = await demarrerParApi(9, { API_ADMIN_TOKEN: "t" }, (async () =>
      Response.json({ message: "Impossible de démarrer le tournoi : aucun arbre" }, { status: 400 })) as unknown as typeof fetch);
    expect(refus).toEqual({ ok: false, erreur: "Impossible de démarrer le tournoi : aucun arbre" });
  });
});

// ─── Intégrations ranked ────────────────────────────────────────────────────

const PALIERS: Palier[] = [
  { key: "Or", minElo: 1400, maxElo: 1599, emojiId: "3", emojiKey: "or" },
  { key: "Bronze", minElo: 0, maxElo: 1199, emojiId: "", emojiKey: "" },
  { key: "Argent", minElo: 1200, maxElo: 1399, emojiId: "2", emojiKey: "" },
];

describe("intégrations ranked", () => {
  test("paliers triés par Elo, émoji optionnel", () => {
    const tries = [...PALIERS].sort((a, b) => a.minElo - b.minElo);
    expect(indicePalier(tries, 1250)).toBe(1);
    expect(indicePalier(tries, 99_999)).toBe(0);
    const texte = JSON.stringify(
      messageClassement("S1", [{ userId: "1", nom: "Akira", elo: 1450, parties: 1, rang: 1 }], [], PALIERS, new Date(0)),
    );
    expect(texte).toContain("🥇 <:or:3> **Akira** — 1450 pts · 1 partie");
    expect(texte).toContain("_Aucun joueur classé._");
  });

  test("panneau de file : gras au vainqueur, bouton lien vers le site", () => {
    const m = messageFile(12, [{ p1: "A", s1: 1, p2: "B", s2: 3 }], "https://rosegriffon.fr/achillea/ranked");
    expect(JSON.stringify(m)).toContain("A 1–3 **B**");
    expect(m.components?.[0]).toMatchObject({ components: [{ style: 5, url: "https://rosegriffon.fr/achillea/ranked" }] });
  });

  test("promotions : premier passage muet, montée détectée, descente ignorée", () => {
    expect(detecterPromotions(null, [{ userId: "1", elo: 1500 }], PALIERS)).toMatchObject({ premierPassage: true, promotions: [] });
    const r = detecterPromotions({ "1": 0, "2": 2 }, [{ userId: "1", elo: 1300 }, { userId: "2", elo: 100 }, { userId: "3", elo: 1500 }], PALIERS);
    expect(r.promotions).toEqual([{ userId: "1", indice: 1 }]);
    expect(r.releve).toEqual({ "1": 1, "2": 0, "3": 2 });
  });

  const depot = (surcharge: Partial<DepotRanked> = {}): DepotRanked => ({
    saisonActive: async () => ({ id: "s", name: "Saison 2" }),
    top: async () => [],
    paliers: async () => PALIERS,
    joueursClasses: async () => 0,
    resultatsRecents: async () => [],
    elos1v1: async () => [],
    noms: async ids => new Map(ids.map(id => [id, `J${id}`])),
    ...surcharge,
  });

  test("classement : publie puis mémorise l'identifiant ; désactivé sans salon", async () => {
    const memoire = fausseMemoire();
    const discord = faussePorte({ "POST /channels": { ok: true, data: { id: "msg9" } } });
    const r = await runAchilleaClassementAnnonce(depot(), discord, memoire, CONFIG);
    expect(r).toMatchObject({ success: true, action: "publie", messageId: "msg9" });
    expect(memoire.valeurs.leaderboardMessageId).toBe('"msg9"');
    expect(await runAchilleaClassementAnnonce(depot(), discord, memoire, { ...CONFIG, salonClassement: "" })).toEqual({
      success: true,
      ignore: true,
    });
  });

  test("promotions : annonce et félicitations avec mentions, plafond anti-spam", async () => {
    const memoire = fausseMemoire({ rankedTierSnapshot: JSON.stringify({ "1": 0 }) });
    const discord = faussePorte();
    const r = await runAchilleaRankedPromotions(depot({ elos1v1: async () => [{ userId: "1", elo: 1450 }] }), discord, memoire, CONFIG);
    expect(r).toMatchObject({ issue: "annoncees", promotions: 1 });
    const corps = discord.appels.map(a => JSON.stringify(a.corps));
    expect(corps.some(c => c.includes("**J1** accède au palier **Or**"))).toBe(true);
    expect(corps.some(c => c.includes('"users":["1"]'))).toBe(true);
    expect(JSON.parse(memoire.valeurs.rankedTierSnapshot!)).toEqual({ "1": 2 });

    const nombreux = Array.from({ length: 11 }, (_, i) => ({ userId: String(i), elo: 1500 }));
    const memoire2 = fausseMemoire({ rankedTierSnapshot: JSON.stringify(Object.fromEntries(nombreux.map(j => [j.userId, 0]))) });
    const discord2 = faussePorte();
    expect((await runAchilleaRankedPromotions(depot({ elos1v1: async () => nombreux }), discord2, memoire2, CONFIG)).issue).toBe("anomalie");
    expect(discord2.appels).toEqual([]);
  });
});
