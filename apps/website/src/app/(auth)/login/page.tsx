"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, CheckCircle } from "@/lib/icons-config";

import {
	DiscordIcon,
	TwitchIcon,
	XIcon,
	YouTubeIcon,
} from "./_components/social-icons";
import { AuthForm } from "./auth-form";

function safeDecode(value: string | null | undefined): string | null {
	if (!value) return null;
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}

const SOCIAL_LINKS = [
	{
		label: "Discord",
		href: "https://discord.gg/8X8eQfBMkt",
		Icon: DiscordIcon,
	},
	{
		label: "Twitch",
		href: "https://twitch.tv/rose_griffontv",
		Icon: TwitchIcon,
	},
	{
		label: "YouTube",
		href: "https://youtube.com/@rosegriffon",
		Icon: YouTubeIcon,
	},
	{ label: "X / Twitter", href: "https://x.com/rosegriffon_fr", Icon: XIcon },
];

function LoginPageContent() {
	const searchParams = useSearchParams();
	const error = searchParams?.get("error");
	const message = safeDecode(searchParams?.get("message"));
	const success = searchParams?.get("success");

	return (
		<main className="flex min-h-svh w-full items-center justify-center bg-linear-to-br from-muted/40 via-background to-muted/40 p-4 pb-24 sm:pb-4">
			<Card className="w-full max-w-5xl overflow-hidden shadow-2xl">
				<div className="grid grid-cols-1 lg:grid-cols-2">
					<div className="flex flex-col justify-center p-6 sm:p-10">
						<CardHeader className="space-y-4 pb-4 text-center">
							<Link
								href="/"
								aria-label="Retour à l'accueil Rose Griffon"
								className="relative mx-auto block size-20 transition-transform hover:scale-105"
							>
								<Image
									src="/RG_Logo_V2.5.webp"
									alt=""
									fill
									sizes="80px"
									className="object-contain drop-shadow-md"
									priority
								/>
							</Link>
							<CardTitle className="text-2xl font-bold">Rose Griffon</CardTitle>
							<CardDescription>
								Connecte-toi avec Discord ou lie ton compte Patreon pour accéder
								à ton espace.
							</CardDescription>
						</CardHeader>

						<CardContent className="space-y-4">
							{error && message && (
								<Alert variant="destructive">
									<AlertCircle className="size-4" aria-hidden="true" />
									<AlertDescription>{message}</AlertDescription>
								</Alert>
							)}
							{success && message && (
								<Alert className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
									<CheckCircle className="size-4" aria-hidden="true" />
									<AlertDescription>{message}</AlertDescription>
								</Alert>
							)}

							<AuthForm />

							<div className="space-y-3 pt-4">
								<div className="flex items-center gap-3">
									<Separator className="flex-1" />
									<span className="text-xs text-muted-foreground">
										Suis Rose Griffon
									</span>
									<Separator className="flex-1" />
								</div>
								<div className="flex items-center justify-center gap-2">
									{SOCIAL_LINKS.map(({ label, href, Icon }) => (
										<Button
											key={label}
											variant="outline"
											size="icon"
											asChild
											className="size-10 rounded-full"
										>
											<a
												href={href}
												target="_blank"
												rel="noopener noreferrer"
												aria-label={label}
											>
												<Icon size={16} />
											</a>
										</Button>
									))}
								</div>
							</div>

							<p className="pt-2 text-center text-xs text-muted-foreground">
								Pas de mot de passe — connexion 100 % OAuth.
							</p>
						</CardContent>
					</div>

					<aside
						aria-label="Présentation Rose Griffon"
						className="relative hidden flex-col items-center justify-center overflow-hidden border-l border-border/50 bg-linear-to-br from-primary/8 via-primary/3 to-transparent p-10 lg:flex"
					>
						<div
							className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(161,75,63,0.18),transparent_60%)]"
							aria-hidden="true"
						/>

						<div className="relative z-10 max-w-sm space-y-6 text-center">
							<div className="relative mx-auto size-64">
								<div
									className="absolute inset-0 animate-pulse rounded-full bg-primary/15 opacity-60 blur-3xl"
									aria-hidden="true"
								/>
								<Image
									src="/avatarRG/tutoRouge.webp"
									alt="Avatar Rose Griffon"
									fill
									sizes="256px"
									className="object-contain drop-shadow-2xl"
								/>
							</div>

							<div className="space-y-3">
								<h2 className="text-2xl font-bold tracking-tight">
									Personnalise ton identité
								</h2>
								<p className="text-sm leading-relaxed text-muted-foreground">
									Rejoins la communauté et utilise notre générateur d'avatar
									exclusif pour créer ta photo de profil officielle.
								</p>
							</div>

							<Button asChild variant="outline" size="lg">
								<Link href="/projets/outils/pfp">Essayer le générateur</Link>
							</Button>
						</div>
					</aside>
				</div>
			</Card>
		</main>
	);
}

function LoginFallback() {
	return (
		<div className="flex min-h-svh w-full items-center justify-center p-4">
			<Card className="w-full max-w-md shadow-lg">
				<CardHeader className="text-center">
					<Skeleton className="mx-auto mb-3 size-20 rounded-full" />
					<Skeleton className="mx-auto mb-2 h-7 w-2/3" />
					<Skeleton className="mx-auto h-4 w-3/4" />
				</CardHeader>
				<CardContent>
					<Skeleton className="h-48 w-full" />
				</CardContent>
			</Card>
		</div>
	);
}

export default function LoginPage() {
	return (
		<Suspense fallback={<LoginFallback />}>
			<LoginPageContent />
		</Suspense>
	);
}
