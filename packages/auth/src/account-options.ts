/**
 * Options Better Auth de gestion du compte — changement d'adresse et
 * suppression — partagées par le site principal et le wiki.
 *
 * Les deux endpoints sont **désactivés par défaut** dans Better Auth
 * (`user.changeEmail.enabled` et `user.deleteUser.enabled`). Tant qu'ils ne
 * sont pas activés, les boutons correspondants de la page « Mon compte »
 * répondent `CHANGE_EMAIL_DISABLED` / 404 : ils avaient l'air de fonctionner
 * mais échouaient systématiquement.
 *
 * La suppression passe **obligatoirement** par un lien envoyé par courriel :
 * sans `sendDeleteAccountVerification`, Better Auth supprime immédiatement et
 * exige une session « fraîche », ce qui échoue en `SESSION_EXPIRED` sur les
 * sessions longues (les comptes d'administration en ont de dix ans).
 */

export interface AccountEmailMessage {
	to: string;
	subject: string;
	html: string;
}

export type AccountEmailSender = (message: AccountEmailMessage) => Promise<unknown> | unknown;

export interface AccountOptionsInput {
	/** Nom affiché dans les courriels (« Azalée », « Rose Griffon »). */
	appName: string;
	sendEmail: AccountEmailSender;
}

/** Gabarit sobre commun : un titre, un paragraphe, un bouton, une mise en garde. */
function template(options: {
	appName: string;
	title: string;
	intro: string;
	cta: string;
	url: string;
	footer: string;
}): string {
	const { appName, title, intro, cta, url, footer } = options;
	return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a1a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden">
        <tr><td style="padding:32px 28px 16px">
          <h1 style="margin:0 0 12px;font-size:20px;font-weight:700">${title}</h1>
          <p style="margin:0;font-size:15px;line-height:1.55;color:#4a4a4a">${intro}</p>
        </td></tr>
        <tr><td style="padding:0 28px 28px" align="center">
          <a href="${url}" style="display:inline-block;padding:13px 32px;background:#a14b3f;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:999px">${cta}</a>
          <p style="margin:18px 0 0;font-size:12px;line-height:1.5;color:#8a8a8a">${footer}</p>
        </td></tr>
        <tr><td style="padding:14px 28px;border-top:1px solid #ececec" align="center">
          <p style="margin:0;font-size:11px;color:#8a8a8a">${appName} — Rose Griffon</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * Bloc `user` à fusionner avec `commonAuthOptions.user` :
 *
 * ```ts
 * user: { ...commonAuthOptions.user, ...createAccountOptions({ appName, sendEmail }) }
 * ```
 *
 * Le spread explicite est obligatoire : redéfinir `user` dans l'app **remplace**
 * l'objet hérité de `...commonAuthOptions`, il emporterait donc la table de
 * correspondance des colonnes.
 */
export function createAccountOptions({ appName, sendEmail }: AccountOptionsInput) {
	return {
		changeEmail: {
			enabled: true,
			sendChangeEmailConfirmation: async ({
				user,
				newEmail,
				url,
			}: {
				user: { email: string };
				newEmail: string;
				url: string;
			}) => {
				// Le lien part vers l'adresse ACTUELLE : c'est elle qui autorise le
				// changement, sinon quiconque prend la main sur une session ouverte
				// pourrait déplacer le compte vers sa propre boîte.
				await sendEmail({
					html: template({
						appName,
						cta: "Confirmer le changement",
						footer: `Lien valable une heure. Si tu n'es pas à l'origine de cette demande, ignore ce message : ton adresse reste ${user.email}.`,
						intro: `Tu as demandé à remplacer <strong>${user.email}</strong> par <strong>${newEmail}</strong>.`,
						title: "Confirme ta nouvelle adresse",
						url,
					}),
					subject: `Confirme ta nouvelle adresse — ${appName}`,
					to: user.email,
				});
			},
		},
		deleteUser: {
			enabled: true,
			sendDeleteAccountVerification: async ({
				user,
				url,
			}: {
				user: { email: string };
				url: string;
			}) => {
				await sendEmail({
					html: template({
						appName,
						cta: "Supprimer définitivement mon compte",
						footer: "Lien valable 24 heures. Si tu n'es pas à l'origine de cette demande, ignore ce message : aucun compte ne sera supprimé.",
						intro:
							"Tu as demandé la suppression de ton compte. Cette action est <strong>irréversible</strong> : profil, contributions et préférences seront perdus.",
						title: "Confirme la suppression de ton compte",
						url,
					}),
					subject: `Confirme la suppression de ton compte — ${appName}`,
					to: user.email,
				});
			},
		},
	} as const;
}
