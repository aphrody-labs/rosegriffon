/**
 * `/interclans` — défis entre clans : proposition, validation, compositions,
 * verrouillage, lancement, résultats et annulation.
 *
 * États (`InterclanState`) : 0 en attente, 1 accepté, 2 refusé, 3 prêt
 * (compositions verrouillées), 4 en cours, 5 terminé (vote de validation
 * ouvert), 6 annulé, 7 résultat validé, 8 résultat contesté.
 */
import { z } from "zod";

import { apiDateSchema } from "./common";
import { AchilleaResource, encodePathSegment, type AchilleaClientResult } from "./http";

export const interclanClanSchema = z.object({
  id: z.number(),
  name: z.string(),
  shortName: z.string(),
  normalizedShortName: z.string(),
  emojiId: z.string().nullable(),
  avatarUrl: z.string(),
  roleId: z.string(),
  channelId: z.string(),
});

export const interclanLineupSchema = z.object({
  id: z.number(),
  clanId: z.number(),
  lockedIn: z.boolean(),
  valid: z.boolean(),
  members: z.array(z.object({ userId: z.string(), displayName: z.string(), position: z.number() })),
});
export type InterclanLineup = z.infer<typeof interclanLineupSchema>;

export const interclanMatchSchema = z.object({
  id: z.number(),
  state: z.string(),
  players: z.array(z.object({ userId: z.string(), displayName: z.string(), team: z.number(), score: z.number() })),
});
export type InterclanMatch = z.infer<typeof interclanMatchSchema>;

export const interclanValidationSchema = z.object({
  proposalId: z.number(),
  status: z.string(),
  expiresAt: apiDateSchema,
  closedAt: apiDateSchema.nullable(),
  approvals: z.number(),
  rejections: z.number(),
  eligible: z.number(),
  minParticipationRatio: z.number(),
});

export const interclanDetailSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string(),
  state: z.number(),
  stateLabel: z.string(),
  fixedDate: apiDateSchema,
  createdAt: apiDateSchema,
  updatedAt: apiDateSchema,
  discordChannelId: z.string().nullable(),
  winnerClanId: z.number().nullable(),
  clanA: interclanClanSchema,
  clanB: interclanClanSchema,
  lineups: z.array(interclanLineupSchema),
  matches: z.array(interclanMatchSchema),
  validation: interclanValidationSchema.nullable(),
  viewer: z.object({ clanId: z.number().nullable(), clanRole: z.number().nullable(), isAdmin: z.boolean() }).nullable(),
});
export type InterclanDetail = z.infer<typeof interclanDetailSchema>;

export const interclanSummarySchema = z.object({
  id: z.number(),
  name: z.string(),
  state: z.number(),
  stateLabel: z.string(),
  fixedDate: apiDateSchema,
  clanA: z.object({ id: z.number(), name: z.string(), shortName: z.string() }),
  clanB: z.object({ id: z.number(), name: z.string(), shortName: z.string() }),
  winnerClanId: z.number().nullable(),
});
export type InterclanSummary = z.infer<typeof interclanSummarySchema>;

export const interclanScoreResultSchema = z.object({
  detail: interclanDetailSchema,
  termine: z.boolean(),
  match: z.object({ id: z.number(), scoreA: z.number(), scoreB: z.number(), joueurA: z.string(), joueurB: z.string() }),
});
export type InterclanScoreResult = z.infer<typeof interclanScoreResultSchema>;

export interface InterclanListQuery {
  clanId?: number;
  state?: number;
  limit?: number;
  /** Interclans du clan du compte connecté. */
  mine?: boolean;
}

export interface CreateInterclanPayload {
  /** Sigle du clan défié. */
  challengedShortName?: string;
  challengedClanId?: number;
  /** « JJ/MM HH:MM » (heure de Paris) ou ISO 8601, au plus 7 jours dans le futur. */
  date: string;
  motif?: string | null;
}

export interface InterclanLineupEntry {
  userId: string;
  /** 1 à 5. */
  position: number;
}

/** 10 routes. */
export class InterclansResource extends AchilleaResource {
  /** `GET /interclans` — interclans d'un clan (ou du sien avec `mine`), du plus récent au plus ancien. */
  list(query: InterclanListQuery = {}): Promise<AchilleaClientResult<{ data: InterclanSummary[] }>> {
    return this.http.get("/interclans", z.object({ data: z.array(interclanSummarySchema) }), {
      query: { clanId: query.clanId, state: query.state, limit: query.limit, mine: query.mine },
    });
  }

  /** `GET /interclans/:id` — fiche : compositions, matchs, vote de validation, droits du lecteur. */
  get(id: number): Promise<AchilleaClientResult<InterclanDetail>> {
    return this.http.get(`/interclans/${encodePathSegment(id)}`, interclanDetailSchema);
  }

  /** `POST /interclans` — défie un clan (Vice-Président et plus du clan challenger). */
  create(payload: CreateInterclanPayload): Promise<AchilleaClientResult<InterclanDetail>> {
    return this.http.post("/interclans", interclanDetailSchema, payload);
  }

  /** `POST /interclans/:id/respond` — le clan défié accepte (ouvre le salon) ou refuse. */
  respond(id: number, accept: boolean): Promise<AchilleaClientResult<InterclanDetail>> {
    return this.http.post(`/interclans/${encodePathSegment(id)}/respond`, interclanDetailSchema, { accept });
  }

  /** `PUT /interclans/:id/lineups/:clanId` — remplace la composition d'un clan (5 joueurs, positions 1–5). */
  setLineup(id: number, clanId: number, members: readonly InterclanLineupEntry[]): Promise<AchilleaClientResult<InterclanDetail>> {
    return this.http.put(`/interclans/${encodePathSegment(id)}/lineups/${encodePathSegment(clanId)}`, interclanDetailSchema, {
      members: members.map(m => ({ userId: m.userId, position: m.position })),
    });
  }

  /** `POST /interclans/:id/lineups/:clanId/lock` — verrouille une composition complète, dans l'heure qui précède. */
  lockLineup(id: number, clanId: number): Promise<AchilleaClientResult<InterclanDetail>> {
    return this.http.post(`/interclans/${encodePathSegment(id)}/lineups/${encodePathSegment(clanId)}/lock`, interclanDetailSchema);
  }

  /** `POST /interclans/:id/cancel` — annule un interclan accepté ou prêt (Président de l'un des clans). */
  cancel(id: number): Promise<AchilleaClientResult<InterclanDetail>> {
    return this.http.post(`/interclans/${encodePathSegment(id)}/cancel`, interclanDetailSchema);
  }

  /** `POST /interclans/:id/start` — lance l'interclan et génère un match par position. */
  start(id: number): Promise<AchilleaClientResult<InterclanDetail>> {
    return this.http.post(`/interclans/${encodePathSegment(id)}/start`, interclanDetailSchema);
  }

  /** `POST /interclans/matches/:lobbyId/score` — saisit le score d'un match ; le dernier ouvre le vote de validation. */
  reportScore(lobbyId: number, scoreA: number, scoreB: number): Promise<AchilleaClientResult<InterclanScoreResult>> {
    return this.http.post(`/interclans/matches/${encodePathSegment(lobbyId)}/score`, interclanScoreResultSchema, { scoreA, scoreB });
  }

  /** `POST /interclans/:id/arbitrate` — arbitrage staff : valide le résultat ou annule l'interclan. */
  arbitrate(id: number, approve: boolean): Promise<AchilleaClientResult<InterclanDetail>> {
    return this.http.post(`/interclans/${encodePathSegment(id)}/arbitrate`, interclanDetailSchema, { approve });
  }
}
