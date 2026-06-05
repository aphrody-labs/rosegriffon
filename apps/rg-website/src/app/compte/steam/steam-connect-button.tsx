"use client";

import { Button } from "@rose-griffon/ui";

import { authClient } from "@/lib/auth-client";

/**
 * Bouton « Se connecter avec Steam ».
 * Déclenche `authClient.signIn.steam()` (exposé par le plugin client
 * @rose-griffon/better-auth-steam), qui redirige le navigateur vers l'endpoint
 * serveur `/api/auth/sign-in/steam` → Steam OpenID 2.0.
 */
export function SteamConnectButton({ callbackURL }: { callbackURL?: string }) {
	return (
		<Button
			onClick={() => authClient.signIn.steam({ callbackURL })}
			className="bg-[#171a21] text-white hover:bg-[#2a475e]"
		>
			Se connecter avec Steam
		</Button>
	);
}
