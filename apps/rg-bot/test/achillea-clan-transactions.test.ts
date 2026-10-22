import "./setup";
import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import {
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  type CompiledQuery,
  type DatabaseConnection,
  type Driver,
  type QueryResult,
} from "kysely";
import type { Database } from "@rosegriffon/db/schema";
import { ClanMemberRole, NotificationType } from "@rosegriffon/achillea-core/enums";
import { ClanManagementService } from "../src/api/modules/achillea/clans/management";

type Repondeur = (sql: string, parametres: readonly unknown[]) => unknown[] | undefined;

/** Pilote Kysely sans base : consigne chaque requête et rend les lignes du répondeur. */
function baseEnregistreuse(repondre: Repondeur) {
  const journal: Array<{ sql: string; parametres: readonly unknown[] }> = [];
  const connexion: DatabaseConnection = {
    async executeQuery<R>(requete: CompiledQuery): Promise<QueryResult<R>> {
      journal.push({ sql: requete.sql, parametres: requete.parameters });
      return { rows: (repondre(requete.sql, requete.parameters) ?? []) as R[] };
    },
    async *streamQuery() {
      throw new Error("non utilisé");
    },
  };
  const pilote: Driver = {
    init: async () => {},
    acquireConnection: async () => connexion,
    beginTransaction: async () => void journal.push({ sql: "BEGIN", parametres: [] }),
    commitTransaction: async () => void journal.push({ sql: "COMMIT", parametres: [] }),
    rollbackTransaction: async () => void journal.push({ sql: "ROLLBACK", parametres: [] }),
    releaseConnection: async () => {},
    destroy: async () => {},
  };
  const db = new Kysely<Database>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => pilote,
      createIntrospector: k => new PostgresIntrospector(k),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
  });
  return { db, journal };
}

const EXECUTANT = "100000000000000001";
const CIBLE = "100000000000000002";

/** Président (exécutant) et membre (cible) du clan 1, quatre membres restants. */
function repondeurClan(roleCible = ClanMemberRole.Member): Repondeur {
  return sql => {
    if (sql.includes('from "clan_member" as "cm" inner join "clan" as "c"'))
      return [{ clan_id: 1, user_id: EXECUTANT, role: ClanMemberRole.Captain }];
    if (sql.startsWith('select "clan_id", "user_id", "role" from "clan_member"'))
      return [{ clan_id: 1, user_id: CIBLE, role: roleCible }];
    if (sql.startsWith('select "id", "name", "under_member_limit" from "clan"'))
      return [{ id: 1, name: "Raimon", under_member_limit: false }];
    if (sql.startsWith('delete from "clan_member"'))
      return [{ clan_id: 1, user_id: CIBLE, role: roleCible, created_at: new Date(), clan_fame_contributed: 0 }];
    if (sql.startsWith('select "user_id" from "clan_member"')) return [{ user_id: EXECUTANT }];
    if (sql.startsWith('insert into "notification"')) return [{ id: 9 }];
    if (sql.includes("INSERT INTO achillea.audit_log"))
      return [{ id: "1", ts: new Date(), actor_id: EXECUTANT, action: "x", target_type: "x", target_id: null, payload: null, reason: null, prev_signature: null, signature: "s" }];
    return undefined;
  };
}

function entreTransaction(journal: Array<{ sql: string }>, motif: RegExp) {
  const debut = journal.findIndex(l => l.sql === "BEGIN");
  const fin = journal.findIndex(l => l.sql === "COMMIT");
  const position = journal.findIndex(l => motif.test(l.sql));
  return debut >= 0 && position > debut && position < fin;
}

describe("mutations de clan — audit et notification dans la transaction", () => {
  let warn: ReturnType<typeof spyOn<Console, "warn">>;
  beforeEach(() => {
    delete Bun.env.ACHILLEA_DISCORD_BOT_TOKEN;
    warn = spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  it("kick : historique, notification (membres + exclu), audit et alerte de sous-effectif dans la même transaction", async () => {
    const { db, journal } = baseEnregistreuse(repondeurClan());
    const resultat = await ClanManagementService.kick(db, EXECUTANT, CIBLE, "Inactivité prolongée");
    expect(resultat).toEqual({ ok: true, clanId: 1 });

    expect(entreTransaction(journal, /^insert into "clan_member_history"/)).toBe(true);
    expect(entreTransaction(journal, /^insert into "notification"/)).toBe(true);
    expect(entreTransaction(journal, /INSERT INTO achillea\.audit_log/)).toBe(true);
    expect(entreTransaction(journal, /^update "clan" set "under_member_limit" = \$1, "under_member_limit_since"/)).toBe(true);

    const notification = journal.find(l => l.sql.startsWith('insert into "notification"'))!;
    expect(notification.parametres).toContain(NotificationType.CLAN_MEMBER_KICK);
    const destinataires = journal.find(l => l.sql.startsWith('insert into "user_notification"'))!;
    expect(destinataires.parametres).toEqual(expect.arrayContaining([EXECUTANT, CIBLE]));
    const audit = journal.find(l => l.sql.includes("INSERT INTO achillea.audit_log"))!;
    expect(audit.parametres).toEqual(expect.arrayContaining([EXECUTANT, "clan.member.kick", "ClanMember", "Inactivité prolongée"]));
  });

  it("kick refusé : ni écriture ni audit", async () => {
    const { db, journal } = baseEnregistreuse(repondeurClan());
    const resultat = await ClanManagementService.kick(db, EXECUTANT, CIBLE, "no");
    expect(resultat.ok).toBe(false);
    expect(journal.some(l => /audit_log|^insert|^delete/.test(l.sql))).toBe(false);
  });

  it("changement de rôle : audité dans la transaction de la mise à jour", async () => {
    const { db, journal } = baseEnregistreuse(repondeurClan());
    const resultat = await ClanManagementService.updateMember(db, EXECUTANT, CIBLE, ClanMemberRole.SubCaptain, []);
    expect(resultat).toEqual({ ok: true, clanId: 1 });
    expect(entreTransaction(journal, /^update "clan_member"/)).toBe(true);
    const audit = journal.find(l => l.sql.includes("INSERT INTO achillea.audit_log"))!;
    expect(audit.parametres).toContain("clan.member.role");
    expect(entreTransaction(journal, /INSERT INTO achillea\.audit_log/)).toBe(true);
  });

  it("présidence non attribuable : rien n'est écrit", async () => {
    const { db, journal } = baseEnregistreuse(repondeurClan());
    const resultat = await ClanManagementService.updateMember(db, EXECUTANT, CIBLE, ClanMemberRole.Captain, []);
    expect(resultat.ok).toBe(false);
    expect(journal.some(l => /^update|audit_log/.test(l.sql))).toBe(false);
  });
});
