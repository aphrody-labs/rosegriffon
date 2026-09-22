import { Service } from "@/decorators";
import { Clan, Notification, User, UserNotification } from "@/entities";

import { emitToUsers } from "../websockets/socket-server";
import { Database } from "./Database";

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

}
