"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo } from "react";

import { createClient } from "@/lib/supabase/client";
import type { Database } from "@rosegriffon/db";

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
  // Memoize the Supabase client so it doesn't change between renders
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    // Ne pas s'abonner si pas d'userId ou si désactivé
    if (!userId || !enabled) {
      return;
    }

    let channel: RealtimeChannel | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let isUnmounted = false;

    const subscribeToProfileChanges = async () => {
      try {
        // Nettoyer le canal existant si présent
        if (channel) {
          await supabase.removeChannel(channel);
          channel = null;
        }

        // S'abonner aux changements de profil de l'utilisateur
        channel = supabase
          .channel(`profile:${userId}`, {
            config: {
              broadcast: { self: true },
              presence: { key: userId },
            },
          })
          .on(
            "postgres_changes",
            {
              event: "*", // Écouter INSERT, UPDATE, DELETE
              schema: "public",
              table: "profiles",
              filter: `id=eq.${userId}`,
            },
            (payload) => {
              if (process.env.NODE_ENV === "development") {
              }

              // Appeler le callback si fourni
              if (payload.new && onProfileChange) {
                onProfileChange(payload.new as Profile);
              }

              // Gérer la suppression du profil
              if (payload.eventType === "DELETE" && onProfileChange) {
                console.warn("[useProfileSync] Le profil a été supprimé");
                // Optionnellement, appeler le callback avec null ou une valeur par défaut
              }
            }
          )
          .subscribe((status, err) => {
            if (process.env.NODE_ENV === "development") {
            }

            switch (status) {
              case "SUBSCRIBED":
                if (process.env.NODE_ENV === "development") {
                }
                break;

              case "CHANNEL_ERROR":
                // Ne pas logger en warning pour éviter le spam console si c'est juste un token expiré
                // Le listener onAuthStateChange gérera la reconnexion proprement
                if (process.env.NODE_ENV === "development") {
                  console.warn("[useProfileSync] ⚠️ Erreur du canal (connexion perdue):", err);
                }

                // On laisse le auth listener gérer le refresh token,
                // mais on garde un retry basique au cas où
                if (!isUnmounted) {
                  reconnectTimeout = setTimeout(() => {
                    subscribeToProfileChanges();
                  }, 5000);
                }
                break;

              case "TIMED_OUT":
                console.warn("[useProfileSync] ⏱️ Timeout de connexion");
                // Réessayer après 2 secondes si pas démonté
                if (!isUnmounted) {
                  reconnectTimeout = setTimeout(() => {
                    subscribeToProfileChanges();
                  }, 2000);
                }
                break;

              case "CLOSED":
                if (process.env.NODE_ENV === "development") {
                }
                break;

              default:
                // Gérer les autres statuts ou erreurs
                if (err) {
                  console.error("[useProfileSync] ❌ Erreur:", err);
                  if (!isUnmounted) {
                    reconnectTimeout = setTimeout(() => {
                      subscribeToProfileChanges();
                    }, 5000);
                  }
                }
                break;
            }
          });
      } catch (error) {
        console.error("[useProfileSync] Erreur lors de la souscription:", error);
        // Réessayer après 5 secondes en cas d'erreur
        if (!isUnmounted) {
          reconnectTimeout = setTimeout(() => {
            subscribeToProfileChanges();
          }, 5000);
        }
      }
    };

    subscribeToProfileChanges();

    // Cleanup
    return () => {
      isUnmounted = true;

      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }

      if (channel) {
        supabase.removeChannel(channel).catch((err) => {
          console.error("[useProfileSync] Erreur lors du nettoyage:", err);
        });
      }
    };
  }, [userId, enabled, onProfileChange, supabase]);
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
        }

        // Le trigger DB enverra automatiquement la mise à jour à tous les abonnés
        // via l'événement broadcast
        return { data, error: null };
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Erreur inconnue");
        console.error("[useUpdateProfile] Erreur inattendue:", error);
        return { data: null, error };
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
    if (!userId) return null;

    try {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();

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
