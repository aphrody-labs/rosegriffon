import { Context, Middleware } from "@tsed/common";
import { Unauthorized } from "@tsed/exceptions";
import jwt from "jsonwebtoken";

import { env } from "@/env";
import { UserService } from "@/services";
import { resolveDependency } from "@/utils/functions";

@Middleware()
export class CookieAuthorize {
	private readonly userServicePromise = resolveDependency(UserService);

	async use(@Context() ctx: Context) {
		const userService = await this.userServicePromise;
		const token = ctx.request.cookies?.token;
		if (!token) throw new Unauthorized("Not authenticated");
		try {
			const user = jwt.verify(token, env.JWT_SECRET_KEY, {
				algorithms: ["HS256"],
			}) as jwt.JwtPayload;
			if (typeof user.id !== "string" || !user.id) throw new Unauthorized("Invalid Token");
			const userData = await userService.syncWebUser(user.id);
			if (!userData) throw new Unauthorized("Missing user");
			ctx.set("user", await userService.toDTO(userData, user.avatar, user.sim)); // Attach to context for controllers
		} catch (err: any) {
			throw new Unauthorized(`${err.message === "Missing user" ? err.message : "Invalid Token"}`);
		}
	}
}
