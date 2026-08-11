"use client";

import { Button, DiscordIcon, GoogleIcon, PatreonIcon } from "@rose-griffon/ui";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { authClient } from "@/lib/auth-client";


type Provider = "discord" | "google" | "patreon";

function safeRedirect(raw: string | null | undefined): string {
	if (!raw) {
		return "/dashboard";
	}
	if (!raw.startsWith("/") || raw.startsWith("//")) {
		return "/dashboard";
	}
	return raw;
}

export function AuthForm() {
	const searchParams = useSearchParams();
	const redirectTo = safeRedirect(searchParams?.get("redirect"));
	const [loadingProvider, setLoadingProvider] = useState<Provider | null>(null);
	const [error, setError] = useState<string | null>(null);

	const signIn = async (provider: Provider) => {
		setLoadingProvider(provider);
		setError(null);
		try {
			const res = await authClient.signIn.social({ callbackURL: redirectTo, provider });
			const err = (res as { error?: { message?: string } | null })?.error;
			if (err) {
				setError(err.message ?? `Erreur lors de la connexion ${provider}.`);
				setLoadingProvider(null);
			}
		} catch (error) {
			console.error(`[auth-form] signIn ${provider}`, error);
			setError(`Erreur lors de la connexion ${provider}. Réessaie.`);
			setLoadingProvider(null);
		}
	};

	const isLoading = loadingProvider !== null;

	return (
		<div className="flex w-full flex-col gap-3">
			{error && (
				<div
					role="alert"
					className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-center text-sm text-destructive"
				>
					{error}
				</div>
			)}

			<Button
				type="button"
				size="lg"
				onClick={() => signIn("discord")}
				disabled={isLoading}
				className="h-12 w-full gap-3 bg-discord font-semibold text-rg-sur-marine shadow-md hover:bg-discord/90"
			>
				{loadingProvider === "discord" ? (
					<Loader2 className="size-5 animate-spin" aria-hidden="true" />
				) : (
					<DiscordIcon className="size-5" />
				)}
				{loadingProvider === "discord" ? "Connexion en cours…" : "Se connecter avec Discord"}
			</Button>

			<Button
				type="button"
				size="lg"
				variant="outline"
				onClick={() => signIn("google")}
				disabled={isLoading}
				className="h-12 w-full gap-3 border-border bg-card font-semibold text-foreground shadow-md hover:bg-muted"
			>
				{loadingProvider === "google" ? (
					<Loader2 className="size-5 animate-spin" aria-hidden="true" />
				) : (
					<GoogleIcon className="size-5" />
				)}
				{loadingProvider === "google" ? "Connexion en cours…" : "Se connecter avec Google"}
			</Button>

			<Button
				type="button"
				size="lg"
				onClick={() => signIn("patreon")}
				disabled={isLoading}
				className="h-12 w-full gap-3 bg-patreon font-semibold text-rg-sur-marine shadow-md hover:bg-patreon/90"
			>
				{loadingProvider === "patreon" ? (
					<Loader2 className="size-5 animate-spin" aria-hidden="true" />
				) : (
					<PatreonIcon className="size-5" />
				)}
				{loadingProvider === "patreon" ? "Redirection…" : "Lier mon compte Patreon"}
			</Button>

			<p className="pt-1 text-center text-xs text-muted-foreground">
				En te connectant, tu acceptes nos{" "}
				<Link href="/legal/cgu" className="underline hover:text-foreground">
					conditions d&apos;utilisation
				</Link>
				.
			</p>
		</div>
	);
}
