/**
 * `/achillea-admin` : chaque sous-commande, chemin nominal et refus 403 de l'API.
 */
import { afterEach, describe, expect, test } from "bun:test";

import { fausseInteraction, installerApi, type Gestionnaire } from "../../../test/achillea-kit";
import {
  ACTIONS_EN_ATTENTE,
  AdminGuildes,
  AdminLicence,
  AdminLitige,
  AdminNote,
  AdminOrganisation,
  AdminSaison,
  AdminSanction,
  AdminSysteme,
  AdminUtilisateur,
  RacineAchilleaAdmin,
  remplacerLanceurReleve,
} from "./admin";
import { dateIso, listeBornee } from "./admin-format";

const JOUEUR = { id: "333333333333333333", username: "cible" };
const SERVEUR = "1055585286320554055";
const NOW = new Date().toISOString();

const SAISON = {
  id: "s1",
  name: "Saison 3",
  state: "Active",
  starts_at: NOW,
  ends_at: NOW,
  config: { kFactor: 32, baseRating: 1000, decayRate: 0 },
  player_count: 12,
};
const LICENCE = {
  id: "l1",
  userId: JOUEUR.id,
  licenseNumber: "ACH-0001",
  issuedAt: NOW,
  validUntil: NOW,
  status: "Active",
  pdfUrl: null,
  createdAt: NOW,
  updatedAt: NOW,
};
const SANCTION = {
  id: "san1",
  userId: JOUEUR.id,
  guildId: SERVEUR,
  type: "warn",
  reason: "spam",
  durationSec: null,
  issuedBy: "1",
  issuedByType: "user",
  expiresAt: null,
  revokedAt: null,
  revokedBy: null,
  revokeReason: null,
  evidence: null,
  createdAt: NOW,
};
const PERSONNE = { id: JOUEUR.id, username: "cible", displayName: "Cible", avatar: "" };
const NOTE = {
  id: "n1",
  target: PERSONNE,
  author: null,
  tournament: null,
  category: "behavior",
  severity: "warning",
  content: "Insultes en vocal",
  resolved: false,
  resolvedAt: null,
  resolvedBy: null,
  createdAt: NOW,
  updatedAt: NOW,
  docsUrl: null,
};

let restaurations: Array<() => void> = [];
afterEach(() => {
  for (const r of restaurations) r();
  restaurations = [];
  ACTIONS_EN_ATTENTE.clear();
});

function api(routes: Record<string, Gestionnaire | unknown>) {
  const installation = installerApi(routes);
  restaurations.push(installation.restaurer);
  return installation.appels;
}

interface Cas {
  nom: string;
  route: string;
  reponse: unknown;
  lancer: (i: never) => Promise<void>;
  attendu: string;
  /** Action confirmée par bouton : le test clique « Confirmer ». */
  confirmation?: boolean;
}

