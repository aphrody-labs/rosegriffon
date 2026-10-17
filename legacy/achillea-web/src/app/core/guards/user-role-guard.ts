import { inject } from "@angular/core";
import { Router, CanActivateFn } from "@angular/router";
import { from, of } from "rxjs";
import { switchMap, catchError } from "rxjs/operators";
import { UserRole } from "../models/Suggestion";
import { UserService } from "../../shared/services/user-service";

export function userRoleGuard(requiredRole?: UserRole): CanActivateFn {
	return () => {
		const usvc = inject(UserService);
		const router = inject(Router);

		// On utilise from() au cas où reloadUser retourne une Promise
		return from(usvc.reloadUser()).pipe(
			// switchMap attend un Observable en retour, pas un booléen direct
			switchMap(() => {
				const user = usvc.user(); // Suppose que c'est un Signal ou getter sync

				// ---- 1. Must exist --------------------------------------------------
				if (!user) {
					return of(router.createUrlTree(["/not-found"]));
				}

				// ---- 2. If no required role → just load and OK ----------------------
				if (requiredRole == null) {
					return of(true); // ✅ Correction : on enveloppe le booléen dans of()
				}

				// Si l'user n'a pas de rôle défini mais qu'on en attend un
				if (user.role == null) {
					return of(router.createUrlTree(["/not-found"]));
				}

				// ---- 3. Role is required → check logic ------------------------------
				// Note: Assurez-vous que votre Enum UserRole supporte bien la comparaison >=
				return user.role >= requiredRole ? of(true) : of(router.createUrlTree(["/not-found"]));
			}),

			// ---- 4. Gérer les erreurs de l'API (ex: 401, Réseau) ----------------
			catchError((err) => {
				console.error("Erreur guard:", err);
				// En cas d'erreur API (ex: session expirée), on redirige
				return of(router.createUrlTree(["/not-found"]));
			})
		);
	};
}
