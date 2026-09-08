import { Context, Middleware } from "@tsed/common";

import { SESSION_COOKIE_NAME, verifySessionToken } from "@/auth";
import { UserService } from "@/services";
import { resolveDependency } from "@/utils/functions";

@Middleware()
export class OptionalAuthMiddleware {
	private readonly userServicePromise = resolveDependency(UserService);

	async use(@Context() ctx: Context) {
		const userService = await this.userServicePromise;
		const token = ctx.request.cookies?.[SESSION_COOKIE_NAME];

		if (!token) return;

		try {
			const decoded = verifySessionToken(token);
			const userData = await userService.syncWebUser(decoded.id);

			if (userData) {
				ctx.set("user", await userService.toDTO(userData, decoded.avatar ?? "", decoded.sim ?? 0));
			}
		} catch {
			// Authentication is optional; invalid credentials are intentionally ignored.
		}
	}
}