const CAS: Cas[] = [
  {
    nom: "guildes liste",
    route: "GET /admin/ops/guilds",
    reponse: { data: [{ id: SERVEUR, name: "Achilléa", iconURL: null, memberCount: 900, ownerId: "1", createdAt: null }] },
    lancer: i => new AdminGuildes().liste(i),
    attendu: "Achilléa",
  },
  {
    nom: "guildes invitation",
    route: `GET /admin/ops/guilds/${SERVEUR}/invite`,
    reponse: { url: "https://discord.gg/abc" },
    lancer: i => new AdminGuildes().invitation(SERVEUR, i),
    attendu: "discord.gg/abc",
  },
  {
    nom: "systeme sante",
    route: "GET /admin/ops/health",
    reponse: { bot: { online: true, uptime: 600, username: "Achilléa", guilds: 3, maintenance: false }, host: {}, pid: 1, latency: {} },
    lancer: i => new AdminSysteme().sante(i),
    attendu: "en ligne",
  },
  {
    nom: "systeme maintenance",
    route: "POST /admin/ops/maintenance",
    reponse: { maintenance: true },
    lancer: i => new AdminSysteme().maintenance(true, i),
    attendu: "Maintenance activée",
  },
  {
    nom: "systeme journal",
    route: "GET /admin/ops/logs",
    reponse: { data: ["[achillea] prêt"] },
    lancer: i => new AdminSysteme().journal(i),
    attendu: "prêt",
  },
  {
    nom: "systeme audit",
    route: "GET /admin/ops/audit",
    reponse: { data: [{ id: "a", ts: NOW, actorId: "1", action: "maintenance.set", targetType: "bot", targetId: null, reason: null }] },
    lancer: i => new AdminSysteme().audit(i),
    attendu: "maintenance.set",
  },
  {
    nom: "utilisateur role",
    route: `POST /admin/ops/users/${JOUEUR.id}/role`,
    reponse: { success: true, id: JOUEUR.id, role: 1 },
    lancer: i => new AdminUtilisateur().role(JOUEUR as never, 1, i),
    attendu: "Modérateur",
  },
  {
    nom: "utilisateur portefeuille",
    route: `POST /admin/ops/wallets/${JOUEUR.id}/adjust`,
    reponse: { success: true, userId: JOUEUR.id, balance: 150 },
    lancer: i => new AdminUtilisateur().portefeuille(JOUEUR as never, 50, "lot", i),
    attendu: "150",
  },
  {
    nom: "saison liste",
    route: "GET /admin/seasons",
    reponse: [SAISON],
    lancer: i => new AdminSaison().liste(i),
    attendu: "Saison 3",
  },
  {
    nom: "saison creer",
    route: "POST /admin/seasons",
    reponse: { ...SAISON, state: "Upcoming" },
    lancer: i => new AdminSaison().creer("Saison 3", "2026-11-01", "2027-01-31", undefined, undefined, undefined, i),
    attendu: "Saison créée",
  },
  {
    nom: "saison activer",
    route: "POST /admin/seasons/s1/activate",
    reponse: SAISON,
    lancer: i => new AdminSaison().activer("s1", i),
    attendu: "Saison activée",
  },
  {
    nom: "saison reinitialiser",
    route: "POST /admin/seasons/s1/reset",
    reponse: { ok: true, affected: 12 },
    lancer: i => new AdminSaison().reinitialiser("s1", i),
    attendu: "12 joueur(s)",
    confirmation: true,
  },
  {
    nom: "litige liste",
    route: "GET /admin/lobbies/disputes",
    reponse: [
      {
        lobbyId: 42,
        mode: 2,
        player1: { userId: "1", displayName: "A", submittedScore: 3 },
        player2: { userId: "2", displayName: "B", submittedScore: 3 },
        createdAt: NOW,
      },
    ],
    lancer: i => new AdminLitige().liste(i),
    attendu: "Lobby `42`",
  },
  {
    nom: "litige valider",
    route: "POST /admin/lobbies/42/validate",
    reponse: { ok: true, eloDelta: 12 },
    lancer: i => new AdminLitige().valider(42, 3, 1, undefined, i),
    attendu: "Litige tranché",
  },
  {
    nom: "litige annuler",
    route: "POST /admin/lobbies/42/cancel",
    reponse: { ok: true },
    lancer: i => new AdminLitige().annuler(42, i),
    attendu: "annulé",
    confirmation: true,
  },
  {
    nom: "licence emettre",
    route: `POST /licenses/issue/${JOUEUR.id}`,
    reponse: LICENCE,
    lancer: i => new AdminLicence().emettre(JOUEUR as never, i),
    attendu: "ACH-0001",
  },
  {
    nom: "licence revoquer",
    route: "POST /licenses/l1/revoke",
    reponse: { ...LICENCE, status: "Revoked" },
    lancer: i => new AdminLicence().revoquer("l1", i),
    attendu: "ACH-0001 révoquée",
    confirmation: true,
  },
  {
    nom: "organisation attente",
    route: "GET /organizations",
    reponse: { data: [{ id: 5, name: "Inazuma Cup", normalizedName: "inazuma-cup", logo: "", description: "", owner: "1" }], count: 1 },
    lancer: i => new AdminOrganisation().attente(i),
    attendu: "Inazuma Cup",
  },
  {
    nom: "organisation approuver",
    route: "POST /organizations/5/approve",
    reponse: { success: true },
    lancer: i => new AdminOrganisation().approuver(5, i),
    attendu: "approuvée",
  },
  {
    nom: "organisation rejeter",
    route: "POST /organizations/5/reject",
    reponse: { success: true },
    lancer: i => new AdminOrganisation().rejeter(5, i),
    attendu: "rejetée",
  },
  {
    nom: "sanction liste",
    route: "GET /sanctions",
    reponse: { data: [SANCTION], total: 1, meta: { page: 1, pageSize: 20, pageCount: 1 } },
    lancer: i => new AdminSanction().liste(JOUEUR as never, true, i),
    attendu: "san1",
  },
  {
    nom: "sanction revoquer",
    route: "POST /sanctions/san1/revoke",
    reponse: { ...SANCTION, revokedAt: NOW },
    lancer: i => new AdminSanction().revoquer("san1", "erreur", i),
    attendu: "révoquée",
    confirmation: true,
  },
  {
    nom: "note liste",
    route: "GET /player-notes",
    reponse: { data: [NOTE], total: 1, meta: { page: 1, pageSize: 15, pageCount: 1, isStaff: true } },
    lancer: i => new AdminNote().liste(undefined, true, i),
    attendu: "Insultes en vocal",
  },
  {
    nom: "note resume",
    route: `GET /player-notes/summary/${JOUEUR.id}`,
    reponse: { total: 3, open: 1, bySeverity: { info: 1, warning: 1, serious: 1 } },
    lancer: i => new AdminNote().resume(JOUEUR as never, i),
    attendu: "**3** note(s)",
  },
  {
    nom: "note resoudre",
    route: "POST /player-notes/n1/resolve",
    reponse: { ...NOTE, resolved: true },
    lancer: i => new AdminNote().resoudre("n1", i),
    attendu: "Note traitée",
  },
  {
    nom: "note rouvrir",
    route: "POST /player-notes/n1/reopen",
    reponse: NOTE,
    lancer: i => new AdminNote().rouvrir("n1", i),
    attendu: "Note rouverte",
  },
  {
    nom: "note supprimer",
    route: "DELETE /player-notes/n1",
    reponse: { success: true },
    lancer: i => new AdminNote().supprimer("n1", i),
    attendu: "supprimée",
    confirmation: true,
  },
];

