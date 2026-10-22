/**
 * `/blacklist` — liste noire des joueurs exclus d'Achilléa.
 */
import { z } from "zod";

import { AchilleaResource, encodePathSegment, type AchilleaClientResult } from "./http";

export const blacklistEntrySchema = z.object({
  userId: z.string(),
  username: z.string().nullable(),
  displayName: z.string(),
  reason: z.string(),
  since: z.string(),
});
export type BlacklistEntry = z.infer<typeof blacklistEntrySchema>;

export const blacklistStatusSchema = z.object({
  userId: z.string(),
  entry: blacklistEntrySchema.nullable(),
});
export type BlacklistStatus = z.infer<typeof blacklistStatusSchema>;

const blacklistListSchema = z.object({ data: z.array(blacklistEntrySchema) });
const blacklistRemovalSchema = z.object({ success: z.boolean(), userId: z.string() });

/** 4 routes. */
export class BlacklistResource extends AchilleaResource {
  /** `GET /blacklist` — joueurs sur la liste noire, du plus récent au plus ancien. */
  list(): Promise<AchilleaClientResult<{ data: BlacklistEntry[] }>> {
    return this.http.get("/blacklist", blacklistListSchema);
  }

  /** `GET /blacklist/:userId` — statut d'un joueur (`entry: null` s'il n'y figure pas). */
  get(userId: string): Promise<AchilleaClientResult<BlacklistStatus>> {
    return this.http.get(`/blacklist/${encodePathSegment(userId)}`, blacklistStatusSchema);
  }

  /** `POST /blacklist/:userId` — inscrit un joueur avec un motif (Administrateur). */
  add(userId: string, reason: string): Promise<AchilleaClientResult<BlacklistEntry>> {
    return this.http.post(`/blacklist/${encodePathSegment(userId)}`, blacklistEntrySchema, { reason });
  }

  /** `DELETE /blacklist/:userId` — retire un joueur de la liste noire (Administrateur). */
  remove(userId: string): Promise<AchilleaClientResult<{ success: boolean; userId: string }>> {
    return this.http.delete(`/blacklist/${encodePathSegment(userId)}`, blacklistRemovalSchema);
  }
}
