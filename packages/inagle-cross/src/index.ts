// SPDX-License-Identifier: MIT
/**
 * @rosegriffon/inagle-cross
 * API de donnees et de retro-conception pour Inazuma Eleven Cross.
 */

export const INAGLE_CROSS_VERSION = "1.4.7";

export const crossAudioManifest = { clips: [], tracks: [] };
export const crossCatalogStats = { totalPlayers: 0, totalItems: 0, totalTeams: 0 };
export const crossEnums = {};
export const crossExtractionStatus = { lastUpdated: new Date().toISOString(), status: "ready" };
export const crossSchema = { tables: [] };
export const crossTypeSchema = { types: [] };

export interface CrossPlayer {
  id: string;
  name: string;
  element?: string;
  position?: string;
}
