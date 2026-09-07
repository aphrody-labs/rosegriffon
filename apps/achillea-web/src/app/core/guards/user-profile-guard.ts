import { CanActivateFn, Router, ActivatedRouteSnapshot } from "@angular/router";
import { inject } from "@angular/core";
import { toObservable } from "@angular/core/rxjs-interop";
import { map, take, catchError } from "rxjs/operators";
import { filter, of } from "rxjs";
import { UserService } from "../../shared/services/user-service";

export const userProfileGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
	const svc = inject(UserService);
	const router = inject(Router);
	const id = route.paramMap.get("id");
	svc.userProfileId.set(id ?? undefined);

	return toObservable(svc.userProfileValue).pipe(
		filter((userProfile): userProfile is NonNullable<typeof userProfile> => userProfile != null),
		take(1),
		map(() => true),
		catchError(() => of(router.createUrlTree(["/not-found"])))
	);
};
