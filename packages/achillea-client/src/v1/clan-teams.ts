/**
 * `/clans/teams` — équipes internes d'un clan (création, effectif, réglages).
 *
 * Un clan a une équipe principale (`type` 0) et une secondaire (`type` 1).
 * Rôles d'un membre dans une équipe : 0 joueur (5 max, dont le capitaine),
 * 1 remplaçant (2 max), 2 coach (1 max). Un membre n'occupe qu'une place,
 * toutes équipes confondues.
 */
import { z } from "zod";

import { apiDateSchema } from "./common";
import { AchilleaResource, encodePathSegment, type AchilleaClientResult } from "./http";

/** Type d'équipe : 0 principale, 1 secondaire. */
export type ClanTeamType = 0 | 1;
/** Rôle dans une équipe : 0 joueur, 1 remplaçant, 2 coach. */
export type ClanTeamRole = 0 | 1 | 2;

export const clanTeamLinkSchema = z.object({
  linkId: z.number(),
  userId: z.string(),
  displayName: z.string(),
  avatar: z.string().nullable(),
  role: z.number(),
});
export type ClanTeamLink = z.infer<typeof clanTeamLinkSchema>;

export const clanTeamSchema = z.object({
  id: z.number(),
  clanId: z.number(),
  name: z.string(),
  type: z.number(),
  captainUserId: z.string().nullable(),
  updatedAt: apiDateSchema,
  members: z.array(clanTeamLinkSchema),
  valid: z.boolean(),
  errors: z.array(z.string()),
});
export type ClanTeam = z.infer<typeof clanTeamSchema>;

export const clanTeamsMembershipSchema = z.object({
  clanId: z.number().nullable(),
  clanRole: z.number().nullable(),
  clan: z
    .object({ id: z.number(), name: z.string(), shortenedName: z.string(), avatarUrl: z.string() })
    .nullable(),
});
export type ClanTeamsMembership = z.infer<typeof clanTeamsMembershipSchema>;

const deletionSchema = z.object({ success: z.literal(true) });

export interface UpdateClanTeamPayload {
  /** 3 à 30 caractères. */
  name?: string;
  /** Joueur (rôle 0) de l'équipe qui devient capitaine. */
  captainUserId?: string | null;
}

/** 7 routes. */
export class ClanTeamsResource extends AchilleaResource {
  /** `GET /clans/teams/membership` — clan actif du compte connecté et son rang (0 essai … 3 président). */
  membership(): Promise<AchilleaClientResult<ClanTeamsMembership>> {
    return this.http.get("/clans/teams/membership", clanTeamsMembershipSchema);
  }

  /** `GET /clans/teams/clan/:clanId` — équipes d'un clan, effectif et validité (public). */
  list(clanId: number): Promise<AchilleaClientResult<ClanTeam[]>> {
    return this.http.get(`/clans/teams/clan/${encodePathSegment(clanId)}`, z.array(clanTeamSchema));
  }

  /** `GET /clans/teams/:teamId` — une équipe (public). */
  get(teamId: number): Promise<AchilleaClientResult<ClanTeam>> {
    return this.http.get(`/clans/teams/${encodePathSegment(teamId)}`, clanTeamSchema);
  }

  /** `POST /clans/teams` — crée l'équipe principale (0) ou secondaire (1) d'un clan (Vice-Président et plus). */
  create(clanId: number, type: ClanTeamType, name?: string): Promise<AchilleaClientResult<ClanTeam>> {
    return this.http.post("/clans/teams", clanTeamSchema, { clanId, type, ...(name ? { name } : {}) });
  }

  /** `PUT /clans/teams/:teamId/roster` — remplace l'effectif d'un rôle (joueurs, remplaçants ou coach). */
  setRoster(teamId: number, role: ClanTeamRole, userIds: readonly string[]): Promise<AchilleaClientResult<ClanTeam>> {
    return this.http.put(`/clans/teams/${encodePathSegment(teamId)}/roster`, clanTeamSchema, {
      role,
      userIds: [...userIds],
    });
  }

  /** `PATCH /clans/teams/:teamId` — renomme l'équipe ou change son capitaine. */
  update(teamId: number, patch: UpdateClanTeamPayload): Promise<AchilleaClientResult<ClanTeam>> {
    return this.http.patch(`/clans/teams/${encodePathSegment(teamId)}`, clanTeamSchema, patch);
  }

  /** `DELETE /clans/teams/:teamId` — supprime une équipe et son effectif. */
  remove(teamId: number): Promise<AchilleaClientResult<{ success: true }>> {
    return this.http.delete(`/clans/teams/${encodePathSegment(teamId)}`, deletionSchema);
  }
}
