import "./setup";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { signAchilleaSessionToken } from "@rosegriffon/auth/achillea-session";
import { app } from "../src/api/server";
import { creerAdminDbController } from "../src/api/modules/achillea/admin-db";
import {
  clePrimaire,
  citerIdent,
  consoleSqlOuverte,
  envelopperAvecLimite,
  masquerLigne,
  tableEditable,
  validerRequeteLecture,
  valeursEcrivables,
  verifierPlan,
  VALEUR_MASQUEE,
} from "../src/api/modules/achillea/admin-db/securite";
import { creerHealthController } from "../src/api/modules/achillea/health";
import { classerGuildes, creerStatsController, cumulerParJour, derniersJours, trancherActivite } from "../src/api/modules/achillea/stats";
import { creerDatabaseController } from "../src/api/modules/achillea/database";
import { creerVerificationAuditController } from "../src/api/modules/achillea/audit-verify";
import {
  appliquerRotation,
  connexionPg,
  listerSauvegardes,
  nomSauvegarde,
  OperationEnCours,
  OutilAbsent,
  restaurer,
  sauvegarder,
  SauvegardeInconnue,
  SauvegardePrealableImpossible,
  type DependancesSauvegarde,
  type Executeur,
} from "../src/api/modules/achillea/database/sauvegardes";
import { BotAchilleaInjoignable } from "../src/lib/achillea-discord";
import type { EtatBot } from "@rosegriffon/types/bot";

const JETON_DEV = "jeton-dev-de-test-achillea";
process.env.API_ADMIN_TOKEN = JETON_DEV;

function session(id = "123456789012345678") {
  return `Bearer ${signAchilleaSessionToken({ id, username: "test", avatar: null }, process.env.JWT_SECRET_KEY!)}`;
}
const role = (valeur: number) => async (_db: unknown, id: string) => ({ id, role: valeur });

describe("garde d'accès des routes d'exploitation", () => {
  it("répond 401 sans session sur chaque famille de routes", async () => {
    const routes: [string, string, string?][] = [
      ["GET", "/admin/db/tables"],
      ["GET", "/admin/db/tables/user/columns"],
      ["GET", "/admin/db/tables/user/rows"],
      ["POST", "/admin/db/query", '{"sql":"SELECT 1"}'],
      ["DELETE", "/admin/db/tables/user/rows", '{"pk":{"id":"1"}}'],
      ["GET", "/health/latency"],
      ["GET", "/health/monitoring"],
      ["GET", "/stats/totals"],
      ["GET", "/stats/commands/top"],
      ["GET", "/database/size"],
      ["GET", "/database/backups"],
      ["POST", "/database/backup"],
      ["POST", "/database/restore", '{"snapshotName":"x"}'],
    ];
    for (const [method, chemin, body] of routes) {
      const reponse = await app.handle(
        new Request(`http://localhost/v1/achillea${chemin}`, {
          method,
          headers: body ? { "content-type": "application/json" } : {},
          body,
        }),
      );
      expect({ chemin, status: reponse.status }).toEqual({ chemin, status: 401 });
    }
  });

  it("répond 403 à un administrateur (rôle 2) : la console est réservée au SuperAdministrateur", async () => {
    const controleur = creerAdminDbController({ chargerRole: role(2) });
    for (const chemin of ["/admin/db/tables", "/admin/db/tables/user/rows"]) {
      const reponse = await controleur.handle(new Request(`http://localhost${chemin}`, { headers: { authorization: session() } }));
      expect(reponse.status).toBe(403);
    }
    const stats = creerStatsController({ chargerRole: role(2) });
    expect((await stats.handle(new Request("http://localhost/stats/totals", { headers: { authorization: session() } }))).status).toBe(403);
  });

  it("refuse les tables hors liste blanche avant toute requête", async () => {
    const controleur = creerAdminDbController({ chargerRole: role(3) });
    for (const table of ["user_connection", "oauth_csrf", "pg_authid", "mikro_orm_migrations", 'user"; drop table x; --']) {
      const reponse = await controleur.handle(
        new Request(`http://localhost/admin/db/tables/${encodeURIComponent(table)}/columns`, {
          headers: { authorization: session() },
        }),
      );
      expect(reponse.status).toBe(404);
    }
    for (const table of ["audit_log", "wallet", "transaction", "user_connection"]) {
      const reponse = await controleur.handle(
        new Request(`http://localhost/admin/db/tables/${table}/rows`, {
          method: "POST",
          headers: { authorization: session(), "content-type": "application/json" },
          body: JSON.stringify({ values: { id: 1 } }),
        }),
      );
      expect(reponse.status).toBe(403);
    }
  });

  it("refuse toute écriture dans la console SQL avant de toucher la base", async () => {
    const controleur = creerAdminDbController({ chargerRole: role(3) });
    for (const requete of [
      "DELETE FROM achillea.stat",
      "UPDATE achillea.user SET role = 3",
      "SELECT 1; DROP TABLE achillea.user",
      "INSERT INTO achillea.stat (type) VALUES ('x')",
      "SELECT pg_terminate_backend(1)",
      "SELECT * FROM pg_catalog.pg_authid",
      "SELECT query_to_xml('select * from public.users', true, true, '')",
      "SELECT * FROM user_connection",
    ]) {
      const reponse = await controleur.handle(
        new Request("http://localhost/admin/db/query", {
          method: "POST",
          headers: { authorization: session(), "content-type": "application/json" },
          body: JSON.stringify({ sql: requete }),
        }),
      );
      expect({ requete, status: reponse.status }).toEqual({ requete, status: 400 });
    }
  });
});