/** Clique « Confirmer » sur la demande en attente et rend l'interaction du bouton. */
async function confirmer(choix: "ok" | "non" = "ok", auteur = "111111111111111111") {
  const jeton = [...ACTIONS_EN_ATTENTE.keys()][0];
  const bouton = fausseInteraction({ customId: `achillea-admin:${choix}:${jeton}`, utilisateur: { id: auteur } });
  await new RacineAchilleaAdmin().confirmation(bouton as never);
  return bouton;
}

describe("/achillea-admin — chemin nominal", () => {
  for (const cas of CAS) {
    test(cas.nom, async () => {
      const appels = api({ [cas.route]: cas.reponse });
      const interaction = fausseInteraction();
      await cas.lancer(interaction as never);
      expect(interaction.envois[0]?.via).toBe("deferReply");
      if (cas.confirmation) {
        // Rien n'est parti avant le clic.
        expect(appels).toHaveLength(0);
        expect(interaction.texte()).toContain("achillea-admin:ok:");
        const bouton = await confirmer();
        expect(appels).toHaveLength(1);
        expect(bouton.texte()).toContain(cas.attendu);
      } else {
        expect(appels.map(a => `${a.methode} ${a.chemin}`)).toEqual([cas.route]);
        expect(interaction.texte()).toContain(cas.attendu);
      }
      expect(appels[0]?.porteur).toStartWith("Bearer ");
    });
  }
});

