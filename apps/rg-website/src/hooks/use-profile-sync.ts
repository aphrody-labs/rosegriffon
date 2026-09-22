"use client";

import { useCallback, useEffect } from "react";

import { subscribeTable } from "@/lib/realtime";
import { getCurrentPublicProfile, updatePublicProfile } from "@/app/settings/actions";
import type { PublicProfile } from "@rosegriffon/db/profiles";

type Profile = PublicProfile;

interface UseProfileSyncOptions {
	userId?: string | null;
	onProfileChange?: (profile: Profile) => void;
	enabled?: boolean;
}

/**
 * Hook pour synchroniser les changements de profil en temps réel
 * Écoute les événements INSERT, UPDATE, DELETE du table profiles
 */
export function useProfileSync({ userId, onProfileChange, enabled = true }: UseProfileSyncOptions) {
	useEffect(() => {
		// Ne pas s'abonner si pas d'userId ou si désactivé
		if (!userId || !enabled) return;

		// Le flux SSE de rg-realtime gère lui-même la reconnexion (EventSource) :
		// plus de machinerie de retry ni de statuts de canal à surveiller.
		return subscribeTable<Profile>({ filter: `id=eq.${userId}`, table: "profiles" }, (event) => {
			if (process.env.NODE_ENV === "development") {
				console.info("[useProfileSync] Changement reçu:", event.eventType);
			}

			if (event.eventType === "DELETE") {
				console.warn("[useProfileSync] Le profil a été supprimé");
				return;
			}

			if (event.new && onProfileChange) {
				onProfileChange(event.new);
			}
		});
	}, [userId, enabled, onProfileChange]);
}

/**
 * Hook pour mettre à jour le profil avec gestion d'erreurs
 */
export function useUpdateProfile() {
	const updateProfile = useCallback(
		async (
			userId: string,
			updates: Partial<Profile>
		): Promise<{ data: Profile | null; error: Error | null }> => {
			try {
				if (!userId) {
					return {
						data: null,
						error: new Error("userId est requis"),
					};
				}

				if (process.env.NODE_ENV === "development") {
					console.info(`[useUpdateProfile] Mise à jour du profil ${userId}`, updates);
				}

				const result = await updatePublicProfile(updates);
				if (result.error) return result;

				if (process.env.NODE_ENV === "development") {
					console.info(`[useUpdateProfile] ✅ Profil ${userId} mis à jour`);
				}

				// Le trigger DB enverra automatiquement la mise à jour à tous les abonnés
				// Via l'événement broadcast
				return result;
			} catch (error) {
				const normalizedError = error instanceof Error ? error : new Error("Erreur inconnue");
				console.error("[useUpdateProfile] Erreur inattendue:", normalizedError);
				return { data: null, error: normalizedError };
			}
		},
		[]
	);

	return { updateProfile };
}

/**
 * Hook combiné pour lire et synchroniser le profil
 */
export function useProfile(userId?: string | null) {
	const { updateProfile } = useUpdateProfile();

	const fetchProfile = useCallback(async () => {
		if (!userId) {
			return null;
		}

		try {
			return await getCurrentPublicProfile();
		} catch (error) {
			console.error("[useProfile] Erreur inattendue:", error);
			return null;
		}
	}, [userId]);

	return {
		fetchProfile,
		updateProfile,
	};
}
