"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { authClient } from "@/lib/auth-client";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@rose-griffon/db";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type AuthUser = typeof authClient.$Infer.Session.user;

interface UseSidebarAuthReturn {
  user: AuthUser | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
}

export function useSidebarAuth(): UseSidebarAuthReturn {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const _router = useRouter();

  const { data: session, isPending: sessionPending } = authClient.useSession();
  const user = session?.user ?? null;

  const {
    data: profile,
    isLoading: profileLoading,
    error: profileError,
  } = useQuery({
    enabled: !!user?.id,
    gcTime: 1000 * 60 * 60 * 24,
    queryFn: async () => {
      if (!user?.id) return null;
      // 3 stratégies de bridge (Better Auth user.id ≠ profiles.id legacy Supabase) :
      // 1. direct id match  2. Discord account_id  3. email
      const direct = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (direct.data) return direct.data;

      const account = await supabase
        .from("account")
        .select("account_id")
        .eq("user_id", user.id)
        .eq("provider_id", "discord")
        .maybeSingle();
      const discordId = (account.data as { account_id?: string } | null)?.account_id;
      if (discordId) {
        const viaDiscord = await supabase
          .from("profiles")
          .select("*")
          .eq("discord_id", discordId)
          .maybeSingle();
        if (viaDiscord.data) return viaDiscord.data;
      }

      if (user.email) {
        const viaEmail = await supabase
          .from("profiles")
          .select("*")
          .eq("email", user.email)
          .maybeSingle();
        if (viaEmail.data) return viaEmail.data;
      }
      return null;
    },
    queryKey: ["auth", "profile", user?.id],
    retry: 1,
    staleTime: 1000 * 60 * 15,
  });

  // Synchroniser le router quand la session change
  useEffect(() => {
    if (!sessionPending) {
      queryClient.invalidateQueries({ queryKey: ["auth"] });
    }
  }, [sessionPending, queryClient]);

  return {
    error: profileError ? (profileError as Error).message : null,
    loading: sessionPending || (!!user && profileLoading),
    profile: profile ?? null,
    user,
  };
}