describe("/achillea-admin — refus de l'API", () => {
  for (const cas of CAS) {
    test(`${cas.nom} : 403`, async () => {
      api({ [cas.route]: [403, { message: "Staff role required" }] });
      const interaction = fausseInteraction();
      await cas.lancer(interaction as never);
      const sortie = cas.confirmation ? (await confirmer()).texte() : interaction.texte();
      expect(sortie).toContain("Staff role required");
    });
  }
});

describe("confirmations", () => {
  test("annuler ne déclenche rien ; un autre membre ne peut pas confirmer ; jeton inconnu : expirée", async () => {
    const appels = api({ "POST /admin/seasons/s1/reset": { ok: true, affected: 1 } });
    await new AdminSaison().reinitialiser("s1", fausseInteraction() as never);
    const intrus = await confirmer("ok", "444444444444444444");
    expect(intrus.texte()).toContain("Pas ta demande");
    const annule = await confirmer("non");
    expect(annule.texte()).toContain("Action annulée");
    expect(appels).toHaveLength(0);
    const perime = fausseInteraction({ customId: "achillea-admin:ok:0123456789abcdef" });
    await new RacineAchilleaAdmin().confirmation(perime as never);
    expect(perime.texte()).toContain("expirée");
  });
});

describe("relevé des guildes", () => {
  test("garde staff puis tâche achillea:guildes", async () => {
    const appels = api({ "GET /admin/ops/guilds": { data: [] } });
    let lancee = 0;
    restaurations.push(
      remplacerLanceurReleve(async () => {
        lancee += 1;
        return { success: true };
      }),
    );
    const i = fausseInteraction();
    await new AdminGuildes().releve(i as never);
    expect(appels).toHaveLength(1);
    expect(lancee).toBe(1);
    expect(i.texte()).toContain("Relevé terminé");
  });

  test("refus 403 : la tâche n'est pas lancée", async () => {
    api({ "GET /admin/ops/guilds": [403, { message: "Staff role required" }] });
    let lancee = 0;
    restaurations.push(
      remplacerLanceurReleve(async () => {
        lancee += 1;
        return { success: true };
      }),
    );
    const i = fausseInteraction();
    await new AdminGuildes().releve(i as never);
    expect(lancee).toBe(0);
    expect(i.texte()).toContain("Staff role required");
  });

  test("échec de la tâche : rapporté", async () => {
    api({ "GET /admin/ops/guilds": { data: [] } });
    restaurations.push(remplacerLanceurReleve(async () => ({ success: false, error: "bail déjà pris" })));
    const i = fausseInteraction();
    await new AdminGuildes().releve(i as never);
    expect(i.texte()).toContain("bail déjà pris");
  });
});

describe("validations locales", () => {
  test("dates de saison, montant nul", async () => {
    expect(dateIso("2026-11-01")).toBe("2026-11-01T00:00:00.000Z");
    expect(dateIso("01/11/2026")).toBeNull();
    const appels = api({});
    const i = fausseInteraction();
    await new AdminSaison().creer("S", "2027-01-01", "2026-01-01", undefined, undefined, undefined, i as never);
    expect(i.texte()).toContain("Dates invalides");
    const j = fausseInteraction();
    await new AdminUtilisateur().portefeuille(JOUEUR as never, 0, "rien", j as never);
    expect(j.texte()).toContain("Montant invalide");
    expect(appels).toHaveLength(0);
  });

  test("listeBornee tronque et compte le reste", () => {
    const lignes = Array.from({ length: 200 }, (_, n) => `ligne ${n} ${"x".repeat(40)}`);
    const texte = listeBornee(lignes, "vide", 1_000);
    expect(texte.length).toBeLessThan(1_100);
    expect(texte).toContain("de plus");
    expect(listeBornee([], "vide")).toBe("vide");
  });
});
