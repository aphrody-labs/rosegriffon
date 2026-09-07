// clan.guard.ts
import { CanActivateFn, Router, ActivatedRouteSnapshot } from "@angular/router";
import { inject } from "@angular/core";
import { toObservable } from "@angular/core/rxjs-interop";
import { map, take, catchError, switchMap, tap } from "rxjs/operators";
import { filter, from, of } from "rxjs";
import { ClanService } from "../../shared/services/clan-service";
import { UserService } from "../../shared/services/user-service";
import { ClanMemberRole } from "../models/ClanMember";

export function inClanGuard(requiredClanRole?: ClanMemberRole): CanActivateFn {
	return () => {
		const svc = inject(ClanService);
		const usvc = inject(UserService);
		const router = inject(Router);

		// your existing reactive observable of clan data
		const clanValue$ = toObservable(svc.clanValue);

		return from(usvc.loadUserIfNeeded()).pipe(
			switchMap(() => {
				const user = usvc.user();

				// ---- 1. Must be in a clan --------------------------------------------------
				if (!user?.clanId) {
					return of(router.createUrlTree(["/not-found"]));
				}

				// store clanId reactively (your design)
				svc.clanId.set(user.clanId);

				// ---- 2. If no required role → just load clan and OK -------------------------
				if (requiredClanRole == null) {
					return clanValue$.pipe(
						filter((clan): clan is NonNullable<typeof clan> => clan != null),
						take(1),
						map(() => true),
						catchError(() => of(router.createUrlTree(["/not-found"])))
					);
				}

				// ---- 3. Role is required → check with API ----------------------------------
				return usvc.getUserClanRole().pipe(
					switchMap((res) => {
						const role = res.role; // <-- extract the role field
						usvc.userClanRole.set(role);

						// Les admins du site accèdent au dashboard de leur clan même sans le rôle
						// requis (ex. dashboard/infos réservé aux Captain) — vérifié à nouveau
						// côté backend sur chaque action (ClansController).
						if (role < requiredClanRole && !usvc.userIsAdmin()) {
							return of(router.createUrlTree(["/forbidden"]));
						}

						return clanValue$.pipe(
							filter((clan): clan is NonNullable<typeof clan> => clan != null),
							take(1),
							map(() => true)
						);
					}),
					catchError(() => of(router.createUrlTree(["/not-found"])))
				);
			})
		);
	};
}
