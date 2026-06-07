import {
	Avatar,
	AvatarFallback,
	AvatarImage,
	Badge,
	Button,
	Card,
	CardContent,
} from "@rose-griffon/ui";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
	IEVR_STEAM_APP_ID,
	SteamWebApiClient,
	type SteamIevrAccount,
	type SteamPlayerAchievement,
} from "@rose-griffon/better-auth-steam";

import { requireAuth } from "@/lib/auth-helpers";

import { SteamConnectButton } from "./steam-connect-button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	description:
		"Lie ton compte Steam pour voir ta progression sur Inazuma Eleven Victory Road (temps de jeu, succès).",
	title: "Mon compte Steam | Azalée",
};

/**
 * Page « Mon compte Steam » scopée Inazuma Eleven Victory Road (app 2799860).
 *
 * - Non connecté → /login.
 * - Connecté sans Steam lié → bouton « Se connecter avec Steam » (login OpenID 2.0).
 * - Connecté avec Steam lié → profil + possession/temps de jeu IEVR + succès, via Steam Web API.
 * - STEAM_WEB_API_KEY absente → message de configuration (pas de crash).
 */
export default async function SteamAccountPage() {
	const user = await requireAuth();
	if (!user) {
		redirect("/login?returnTo=/compte/steam");
	}

	const steamId = (user as { steamId?: string | null }).steamId ?? null;

	// Pas de compte Steam lié → proposer la connexion.
	if (!steamId) {
		return (
			<main className="mx-auto w-full max-w-2xl px-4 py-10">
				<BackLink />
				<h1 className="mb-2 text-2xl font-bold text-on-surface">Mon compte Steam</h1>
				<p className="mb-6 text-on-surface-variant">
					Lie ton compte Steam pour voir ta progression sur Inazuma Eleven Victory Road
					(temps de jeu, succès).
				</p>
				<SteamConnectButton callbackURL="/compte/steam" />
			</main>
		);
	}

	const apiKey = process.env.STEAM_WEB_API_KEY;
	let account: SteamIevrAccount | null = null;
	let apiError: string | null = null;

	if (apiKey) {
		try {
			const client = new SteamWebApiClient({ apiKey, appId: IEVR_STEAM_APP_ID });
			account = await client.getIevrAccount(steamId, "french");
		} catch (e) {
			apiError = e instanceof Error ? e.message : "Erreur Steam Web API";
		}
	}

	return (
		<main className="mx-auto w-full max-w-3xl px-4 py-10">
			<BackLink />
			<h1 className="mb-6 text-2xl font-bold text-on-surface">Mon compte Steam</h1>

			{!apiKey && (
				<Card className="mb-6">
					<CardContent className="py-4 text-sm text-on-surface-variant">
						La clé <code>STEAM_WEB_API_KEY</code> n&apos;est pas configurée : seul
						l&apos;identifiant Steam est disponible.
						<div className="mt-2 font-mono text-xs">SteamID64 : {steamId}</div>
					</CardContent>
				</Card>
			)}

			{apiError && (
				<Card className="mb-6 border-error/50">
					<CardContent className="py-4 text-sm text-error">
						Impossible de joindre la Steam Web API : {apiError}
					</CardContent>
				</Card>
			)}

			{account?.summary && (
				<Card className="mb-6">
					<CardContent className="flex items-center gap-4 py-4">
						<Avatar className="size-16">
							<AvatarImage src={account.summary.avatarfull} alt={account.summary.personaname} />
							<AvatarFallback>{account.summary.personaname.slice(0, 2)}</AvatarFallback>
						</Avatar>
						<div>
							<div className="text-lg font-semibold text-on-surface">
								{account.summary.personaname}
							</div>
							<Link
								href={account.summary.profileurl}
								target="_blank"
								rel="noopener noreferrer"
								className="text-sm text-primary underline"
							>
								Profil Steam
							</Link>
							<div className="mt-1 font-mono text-xs text-on-surface-variant">{steamId}</div>
						</div>
					</CardContent>
				</Card>
			)}

			<Card className="mb-6">
				<CardContent className="py-4">
					<h2 className="mb-3 text-lg font-semibold text-on-surface">
						Inazuma Eleven Victory Road
					</h2>
					{account?.ievr ? (
						<div className="space-y-1 text-sm text-on-surface">
							<div className="flex items-center gap-2">
								{account.ievr.img_icon_url && (
									<Image
										src={`https://cdn.cloudflare.steamstatic.com/steam/apps/${IEVR_STEAM_APP_ID}/${account.ievr.img_icon_url}.jpg`}
										alt="IEVR"
										width={32}
										height={32}
										className="rounded"
										unoptimized
									/>
								)}
								<Badge>Jeu possédé</Badge>
							</div>
							<div>
								Temps de jeu : <strong>{formatPlaytime(account.ievr.playtime_forever)}</strong>
							</div>
							{account.ievr.playtime_2weeks ? (
								<div>
									2 dernières semaines : {formatPlaytime(account.ievr.playtime_2weeks)}
								</div>
							) : null}
						</div>
					) : (
						<p className="text-sm text-on-surface-variant">
							{apiKey
								? "Jeu non détecté sur ce compte (non possédé ou profil Steam privé)."
								: "Possession indisponible sans clé Web API."}
						</p>
					)}
				</CardContent>
			</Card>

			{account?.ievr && (
				<Card>
					<CardContent className="py-4">
						<h2 className="mb-3 text-lg font-semibold text-on-surface">Succès</h2>
						<p className="mb-3 text-sm text-on-surface">
							<strong>{account.achievementsUnlocked}</strong> / {account.achievementsTotal}{" "}
							débloqués
						</p>
						{account.achievementsTotal === 0 ? (
							<p className="text-sm text-on-surface-variant">
								Aucun succès disponible (profil privé ou jeu sans succès).
							</p>
						) : (
							<ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
								{account.achievements.slice(0, 50).map((a: SteamPlayerAchievement) => (
									<li
										key={a.apiname}
										className={`text-sm ${a.achieved ? "text-on-surface" : "text-on-surface-variant line-through"}`}
									>
										{a.achieved ? "✓ " : "○ "}
										{a.name ?? a.apiname}
									</li>
								))}
							</ul>
						)}
					</CardContent>
				</Card>
			)}
		</main>
	);
}

function BackLink() {
	return (
		<Button asChild variant="ghost" size="sm" className="mb-4">
			<Link href="/settings">
				<ArrowLeft className="mr-1 size-4" /> Retour aux paramètres
			</Link>
		</Button>
	);
}

/** Formate des minutes Steam en « Xh Ymin ». */
function formatPlaytime(minutes: number): string {
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	if (h === 0) {
		return `${m} min`;
	}
	return `${h} h ${m.toString().padStart(2, "0")}`;
}
