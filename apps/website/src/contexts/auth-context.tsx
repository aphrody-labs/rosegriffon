"use client";

import { createContext, useContext } from "react";

import { authClient } from "@/lib/auth-client";

interface AuthContextType {
  user: typeof authClient.$Infer.Session.user | null;
  isLoading: boolean;
  error: string | null;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session, isPending, error } = authClient.useSession();

  const logout = async () => {
    await authClient.signOut();
  };

  const value: AuthContextType = {
    error: error ? String(error) : null,
    isLoading: isPending,
    logout,
    user: session?.user ?? null,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth doit être utilisé dans un AuthProvider");
  }
  return context;
}

export function useIsAuthenticated(): boolean {
  const { user, isLoading } = useAuth();
  return !isLoading && user !== null;
}

export function useUserId(): string | null {
  const { user } = useAuth();
  return user?.id ?? null;
}
