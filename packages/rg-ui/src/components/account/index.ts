/**
 * Page « Mon compte » partagée — `/dashboard/account` (site) et `/settings` (wiki).
 *
 * Composants présentationnels uniquement : chaque app branche son `authClient`,
 * ses server actions et ses fournisseurs OAuth. Voir `types.ts` pour le contrat.
 */
export { AccountAddressForm } from "./account-address-form";
export { AccountAvatarCard } from "./account-avatar-card";
export { AccountConnections, type AccountProviderConfig } from "./account-connections";
export {
	AccountEmailCard,
	AccountPasswordCard,
	AccountTwoFactorCard,
} from "./account-credentials";
export { AccountDangerZone } from "./account-danger-zone";
export { AVAILABLE_BADGES, AccountProfileForm, MAX_BADGES } from "./account-profile-form";
export { AccountSessions, describeUserAgent } from "./account-sessions";
export { AccountShell } from "./account-shell";
export { ACCOUNT_TAB_IDS, resolveAccountTab } from "./tabs";
export type {
	AccountActionResult,
	AccountAddressValues,
	AccountLinkedAccount,
	AccountProfileValues,
	AccountProviderId,
	AccountSession,
	AccountTabId,
} from "./types";
