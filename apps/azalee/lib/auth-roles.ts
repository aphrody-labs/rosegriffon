/**
 * Centralized role definitions for the Azalee admin system.
 * Import these constants instead of hardcoding role arrays.
 */

/** Roles that can access the dashboard and editorial features */
export const ADMIN_ROLES = [
	"admin",
	"superadmin",
	"editor",
	"moderator",
] as const;

/** Roles that can manage users (role changes, bans) */
export const USER_MANAGEMENT_ROLES = ["admin", "superadmin"] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];
export type UserManagementRole = (typeof USER_MANAGEMENT_ROLES)[number];

export function isAdminRole(role: string | null | undefined): boolean {
	return ADMIN_ROLES.includes(role as AdminRole);
}

export function isUserManagementRole(role: string | null | undefined): boolean {
	return USER_MANAGEMENT_ROLES.includes(role as UserManagementRole);
}

/**
 * Discord role ID granted to "Médaille Azalée" community contributors.
 * They have editorial access to the news dashboard alongside ADMIN_ROLES.
 */
export const MEDAILLE_AZALEE_ROLE_ID = "1364903623783612498";
