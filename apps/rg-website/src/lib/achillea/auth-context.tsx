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
	/** Conduit à la connexion Rose Griffon — il n'y a plus de connexion Achilléa. */
	login: (returnUrl?: string) => void;
	logout: () => Promise<void>;
	refreshUser: () => Promise<void>;
}

const AchilleaAuthContext = createContext<AchilleaAuthContextType | undefined>(undefined);

/**
 * Session Achilléa DÉRIVÉE de la session Rose Griffon.
 *
 * UN SEUL COMPTE
 * Ce fournisseur portait sa propre authentification : son bouton « Connexion »,
 * son OAuth Discord, sa déconnexion. Un membre connecté à Rose Griffon depuis
 * dix minutes se voyait donc proposer de se connecter une seconde fois en
 * arrivant sur `/achillea` — au même service, avec le même compte Discord.
 *
 * Il ne décide plus rien : quand une session Rose Griffon existe,
 * `POST /api/achillea/session` échange cette session contre le jeton qu'attend
 * l'API Achilléa, sans écran intermédiaire. Quand elle n'existe pas, il n'y a
 * pas de session e-sport non plus, et `login()` mène au formulaire unique.
 *
 * L'échange n'a lieu QU'UNE FOIS par session : `me()` est retenté après, et son
 * échec (Discord non lié, passerelle non configurée) laisse l'état `anonymous`
 * plutôt que de boucler.
 *
 * Il n'interroge PAS le fournisseur de session Rose Griffon : la passerelle
 * répond déjà `401` quand il n'y en a pas. En dépendre importerait le client
 * Better Auth dans ce module, donc dans tout ce qui passe par le baril
 * `lib/achillea` — y compris des tests purs qui n'ont ni fenêtre ni URL de base.
 */
export function AchilleaAuthProvider({ children }: { children: ReactNode }) {
	const [user, setUser] = useState<SessionUserDTO | null>(null);
	const [status, setStatus] = useState<AchilleaAuthStatus>("unknown");

	const lireSession = useCallback(async (): Promise<boolean> => {
		const client = createAchilleaClient({ credentials: "include" });
		const res = await client.auth.me();
		if (res.ok && res.value?.id) {
			setUser(res.value);
			setStatus("authenticated");
			return true;
		}
		setUser(null);
		setStatus("anonymous");
		return false;
	}, []);

	const refreshUser = useCallback(async () => {
		setStatus("loading");
		try {
			await lireSession();
		} catch {
			setUser(null);
			setStatus("error");
		}
	}, [lireSession]);

	useEffect(() => {
		let annule = false;

		const synchroniser = async () => {
			setStatus("loading");
			try {
				if (await lireSession()) return;
				if (annule) return;

				// Pas de jeton e-sport : on le réclame. La passerelle répond `401`
				// s'il n'y a pas de session Rose Griffon, `409` si aucun compte
				// Discord n'y est lié — deux informations, pas des pannes. L'état
				// reste `anonymous`.
				const reponse = await fetch("/api/achillea/session", { method: "POST" });
				if (!reponse.ok || annule) return;
				await lireSession();
			} catch {
				if (!annule) {
					setUser(null);
					setStatus("error");
				}
			}
		};

		void synchroniser();
		return () => {
			annule = true;
		};
	}, [lireSession]);

	const login = useCallback((returnUrl = "/achillea") => {
		// Une seule porte d'entrée. `safeReturnUrl` reste indispensable : un
		// chemin non validé (`//ailleurs.test`, `/\\ailleurs.test`) transforme le
		// formulaire de connexion en redirection ouverte.
		window.location.assign(`/login?redirect=${encodeURIComponent(safeReturnUrl(returnUrl))}`);
	}, []);

	const logout = useCallback(async () => {
		try {
			await fetch("/api/achillea/session", { method: "DELETE" });
		} finally {
			setUser(null);
			setStatus("anonymous");
			// Un seul compte, une seule déconnexion : fermer la seule session
			// e-sport laisserait le membre connecté partout ailleurs, ce qui est
			// exactement le double état qu'on vient de supprimer. On appelle le
			// point d'entrée HTTP de Better Auth plutôt que sa server action :
			// celle-ci tire `next/headers`, donc tout le baril `lib/achillea`
			// avec elle, jusque dans des tests purs.
			await fetch("/api/auth/sign-out", { method: "POST" });
			window.location.assign("/");
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
		<AchilleaAuthContext.Provider value={value}>{children}</AchilleaAuthContext.Provider>
	);
}

export function useAchilleaAuth(): AchilleaAuthContextType {
	const context = useContext(AchilleaAuthContext);
	if (!context) {
		throw new Error("useAchilleaAuth doit être utilisé dans un AchilleaAuthProvider");
	}
	return context;
}
