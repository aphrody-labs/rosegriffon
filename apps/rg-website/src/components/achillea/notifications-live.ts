/**
 * Contrat du temps réel des notifications Achilléa — module pur.
 *
 * Le trigger `achillea_notification_temps_reel` (migration
 * `20261022_achillea_clans_temps_reel.sql`) publie, pour chaque ligne de
 * `achillea.user_notification`, un message Broadcast `notification` sur le topic
 * `achillea:notifications:<id Discord>`. La charge ne porte que des
 * identifiants : le contenu est relu avec la session (`GET /notifications/me`).
 */

export const EVENEMENT_NOTIFICATION = "notification";

export function topicNotifications(userId: string): string {
  return `achillea:notifications:${userId}`;
}

export interface SignalNotification {
  notificationId: number;
}

/** Lit la charge Broadcast ; `null` si elle n'a pas la forme attendue. */
export function lireSignal(charge: unknown): SignalNotification | null {
  if (!charge || typeof charge !== "object") return null;
  const id = Number((charge as { notificationId?: unknown }).notificationId);
  return Number.isInteger(id) && id > 0 ? { notificationId: id } : null;
}