describe("règles pures de la console base de données", () => {
  it("valide une lecture et rejette le reste", () => {
    expect(validerRequeteLecture("select * from achillea.user;")).toEqual({ ok: true, sql: "select * from achillea.user" });
    expect(validerRequeteLecture("WITH x AS (SELECT 1) SELECT * FROM x").ok).toBe(true);
    expect(validerRequeteLecture("SELECT count(u.id) FROM achillea.user u").ok).toBe(true);
    for (const refusee of [
      "",
      "   ",
      42,
      "TRUNCATE achillea.stat",
      "SELECT 1; SELECT 2",
      'SELECT * FROM "pg_shadow"',
      "SELECT current_setting('x')",
      "SELECT public.f()",
      'SELECT U&"\\0070g_authid"',
      "SELECT table_to_xml('achillea.user', true, true, '')",
      "SELECT * FROM information_schema.tables",
      "x".repeat(10_001),
    ]) {
      expect(validerRequeteLecture(refusee).ok).toBe(false);
    }
  });

  it("vérifie le plan : seules les tables achillea en liste blanche, sans table à secret", () => {
    const plan = (schema: string, relation: string) => [{ Plan: { "Node Type": "Seq Scan", Schema: schema, "Relation Name": relation } }];
    expect(verifierPlan(plan("achillea", "user")).ok).toBe(true);
    expect(verifierPlan(plan("public", "users")).ok).toBe(false);
    expect(verifierPlan(plan("achillea", "license")).ok).toBe(false);
    expect(verifierPlan(plan("achillea", "user_connection")).ok).toBe(false);
    expect(
      verifierPlan([{ Plan: { Plans: [{ "Function Name": "generate_series", Schema: "pg_catalog" }] } }]).ok,
    ).toBe(true);
    expect(verifierPlan([{ Plan: { Plans: [{ "Function Name": "evil", Schema: "public" }] } }]).ok).toBe(false);
  });

  it("plafonne, cite, masque et filtre", () => {
    expect(envelopperAvecLimite("SELECT 1 -- fin", 500)).toBe("SELECT * FROM (\nSELECT 1 -- fin\n) AS console_lecture LIMIT 500");
    expect(citerIdent('a"b')).toBe('"a""b"');
    expect(masquerLigne("license", { id: "1", qr_secret: "s" })).toEqual({ id: "1", qr_secret: VALEUR_MASQUEE });
    expect(valeursEcrivables("user", { role: 3, bio: "x", inconnue: 1 }, ["id", "role", "bio"])).toEqual({ bio: "x" });
    expect(valeursEcrivables("license", { qr_secret: "x", status: "Revoked" }, ["qr_secret", "status"])).toEqual({
      status: "Revoked",
    });
    expect(clePrimaire({ clan_id: 1 }, ["clan_id", "user_id"])).toBeNull();
    expect(clePrimaire({ clan_id: 1, user_id: "u", x: 2 }, ["clan_id", "user_id"])).toEqual({ clan_id: 1, user_id: "u" });
    expect(clePrimaire({}, [])).toBeNull();
    expect(tableEditable("audit_log")).toBe(false);
    expect(tableEditable("clan")).toBe(true);
  });

  it("garde la console fermée en production sauf ouverture explicite", () => {
    expect(consoleSqlOuverte({ NODE_ENV: "production" })).toBe(false);
    expect(consoleSqlOuverte({ NODE_ENV: "production", ACHILLEA_ADMIN_SQL_CONSOLE: "1" })).toBe(true);
    expect(consoleSqlOuverte({ NODE_ENV: "development" })).toBe(true);
  });
});

