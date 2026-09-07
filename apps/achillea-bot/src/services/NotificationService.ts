import { NotFound } from "@tsed/exceptions";

import { Service } from "@/decorators";
import { Clan, Notification, User, UserNotification } from "@/entities";
import { UserRole } from "@/utils/enums";

import { emitToUsers } from "../websockets/socket-server";
import { Database } from "./Database";
import type { UserDTO } from "./UserService";

@Service()
export class NotificationService {
	constructor(private db: Database) {}

	private async assignToUsers(users: User[], notification: Notification) {
		const userNotifs: UserNotification[] = [];

		for (const user of users) {
			const un = new UserNotification();
			un.user = user;
			un.notification = notification;
			userNotifs.push(un);
		}

		this.db.em.persist(userNotifs);
		await this.db.em.flush();
	}

	private async saveAndEmit(users: User[], notification: Notification, eventName: string) {
		await this.assignToUsers(users, notification);

		// Emit to all connected sockets in the users’ rooms
		emitToUsers(
			users.map((u) => u.id),
			eventName,
			{ notification }
		);
	}

	async sendGlobalNotification(notification: Notification) {
		const allUsers = await this.db.em.find(User, {});
		await this.saveAndEmit(allUsers, notification, "notification");
	}

	/**
	 * Notification destinée à un seul joueur (promotion depuis une liste d'attente,
	 * disqualification, annulation d'un tournoi auquel il est inscrit).
	 * Sans effet — plutôt qu'en erreur — si l'utilisateur n'existe plus.
	 */
	async sendUserNotification(userId: string, notification: Notification) {
		const user = await this.db.em.findOne(User, { id: userId });
		if (!user) return;

		await this.saveAndEmit([user], notification, "notification");
	}

	async sendClanNotification(clan: Clan, notification: Notification) {
		await this.db.em.populate(clan, ["members.user"]);
		const users = clan.members.map((m) => m.user);
		await this.saveAndEmit(users, notification, "notification");
	}

	async sendAdminsNotification(notification: Notification) {
		const admins = await this.db.em.find(User, {
			role: { $in: [UserRole.Administrator, UserRole.SuperAdministrator] },
		});
		await this.assignToUsers(admins, notification);
	}

	async sendSuperAdminsNotification(notification: Notification) {
		const superAdmins = await this.db.em.find(User, {
			role: UserRole.SuperAdministrator,
		});
		await this.assignToUsers(superAdmins, notification);
	}

	async getUnreadUserNotifications(user: UserDTO) {
		const unreadNotifs = await this.db.em.find(
			UserNotification,
			{ user: user.id, isRead: false },
			{ populate: ["notification"] }
		);

		return unreadNotifs.map((un) => un.notification) as Notification[];
	}

	async markAsRead(user: UserDTO, notificationId: number) {
		const userNotif = await this.db.em.findOne(UserNotification, {
			user: user.id,
			notification: notificationId,
		});

		if (!userNotif) throw new NotFound("Notification not found");

		userNotif.isRead = true;
		userNotif.readAt = new Date();
		await this.db.em.flush();
	}

	async markAsUnread(user: UserDTO, notificationId: number) {
		const userNotif = await this.db.em.findOne(UserNotification, {
			user: user.id,
			notification: notificationId,
		});

		if (!userNotif) throw new NotFound("Notification not found");

		userNotif.isRead = false;
		userNotif.readAt = null;
		await this.db.em.flush();
	}

	async markAllAsRead(userId: string) {
		// Bulk update
		await this.db.em
			.getRepository(UserNotification)
			.nativeUpdate({ user: userId, isRead: false }, { isRead: true });
	}
}
