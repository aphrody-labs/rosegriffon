import { Context, Middleware } from "@tsed/common";
import * as jwt from "jsonwebtoken";

import { env } from "@/env";
import { UserService } from "@/services";
import { resolveDependency } from "@/utils/functions";

@Middleware()
export class OptionalAuthMiddleware {
	private readonly userServicePromise = resolveDependency(UserService);

	async use(@Context() ctx: Context) {
		const userService = await this.userServicePromise;
		const token = ctx.request.cookies?.token;

		if (!token) return;

		try {
			const decoded = jwt.verify(token, env.JWT_SECRET_KEY, {
				algorithms: ["HS256"],
			}) as jwt.JwtPayload;
			if (typeof decoded.id !== "string" || !decoded.id) return;
			const userData = await userService.syncWebUser(decoded.id);

			if (userData) {
				ctx.set("user", await userService.toDTO(userData, decoded.avatar, decoded.sim));
			}
		} catch {
			// Authentication is optional; invalid credentials are intentionally ignored.
		}
	}
}
