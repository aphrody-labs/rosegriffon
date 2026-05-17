"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { useAuth } from "@/contexts/auth-context";
import { useProfileSync, useUpdateProfile } from "@/hooks/use-profile-sync";
import type { Database } from "@/types/supabase";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface ProfileContextType {
  profile: Profile | null;
  isLoading: boolean;
  error: string | null;
  updateProfile: (
    updates: Partial<Profile>
  ) => Promise<{ data: Profile | null; error: Error | null }>;
  refreshProfile: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

/**
 * Provider du profil utilisateur avec synchronisation en temps réel
 * Écoute les changements broadcast du profil
 */
export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const { updateProfile: updateProfileAPI } = useUpdateProfile();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Récupérer le profil initial
  const fetchProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();

      const { data, error: fetchError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (fetchError) {
        console.error("[ProfileProvider] Erreur lors de la récupération:", fetchError);
        setError(fetchError.message);
        setProfile(null);
        return;
      }

      setProfile(data);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Erreur inconnue";
      console.error("[ProfileProvider] Erreur inattendue:", err);
      setError(errorMessage);
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Charger le profil au montage et quand l'utilisateur change
  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Écouter les changements broadcast du profil
  useProfileSync({
    userId: user?.id,
    onProfileChange: (updatedProfile) => {
      console.warn("[ProfileProvider] Profil mis à jour via broadcast:", updatedProfile);
      setProfile(updatedProfile);
      setError(null);
    },
    enabled: !!user?.id,
  });

  // Wrapper pour updateProfile avec gestion de l'état
  const handleUpdateProfile = useCallback(
    async (updates: Partial<Profile>) => {
      if (!user?.id) {
        return {
          data: null,
          error: new Error("Utilisateur non connecté"),
        };
      }

      try {
        setError(null);
        const result = await updateProfileAPI(user.id, updates);

        if (result.error) {
          setError(result.error.message);
        } else if (result.data) {
          // La mise à jour sera automatiquement synchronisée via le broadcast
          // mais on peut aussi la mettre à jour immédiatement
          setProfile(result.data);
        }

        return result;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Erreur inconnue";
        setError(errorMessage);
        return { data: null, error: new Error(errorMessage) };
      }
    },
    [user?.id, updateProfileAPI]
  );

  const value: ProfileContextType = {
    profile,
    isLoading: authLoading || isLoading,
    error,
    updateProfile: handleUpdateProfile,
    refreshProfile: fetchProfile,
  };

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

/**
 * Hook pour accéder au contexte du profil
 */
export function useProfile(): ProfileContextType {
  const context = useContext(ProfileContext);

  if (context === undefined) {
    throw new Error("useProfile doit être utilisé dans un ProfileProvider");
  }

  return context;
}
