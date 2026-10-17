import { Component, Input, inject } from "@angular/core";
import {
	NotificationModel,
	NotificationCategory,
	NotificationCategoryName,
} from "../../../core/models/Notification";
import { Tag } from "primeng/tag";
import { Button } from "primeng/button";
import { UserService } from "../../services/user-service";

@Component({
	selector: "app-notif-preview",
	imports: [Tag, Button],
	templateUrl: "./notif-preview.html",
	styleUrl: "./notif-preview.css",
})
export class NotifPreview {
	private userSvc = inject(UserService);

	@Input({ required: true }) notification!: NotificationModel;

	protected async markAsRead(notif: NotificationModel) {
		await this.userSvc.markUserNotificationsAsRead(notif);
	}

	protected truncate(str: string, max = 150): string {
		if (!str) return str;
		return str.length > max ? `${str.slice(0, max).trimEnd()} [...]` : str;
	}

	protected getTagColor(
		notifCategory: NotificationCategory
	): "success" | "secondary" | "info" | "warn" | "danger" | "contrast" | null | undefined {
		switch (notifCategory) {
			case NotificationCategory.CLAN:
				return "warn";
			case NotificationCategory.GLOBAL:
				return "secondary";
			case NotificationCategory.USER:
				return "info";
			case NotificationCategory.ORGANIZATION:
				return "success";
			default:
				return "secondary";
		}
	}

	protected readonly NotificationCategoryName = NotificationCategoryName;
}
