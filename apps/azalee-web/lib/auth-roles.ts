/**
 * Re-export depuis @rg/types — backward-compat pour les imports existants
 * `@/lib/auth-roles` (~30 fichiers azalee). Source canonique = @rg/types/roles.
 */
export {
	ADMIN_ROLES,
	USER_MANAGEMENT_ROLES,
	isAdminRole,
	isUserManagementRole,
	type AdminRole,
	type UserManagementRole,
} from "@rg/types/roles";
export { MEDAILLE_AZALEE_ROLE_ID } from "@rg/types/discord";
