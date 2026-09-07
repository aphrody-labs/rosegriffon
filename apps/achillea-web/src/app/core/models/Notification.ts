import { ClanMemberRole } from "./ClanMember";

export interface NotificationModel {
	id: number;
	title: string;
	message: string;
	type: NotificationType;
	category: NotificationCategory;
	payload: any;
}

export enum NotificationType {
	NEW_ORGANIZATION_CREATION_REQUEST,
	NEW_ORGANIZATION_EDITION_REQUEST,
	NEW_ORGANIZATION_EDIT_REPLY,
	NEW_ORGANIZATION_ACCEPT_REPLY,
	NEW_ORGANIZATION_REJECT_REPLY,
	CLAN_MEMBER_KICK,
}

export enum NotificationCategory {
	USER,
	CLAN,
	GLOBAL,
	ORGANIZATION,
}

export const NotificationCategoryName: Record<NotificationCategory, string> = {
	[NotificationCategory.USER]: "Perso.",
	[NotificationCategory.CLAN]: "Clan",
	[NotificationCategory.GLOBAL]: "Globale",
	[NotificationCategory.ORGANIZATION]: "Organisation",
};
