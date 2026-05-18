"use client";

import { createClient } from "@supabase/supabase-js";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Database } from "@rosegriffon/db";

type SupabaseClient = ReturnType<typeof createClient<Database>>;

const SupabaseContext = createContext<SupabaseClient | null>(null);

/**
 * Provides a Supabase client to all child components.
 * When an initialToken is provided (minted server-side from Better Auth session),
 * the client uses it for authenticated requests (RLS).
 * Periodically refreshes the token from /api/supabase-token.
 */
export function SupabaseProvider({
  children,
  initialToken,
}: {
  children: ReactNode;
  initialToken?: string | null;
}) {
  const [token, setToken] = useState(initialToken || null);
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Refresh the Supabase JWT every 50 minutes (token lasts 1h)
  useEffect(() => {
    const refresh = async () => {
      try {
        const res = await fetch("/api/supabase-token");
        if (res.ok) {
          const data = await res.json();
          if (data.token) {
            setToken(data.token);
          }
        }
      } catch {
        // Silent fail
      }
    };

    // Only refresh if we have a token (user is authenticated)
    if (token) {
      refreshTimer.current = setInterval(refresh, 50 * 60 * 1000);
    }

    return () => {
      if (refreshTimer.current) clearInterval(refreshTimer.current);
    };
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const client = useMemo(() => {
    const opts: Parameters<typeof createClient>[2] = token
      ? {
          global: {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        }
      : undefined;

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith("http")
        ? process.env.NEXT_PUBLIC_SUPABASE_URL
        : "https://isbkaeltubqittywibeh.supabase.co";

    const supabaseAnonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== "" &&
      !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.startsWith("{")
        ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        : "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzYmthZWx0dWJxaXR0eXdpYmVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwNjk0MzAsImV4cCI6MjA2MTY0NTQzMH0.N4l07k3V_X5I8iW0n_D6K9-O4v5l7l6s6MYGpJIXRW_rB8zc45k7chqi8Ljl_CLiLc=";

    return createClient<Database>(supabaseUrl, supabaseAnonKey, opts);
  }, [token]);

  return <SupabaseContext.Provider value={client}>{children}</SupabaseContext.Provider>;
}

export function useSupabaseClient(): SupabaseClient {
  const client = useContext(SupabaseContext);
  if (!client) {
    throw new Error("useSupabaseClient must be used within a SupabaseProvider");
  }
  return client;
}
