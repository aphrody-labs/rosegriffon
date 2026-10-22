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
}

export enum NotificationCategory {
  USER,
  CLAN,
  GLOBAL,
  ORGANIZATION,
}
