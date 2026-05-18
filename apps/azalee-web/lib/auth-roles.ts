/**
 * Re-export depuis @rose-griffon/types — backward-compat pour les imports existants
 * `@/lib/auth-roles` (~30 fichiers azalee). Source canonique = @rose-griffon/types/roles.
 */
export {
	ADMIN_ROLES,
	USER_MANAGEMENT_ROLES,
	isAdminRole,
	isUserManagementRole,
	type AdminRole,
	type UserManagementRole,
} from "@rose-griffon/types/roles";
export { MEDAILLE_AZALEE_ROLE_ID } from "@rose-griffon/types/discord";