const ETAT: EtatBot = {
  profil: "achillea",
  titre: "Achilléa",
  etiquette: "Achillea#0001",
  identifiantApplication: "1",
  uptimeSecondes: 120,
  latenceMs: 42,
  guildes: [],
  guildesAbsentes: [],
  nombreCommandes: 10,
  modulesCharges: 3,
  memoireOctets: 64 * 1024 * 1024,
  mesureLe: new Date().toISOString(),
} as unknown as EtatBot;

describe("sondes bot (/health, /stats) via le serveur d'administration", () => {
  const dev = { authorization: `Bearer ${JETON_DEV}` };
  const panne = async () => {
    throw new BotAchilleaInjoignable("connexion refusée");
  };

  it("répond 503 avec le motif quand le bot est injoignable", async () => {
    const health = creerHealthController({ appelBot: panne });
    for (const chemin of ["/health/check", "/health/usage", "/health/logs"]) {
      const reponse = await health.handle(new Request(`http://localhost${chemin}`, { headers: dev }));
      expect(reponse.status).toBe(503);
      expect(((await reponse.json()) as { message: string }).message).toContain("connexion refusée");
    }
    const stats = creerStatsController({ appelBot: panne });
    expect((await stats.handle(new Request("http://localhost/stats/totals", { headers: dev }))).status).toBe(503);
  });

  it("sert l'état vivant du bot au jeton de développement", async () => {
    const appelBot = (async (chemin: string) => (chemin === "/journal" ? { lignes: ["ligne 1"] } : ETAT)) as never;
    const health = creerHealthController({ appelBot });
    const logs = await health.handle(new Request("http://localhost/health/logs", { headers: dev }));
    expect(logs.status).toBe(200);
    expect(await logs.json()).toEqual(["ligne 1"]);
    const usage = await health.handle(new Request("http://localhost/health/usage", { headers: dev }));
    expect(usage.status).toBe(200);
    expect(await usage.json()).toMatchObject({ elapsed: 120_000, memory: { usedInMb: "64.0" } });
  });

  it("agrège les statistiques comme le legacy", () => {
    const jours = derniersJours(3, new Date("2026-10-22T12:00:00Z"));
    expect(cumulerParJour(jours, new Map([["2026-10-20", 2], ["2026-10-22", 1]]))).toEqual([
      { date: "22/10/2026", count: 3 },
      { date: "21/10/2026", count: 2 },
      { date: "20/10/2026", count: 2 },
    ]);
    expect(trancherActivite([0, 10, 11, 100, 101, 5000])).toEqual({
      "1-10": 2,
      "11-50": 1,
      "51-100": 1,
      "101-1000": 1,
      ">1000": 1,
    });
    const guilde = (id: string, nom: string) => ({ id, nom }) as never;
    expect(classerGuildes([guilde("a", "A"), guilde("b", "B")], new Map([["b", 5]]))).toEqual([
      { id: "b", name: "B", totalCommands: 5 },
      { id: "a", name: "A", totalCommands: 0 },
    ]);
  });
});

