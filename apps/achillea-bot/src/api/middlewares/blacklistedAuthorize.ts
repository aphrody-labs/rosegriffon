import { Context, Middleware } from "@tsed/common";
import { Unauthorized } from "@tsed/exceptions";

import type { UserDTO } from "@/services";
import { UserService } from "@/services";
import { resolveDependency } from "@/utils/functions";

@Middleware()
export class BlacklistedAuthorize {
	private userService: UserService;

	constructor() {
		resolveDependency(UserService).then((userService) => {
			this.userService = userService;
		});
	}

	async use(@Context("user") user: UserDTO) {
		const isBlacklisted = await this.userService.isBlacklisted(user.id);
		if (isBlacklisted) throw new Unauthorized(`User ${user.username} is Blacklisted`);
	}
}
