import { Context, Middleware } from "@tsed/common";
import { Unauthorized } from "@tsed/exceptions";

import { SESSION_COOKIE_NAME, verifySessionToken } from "@/auth";
import { UserService } from "@/services";
import { resolveDependency } from "@/utils/functions";

@Middleware()
export class CookieAuthorize {
	private readonly userServicePromise = resolveDependency(UserService);

	async use(@Context() ctx: Context) {
		const userService = await this.userServicePromise;
		const token = ctx.request.cookies?.[SESSION_COOKIE_NAME];
		if (!token) throw new Unauthorized("Not authenticated");
		try {
			const user = verifySessionToken(token);
			const userData = await userService.syncWebUser(user.id);
			if (!userData) throw new Unauthorized("Missing user");
			ctx.set("user", await userService.toDTO(userData, user.avatar ?? "", user.sim ?? 0));
		} catch (err: any) {
			throw new Unauthorized(`${err.message === "Missing user" ? err.message : "Invalid Token"}`);
		}
	}
}