describe("sauvegardes pg_dump / pg_restore (processus simulés)", () => {
  let repertoire: string;
  let appels: string[][];
  let environnements: Record<string, string>[];

  beforeEach(async () => {
    repertoire = await mkdtemp(join(tmpdir(), "achillea-sauvegardes-"));
    appels = [];
    environnements = [];
  });
  afterEach(async () => {
    await rm(repertoire, { recursive: true, force: true });
  });

  /** Simule pg_dump (écrit le fichier `--file`) et pg_restore ; codes de sortie paramétrables. */
  function executeur(codes: { pg_dump?: number; pg_restore?: number } = {}): Executeur {
    return async (commande, env) => {
      appels.push(commande);
      environnements.push(env);
      const binaire = commande[0]!.endsWith("pg_dump") ? "pg_dump" : "pg_restore";
      const code = codes[binaire] ?? 0;
      if (binaire === "pg_dump" && code === 0) {
        await writeFile(commande[commande.indexOf("--file") + 1]!, "PGDMP");
      }
      return { code, stderr: code === 0 ? "" : "erreur simulée" };
    };
  }

  let horloge = Date.parse("2026-10-22T10:00:00Z");
  const deps = (surcharge: Partial<DependancesSauvegarde> = {}): DependancesSauvegarde => ({
    executer: executeur(),
    trouver: binaire => `/usr/bin/${binaire}`,
    repertoire,
    conservation: 3,
    urlBase: "postgres://rg:secret%40x@127.0.0.1:5432/rg?sslmode=disable",
    maintenant: () => new Date((horloge += 1000)),
    ...surcharge,
  });

  it("sauvegarde le schéma achillea sans exposer le mot de passe, puis applique la rotation", async () => {
    const d = deps();
    for (let i = 0; i < 5; i++) await sauvegarder(d);
    const archives = await listerSauvegardes(repertoire);
    expect(archives).toHaveLength(3);
    expect(archives[0]!.name > archives[2]!.name).toBe(true);
    expect(appels[0]).toContain("--schema=achillea");
    expect(appels[0]).toContain("--format=custom");
    expect(appels[0]!.join(" ")).not.toContain("secret");
    expect(environnements[0]).toEqual({ PGPASSWORD: "secret@x" });
    expect((await readdir(repertoire)).some(nom => nom.endsWith(".partiel"))).toBe(false);
  });

  it("nettoie l'archive partielle et lève quand pg_dump échoue", async () => {
    await expect(sauvegarder(deps({ executer: executeur({ pg_dump: 1 }) }))).rejects.toThrow("pg_dump a échoué");
    expect(await readdir(repertoire)).toEqual([]);
  });

  it("répond 503 quand pg_dump est absent", async () => {
    await expect(sauvegarder(deps({ trouver: () => null }))).rejects.toBeInstanceOf(OutilAbsent);
    const controleur = creerDatabaseController({ sauvegardes: deps({ trouver: () => null }), journal: async () => {} });
    const reponse = await controleur.handle(
      new Request("http://localhost/database/backup", { method: "POST", headers: { authorization: `Bearer ${JETON_DEV}` } }),
    );
    expect(reponse.status).toBe(503);
    expect(((await reponse.json()) as { message: string }).message).toContain("pg_dump");
  });

  it("ne restaure qu'un nom de la liste, jamais un chemin", async () => {
    const d = deps();
    await sauvegarder(d);
    for (const nom of ["../../etc/passwd", "/var/backups/achillea/x.dump", "achillea-20990101T000000Z.dump"]) {
      await expect(restaurer(d, nom)).rejects.toBeInstanceOf(SauvegardeInconnue);
    }
    expect(appels.some(commande => commande[0]!.endsWith("pg_restore"))).toBe(false);
  });

  it("refuse de restaurer si la sauvegarde préalable échoue", async () => {
    const nom = await sauvegarder(deps());
    appels = [];
    await expect(restaurer(deps({ executer: executeur({ pg_dump: 1 }) }), nom)).rejects.toBeInstanceOf(
      SauvegardePrealableImpossible,
    );
    expect(appels.some(commande => commande[0]!.endsWith("pg_restore"))).toBe(false);
  });

  it("prend une sauvegarde préalable puis restaure en une transaction", async () => {
    const d = deps({ conservation: 1 });
    const nom = await sauvegarder(d);
    appels = [];
    const { sauvegardePrealable } = await restaurer(d, nom);
    expect(sauvegardePrealable).toEndWith("-avant-restauration.dump");
    expect(appels[0]![0]).toEndWith("pg_dump");
    const restauration = appels[1]!;
    expect(restauration[0]).toEndWith("pg_restore");
    expect(restauration).toContain("--single-transaction");
    expect(restauration).toContain("--exit-on-error");
    expect(restauration.at(-1)).toBe(join(repertoire, nom));
    // La rotation (conservation 1) n'a pas supprimé l'archive restaurée.
    expect((await listerSauvegardes(repertoire)).map(a => a.name)).toContain(nom);
  });

  it("refuse une seconde opération concurrente", async () => {
    let liberer!: () => void;
    const lent: Executeur = async (commande, env) => {
      await new Promise<void>(resolve => (liberer = resolve));
      return executeur()(commande, env);
    };
    const premiere = sauvegarder(deps({ executer: lent }));
    await Bun.sleep(5);
    await expect(sauvegarder(deps())).rejects.toBeInstanceOf(OperationEnCours);
    liberer();
    await premiere;
  });

  it("réserve la restauration à une session SuperAdministrateur", async () => {
    const options = { sauvegardes: deps(), journal: async () => {} };
    const viaJeton = await creerDatabaseController(options).handle(
      new Request("http://localhost/database/restore", {
        method: "POST",
        headers: { authorization: `Bearer ${JETON_DEV}`, "content-type": "application/json" },
        body: '{"snapshotName":"x"}',
      }),
    );
    expect(viaJeton.status).toBe(401);
    const admin = await creerDatabaseController({ ...options, chargerRole: role(2) }).handle(
      new Request("http://localhost/database/restore", {
        method: "POST",
        headers: { authorization: session(), "content-type": "application/json" },
        body: '{"snapshotName":"x"}',
      }),
    );
    expect(admin.status).toBe(403);
    const inconnue = await creerDatabaseController({ ...options, chargerRole: role(3) }).handle(
      new Request("http://localhost/database/restore", {
        method: "POST",
        headers: { authorization: session(), "content-type": "application/json" },
        body: '{"snapshotName":"../x.dump"}',
      }),
    );
    expect(inconnue.status).toBe(404);
  });

  it("forme les noms et la connexion", async () => {
    expect(nomSauvegarde(new Date("2026-10-22T10:15:00.123Z"))).toBe("achillea-20261022T101500Z.dump");
    expect(connexionPg("postgres://u@h/db").env).toEqual({});
    await writeFile(join(repertoire, "autre.txt"), "x");
    expect(await listerSauvegardes(repertoire)).toEqual([]);
    expect(await appliquerRotation(join(repertoire, "absent"), 1)).toEqual([]);
  });
});

