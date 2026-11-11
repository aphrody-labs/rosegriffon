// SPDX-License-Identifier: MIT
/**
 * @rosegriffon/inagle-cross
 * API de donnees et de retro-conception pour Inazuma Eleven Cross.
 */

export const INAGLE_CROSS_VERSION = "1.4.7";

export interface CrossPlayer {
  id: string;
  name: string;
  element?: string;
  position?: string;
}
