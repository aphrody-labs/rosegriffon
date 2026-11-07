import { describe, expect, it } from "bun:test";
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
import { interclanStats, toInterclanStats, toTournamentStats, tournamentStats } from "./competition-stats";
import { participantSoloRanks } from "../tournaments/service";

/** Kysely réel (compilation Postgres) dont le pilote renvoie des lignes enregistrées. */
function recordingDb(answer: (query: CompiledQuery) => unknown[]) {
  const queries: CompiledQuery[] = [];
  const connection: DatabaseConnection = {
    executeQuery: async <R>(query: CompiledQuery): Promise<QueryResult<R>> => {
      queries.push(query);
      return { rows: answer(query) as R[] };
    },
    streamQuery: () => {
      throw new Error("stream non utilisé");
    },
  };
  const driver: Driver = {
    init: async () => {},
    acquireConnection: async () => connection,
    beginTransaction: async () => {},
    commitTransaction: async () => {},
    rollbackTransaction: async () => {},
    releaseConnection: async () => {},
    destroy: async () => {},
  };
  const db = new Kysely<Database>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => driver,
      createIntrospector: innerDb => new PostgresIntrospector(innerDb),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
  });
  return { db, queries };
}

describe("bilan tournois du profil", () => {
  it("projette la ligne SQL (bigint et numeric en texte) en statistiques", async () => {
    // Forme renvoyée par node-postgres : count -> texte, avg -> texte numeric.
    const { db, queries } = recordingDb(() => [
      {
        total: "1",
        personal_total: "3",
        personal_wins: "2",
        personal_losses: "1",
        personal_draws: "0",
        goals_scored_avg: "3.0000000000000000",
        goals_received_avg: "1.3333333333333333",
      },
    ]);
    const stats = await tournamentStats(db, "1006957787407974400");
    expect(stats).toEqual({
      total: 1,
      wins: 2,
      losses: 1,
      draws: 0,
      goalsScoredAvg: 3,
      goalsReceivedAvg: 1.3333333333333333,
      personalTotal: 3,
      personalWins: 2,
      personalLosses: 1,
      personalDraws: 0,
    });
    expect(queries).toHaveLength(1);
    expect(queries[0].sql).toContain("l.event_type = 'TOURNAMENT'");
    expect(queries[0].sql).toContain("count(distinct event_id) as total");
    expect(queries[0].parameters).toEqual(["1006957787407974400"]);
  });

  it("renvoie des zéros quand le joueur n'a aucun match de tournoi", () => {
    expect(toTournamentStats(undefined)).toMatchObject({ total: 0, personalTotal: 0, goalsScoredAvg: 0 });
  });
});

describe("bilan interclans du profil", () => {
  it("lit les compositions des interclans validés (état 7)", async () => {
    const { db, queries } = recordingDb(() => [
      {
        total: "2",
        wins: "1",
        losses: "1",
        draws: "0",
        personal_total: "2",
        personal_wins: "1",
        personal_losses: "0",
        personal_draws: "1",
        goals_scored_avg: "2.5",
        goals_received_avg: "2",
      },
    ]);
    const stats = await interclanStats(db, "42");
    expect(stats).toEqual({
      total: 2,
      wins: 1,
      losses: 1,
      draws: 0,
      goalsScoredAvg: 2.5,
      goalsReceivedAvg: 2,
      personalTotal: 2,
      personalWins: 1,
      personalLosses: 0,
      personalDraws: 1,
    });
    expect(queries[0].sql).toContain("interclan_lineup_member");
    expect(queries[0].parameters).toEqual(["42", 7, "42", 7]);
  });

  it("ignore les valeurs non numériques", () => {
    expect(toInterclanStats({ total: "abc", wins: null })).toMatchObject({ total: 0, wins: 0 });
  });
});

describe("palier solo des participants d'un tournoi", () => {
  const ranks = [
    { key: "Fer", min_elo: 0, max_elo: 49, gradient: ["#959595"] },
    { key: "Bronze", min_elo: 50, max_elo: 199, gradient: ["#cd7f32"] },
  ];

  it("associe l'ELO solo de la saison active au palier", async () => {
    const { db, queries } = recordingDb(query => {
      if (query.sql.includes('from "season"')) return [{ id: "s1" }];
      if (query.sql.includes('from "user_elo"'))
        return [
          { user_id: "a", elo: 16 },
          { user_id: "b", elo: 87 },
        ];
      if (query.sql.includes('from "rank"')) return ranks;
      return [];
    });
    const result = await participantSoloRanks(db, ["a", "b", "c", "a"]);
    expect(result.get("a")).toEqual({ elo: 16, key: "Fer", gradient: ["#959595"] });
    expect(result.get("b")).toEqual({ elo: 87, key: "Bronze", gradient: ["#cd7f32"] });
    expect(result.has("c")).toBe(false);
    const elo = queries.find(query => query.sql.includes('from "user_elo"'));
    expect(elo?.sql).toContain('"season_id" =');
    expect(elo?.parameters).toEqual([2, "s1", "a", "b", "c"]);
  });

  it("n'interroge rien sans participant", async () => {
    const { db, queries } = recordingDb(() => []);
    expect((await participantSoloRanks(db, [])).size).toBe(0);
    expect(queries).toHaveLength(0);
  });
});
