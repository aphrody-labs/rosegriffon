"use client";

import {
	AccountAvatarCard,
	AccountConnections,
	AccountDangerZone,
	AccountEmailCard,
	AccountPasswordCard,
	AccountProfileForm,
	type AccountProviderConfig,
	AccountSessions,
	AccountShell,
	AccountTwoFactorCard,
	type AccountLinkedAccount,
	type AccountProfileValues,
	type AccountSession,
	type AccountTabId,
} from "@rose-griffon/ui";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { createClient } from "@/lib/supabase/client";

import { updateAvatarUrl, updateProfile } from "./actions";

interface AccountClientProps {
	userId: string;
	email?: string | null;
	initialTab: AccountTabId;
	avatarUrl: string | null;
	username: string | null;
	role: string | null;
	twoFactorEnabled: boolean;
	hasPassword: boolean;
	profile: AccountProfileValues;
	accounts: AccountLinkedAccount[];
	sessions: AccountSession[];
}

/**
 * Câblage côté wiki de la page « Mon compte » partagée avec le site principal.
 *
 * Pas d'onglet Adresse ici : le wiki n'expédie rien, collecter une adresse
 * postale n'y aurait aucun usage.
 */
export function AccountClient({
	userId,
	email,
	initialTab,
	avatarUrl,
	username,
	role,
	twoFactorEnabled,
	hasPassword,
	profile,
	accounts,
	sessions,
}: AccountClientProps) {
	const router = useRouter();
	const reload = () => router.refresh();

	const uploadAvatar = async (file: File) => {
		const supabase = createClient();
		const extension = file.name.split(".").pop()?.toLowerCase() ?? "png";
		// Nom unique : un chemin fixe renverrait la même URL publique, que le
		// navigateur et le CDN resservent depuis leur cache.
		const path = `${userId}/avatar-${Date.now()}.${extension}`;

		const { error: uploadError } = await supabase.storage
			.from("avatars")
			.upload(path, file, { contentType: file.type, upsert: true });
		if (uploadError) {
			throw new Error(uploadError.message);
		}

		const {
			data: { publicUrl },
		} = supabase.storage.from("avatars").getPublicUrl(path);

		const res = await updateAvatarUrl(publicUrl);
		if (res.error) {
			throw new Error(res.error);
		}
		reload();
		return publicUrl;
	};

	const link = async (provider: "discord" | "google") => {
		const { error } = await authClient.linkSocial({
			callbackURL: "/settings?tab=connections",
			provider,
		});
		if (error) {
			throw new Error(error.message ?? "Impossible de lier ce compte.");
		}
	};

	const unlink = async (providerId: string) => {
		const { error } = await authClient.unlinkAccount({ providerId });
		if (error) {
			throw new Error(error.message ?? "Impossible de dissocier ce compte.");
		}
		toast.success("Compte dissocié.");
		reload();
	};

	const providers: AccountProviderConfig[] = [
		{ id: "discord", onLink: () => link("discord"), onUnlink: () => unlink("discord") },
		{ id: "google", onLink: () => link("google"), onUnlink: () => unlink("google") },
	];

	return (
		<AccountShell
			email={email}
			backHref={username ? `/profil/${username}` : "/"}
			backLabel="Retour à mon profil"
			initialTab={initialTab}
			tabs={[
				{
					content: (
						<div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
							<div className="lg:col-span-1">
								<AccountAvatarCard
									avatarUrl={avatarUrl}
									username={username}
									role={role}
									onUpload={uploadAvatar}
								/>
							</div>
							<div className="lg:col-span-2">
								<AccountProfileForm
									values={profile}
									profileUrlPrefix="/profil/"
									onSubmit={async (values) => updateProfile(values)}
								/>
							</div>
						</div>
					),
					id: "profile",
				},
				{
					content: <AccountConnections providers={providers} accounts={accounts} />,
					id: "connections",
				},
				{
					content: (
						<div className="space-y-6">
							<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
								<AccountEmailCard
									currentEmail={email}
									onChangeEmail={async (newEmail) => {
										const { error } = await authClient.changeEmail({
											callbackURL: "/settings?tab=security",
											newEmail,
										});
										return { error: error?.message ?? null };
									}}
								/>
								{/* Carte mot de passe réservée aux comptes qui en ont un : sur un
								    compte purement OAuth, l'endpoint répond `CREDENTIAL_ACCOUNT_NOT_FOUND`. */}
								{hasPassword ? (
									<AccountPasswordCard
										onChangePassword={async ({ currentPassword, newPassword }) => {
											const { error } = await authClient.changePassword({
												currentPassword,
												newPassword,
												// Déconnecte les autres appareils : un mot de passe changé
												// après une compromission doit invalider les sessions volées.
												revokeOtherSessions: true,
											});
											return { error: error?.message ?? null };
										}}
									/>
								) : (
									<AccountTwoFactorCard enabled={twoFactorEnabled} />
								)}
							</div>

							{hasPassword && <AccountTwoFactorCard enabled={twoFactorEnabled} />}

							<AccountSessions
								sessions={sessions}
								onRevoke={async (token) => {
									await authClient.revokeSession({ token });
									reload();
								}}
								onRevokeOthers={async () => {
									// `revokeOtherSessions` et non `revokeSessions` : le second
									// supprime aussi la session courante et déconnecte.
									await authClient.revokeOtherSessions();
									reload();
								}}
							/>

							<AccountDangerZone
								losses={[
									"Ton profil, ta bio et ton avatar.",
									"Tes équipes enregistrées et tes préférences.",
									"Tes commentaires sur les actualités.",
								]}
								onDelete={async () => {
									const { error } = await authClient.deleteUser({ callbackURL: "/" });
									return { error: error?.message ?? null };
								}}
							/>
						</div>
					),
					id: "security",
				},
			]}
		/>
	);
}
