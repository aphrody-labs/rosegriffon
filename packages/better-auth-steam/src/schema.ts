/**
 * Schéma Better Auth additionnel pour le plugin Steam.
 *
 * On ajoute une colonne `steamId` (SteamID64) sur la table `user`. C'est l'approche
 * « additional field » utilisée par les plugins du cœur (cf. `anonymous` qui ajoute
 * `isAnonymous` sur `user`). Le lien réel provider↔compte est par ailleurs matérialisé
 * dans la table `account` (`providerId="steam"`, `accountId=<steamId64>`), comme `siwe`.
 *
 * Mapping colonne : dans le monorepo rg, les tables Better Auth sont en snake_case
 * (cf. `commonAuthOptions`). Le `fieldName` ci-dessous mappe `steamId` → colonne `steam_id`.
 */

export const steamSchema = {
	user: {
		fields: {
			steamId: {
				type: "string" as const,
				required: false,
				input: false,
				unique: true,
				fieldName: "steam_id",
			},
		},
	},
};