describe("vérification de la chaîne d'audit", () => {
  const requete = () =>
    new Request("http://localhost/admin/ops/audit/verify", { headers: { authorization: session() } });

  it("est réservée au SuperAdministrateur", async () => {
    const anonyme = await creerVerificationAuditController().handle(
      new Request("http://localhost/admin/ops/audit/verify"),
    );
    expect(anonyme.status).toBe(401);
    const admin = await creerVerificationAuditController({ chargerRole: role(2) }).handle(requete());
    expect(admin.status).toBe(403);
  });

  it("rend le verdict de verifierChaineAudit", async () => {
    const controleur = creerVerificationAuditController({
      chargerRole: role(3),
      verifier: async () => ({ valid: false, broken_at: "42", total: 7 }),
    });
    const reponse = await controleur.handle(requete());
    expect(reponse.status).toBe(200);
    expect(await reponse.json()).toEqual({ valid: false, broken_at: "42", total: 7 });
  });

  it("journalise une sauvegarde réussie avec son auteur", async () => {
    const entrees: unknown[] = [];
    const repertoire = await mkdtemp(join(tmpdir(), "achillea-audit-"));
    try {
      const controleur = creerDatabaseController({
        journal: async (_db, entree) => {
          entrees.push(entree);
        },
        sauvegardes: {
          repertoire,
          trouver: binaire => binaire,
          urlBase: "postgres://u:p@127.0.0.1/db",
          executer: async commande => {
            await writeFile(commande[commande.indexOf("--file") + 1]!, "PGDMP");
            return { code: 0, stderr: "" };
          },
        },
      });
      const reponse = await controleur.handle(
        new Request("http://localhost/database/backup", { method: "POST", headers: { authorization: `Bearer ${JETON_DEV}` } }),
      );
      expect(reponse.status).toBe(200);
      expect(entrees).toEqual([expect.objectContaining({ action: "database.backup", acteur: null, cibleType: "database" })]);
    } finally {
      await rm(repertoire, { recursive: true, force: true });
    }
  });
});

describe.skipIf(!process.env.RG_TEST_DATABASE_URL)("console SQL sur base jetable", () => {
  it("bloque une écriture dissimulée dans un WITH grâce à la transaction READ ONLY", async () => {
    const controleur = creerAdminDbController({ chargerRole: role(3) });
    const reponse = await controleur.handle(
      new Request("http://localhost/admin/db/query", {
        method: "POST",
        headers: { authorization: session(), "content-type": "application/json" },
        body: JSON.stringify({ sql: "WITH d AS (DELETE FROM achillea.stat RETURNING 1) SELECT * FROM d" }),
      }),
    );
    expect(reponse.status).toBe(400);
    expect(((await reponse.json()) as { message: string }).message).toMatch(/read-only|lecture/i);
  });
});
