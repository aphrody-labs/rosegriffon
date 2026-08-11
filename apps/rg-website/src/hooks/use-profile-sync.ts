"use client";

import { useCallback, useEffect, useMemo } from "react";

import { subscribeTable } from "@/lib/realtime";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@rose-griffon/db";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

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
	// Memoize the Supabase client to avoid recreating it on each render
	const supabase = useMemo(() => createClient(), []);

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

				const { data, error } = await supabase
					.from("profiles")
					.update(updates)
					.eq("id", userId)
					.select()
					.single();

				if (error) {
					console.error("[useUpdateProfile] Erreur Supabase:", error);
					return { data: null, error };
				}

				if (process.env.NODE_ENV === "development") {
					console.info(`[useUpdateProfile] ✅ Profil ${userId} mis à jour`);
				}

				// Le trigger DB enverra automatiquement la mise à jour à tous les abonnés
				// Via l'événement broadcast
				return { data, error: null };
			} catch (error) {
				const normalizedError = error instanceof Error ? error : new Error("Erreur inconnue");
				console.error("[useUpdateProfile] Erreur inattendue:", normalizedError);
				return { data: null, error: normalizedError };
			}
		},
		[supabase]
	);

	return { updateProfile };
}

/**
 * Hook combiné pour lire et synchroniser le profil
 */
export function useProfile(userId?: string | null) {
	// Memoize the Supabase client to keep a stable reference
	const supabase = useMemo(() => createClient(), []);
	const { updateProfile } = useUpdateProfile();

	const fetchProfile = useCallback(async () => {
		if (!userId) {
			return null;
		}

		try {
			const { data, error } = await supabase.from("profiles").select("id, updated_at, username, avatar_url, role, website, discord_id, bio, banner_url, twitter_handle, badges").eq("id", userId).single();

			if (error) {
				console.error("[useProfile] Erreur lors de la récupération:", error);
				return null;
			}

			return data;
		} catch (error) {
			console.error("[useProfile] Erreur inattendue:", error);
			return null;
		}
	}, [userId, supabase]);

	return {
		fetchProfile,
		updateProfile,
	};
}
