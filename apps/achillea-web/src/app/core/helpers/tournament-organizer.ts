/**
 * Prédicat pur : l'utilisateur courant est-il organisateur du tournoi ?
 *
 * Aligné sur `userIsTournamentOrganizer` côté bot (owner org / manager org / TO).
 * SuperAdmin (role ≥ 3) a un accès ops complet.
 *
 * Important : ne jamais comparer des ids optionnels entre eux quand l'utilisateur
 * est absent — `undefined === undefined` est vrai et ouvrirait l'UI TO à tous
 * les visiteurs anonymes (bug confirmé en prod sur /events/tournaments/:id).
 */
export function isTournamentOrganizerUser(
	user: { id?: string | null; role?: number | null } | null | undefined,
	tournament:
		| {
				organization?: {
					owner?: { id?: string | null } | null;
					managers?: Array<{
						user?: { id?: string | null } | null;
						id?: string | null;
					} | null> | null;
				} | null;
				managers?: Array<{ id?: string | null } | null> | null;
		  }
		| null
		| undefined
): boolean {
	const userId = user?.id;
	if (!userId) return false;

	// SuperAdministrator = 3
	if ((user?.role ?? 0) >= 3) return true;

	const ownerId = tournament?.organization?.owner?.id;
	if (ownerId && ownerId === userId) return true;

	const orgManagers = tournament?.organization?.managers;
	if (orgManagers?.some((om) => om?.user?.id === userId)) return true;

	const tournamentManagers = tournament?.managers;
	return !!tournamentManagers?.some((to) => to?.id === userId);
}
