"use client";

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
	type ReactNode,
} from "react";
import type { SessionUserDTO } from "@rosegriffon/achillea-types/domain/user";
import { safeReturnUrl } from "./auth-session";
import { createAchilleaClient } from "./client";

export type AchilleaAuthStatus = "unknown" | "loading" | "authenticated" | "anonymous" | "error";

export interface AchilleaAuthContextType {
	user: SessionUserDTO | null;
	status: AchilleaAuthStatus;
	isLoading: boolean;
	isAuthenticated: boolean;
	login: (returnUrl?: string) => void;
	logout: () => Promise<void>;
	refreshUser: () => Promise<void>;
}

const AchilleaAuthContext = createContext<AchilleaAuthContextType | undefined>(undefined);

export function AchilleaAuthProvider({ children }: { children: ReactNode }) {
	const [user, setUser] = useState<SessionUserDTO | null>(null);
	const [status, setStatus] = useState<AchilleaAuthStatus>("unknown");

	const refreshUser = useCallback(async () => {
		setStatus("loading");
		try {
			const client = createAchilleaClient({ credentials: "include" });
			const res = await client.auth.me();
			if (res.ok && res.value?.id) {
				setUser(res.value);
				setStatus("authenticated");
			} else {
				setUser(null);
				setStatus("anonymous");
			}
		} catch {
			setUser(null);
			setStatus("error");
		}
	}, []);

	useEffect(() => {
		void refreshUser();
	}, [refreshUser]);

	const login = useCallback((returnUrl = "/achillea") => {
		const client = createAchilleaClient();
		// L'API redirige vers cette valeur APRÈS l'OAuth : non validée, elle
		// ouvre une redirection externe derrière un vrai écran Discord.
		// `discordLoginUrl` ne filtre rien — la garde doit être ici.
		const targetUrl = client.auth.discordLoginUrl(safeReturnUrl(returnUrl));
		window.location.assign(targetUrl);
	}, []);

	const logout = useCallback(async () => {
		try {
			const client = createAchilleaClient({ credentials: "include" });
			await client.auth.logout();
		} finally {
			setUser(null);
			setStatus("anonymous");
		}
	}, []);

	const value: AchilleaAuthContextType = {
		user,
		status,
		isLoading: status === "loading" || status === "unknown",
		isAuthenticated: status === "authenticated" && user !== null,
		login,
		logout,
		refreshUser,
	};

	return (
		<AchilleaAuthContext.Provider value={value}>
			{children}
		</AchilleaAuthContext.Provider>
	);
}

export function useAchilleaAuth(): AchilleaAuthContextType {
	const context = useContext(AchilleaAuthContext);
	if (!context) {
		throw new Error("useAchilleaAuth doit être utilisé dans un AchilleaAuthProvider");
	}
	return context;
}
