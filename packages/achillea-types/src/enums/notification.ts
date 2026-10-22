export enum NotificationType {
  NEW_ORGANIZATION_CREATION_REQUEST,
  NEW_ORGANIZATION_EDITION_REQUEST,
  NEW_ORGANIZATION_EDIT_REPLY,
  NEW_ORGANIZATION_ACCEPT_REPLY,
  NEW_ORGANIZATION_REJECT_REPLY,
  CLAN_MEMBER_KICK,
  /** Appariement ranked relayé par `POST /notifications/emit-match-found`. */
  RANKED_MATCH_FOUND,
  /** Évènement temps réel relayé par `POST /notifications/emit-to-users`. */
  REALTIME_EVENT,
  // Ajouts en fin d'enum : les valeurs numériques déjà stockées ne bougent pas.
  CLAN_DISBANDED,
  CLAN_APPLICATION_RECEIVED,
  CLAN_APPLICATION_ACCEPTED,
  CLAN_APPLICATION_REJECTED,
  CLAN_INVITE_RECEIVED,
}

export enum NotificationCategory {
  USER,
  CLAN,
  GLOBAL,
  ORGANIZATION,
}
