import {
	ActivatedRouteSnapshot,
	CanActivateFn,
	Router,
	RouterStateSnapshot,
} from "@angular/router";
import { inject } from "@angular/core";
import { UserService } from "../../shared/services/user-service";

export const authGuard: CanActivateFn = async (
	route: ActivatedRouteSnapshot,
	state: RouterStateSnapshot
) => {
	const svc = inject(UserService);
	const router = inject(Router);
	await svc.loadUserIfNeeded();

	if (svc.user()) {
		return true;
	}

	return router.createUrlTree(["/auth"], {
		queryParams: {
			returnUrl: state.url,
			...(svc.authStatus() === "error" ? { reason: "unavailable" } : {}),
		},
	});
};
