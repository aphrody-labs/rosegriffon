// clan.guard.ts
import { CanActivateFn, Router, ActivatedRouteSnapshot } from "@angular/router";
import { inject } from "@angular/core";
import { toObservable } from "@angular/core/rxjs-interop";
import { map, take, catchError } from "rxjs/operators";
import { filter, of } from "rxjs";
import { ClanService } from "../../shared/services/clan-service";

export const clanGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
	const svc = inject(ClanService);
	const router = inject(Router);
	const id = Number(route.paramMap.get("id"));
	svc.clanId.set(id);

	return toObservable(svc.clanValue).pipe(
		filter((clan): clan is NonNullable<typeof clan> => clan != null),
		take(1),
		map(() => true),
		catchError(() => of(router.createUrlTree(["/not-found"])))
	);
};
