"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAchilleaAuth } from "@/lib/achillea";
import {
	Card,
	CardHeader,
	CardTitle,
	CardDescription,
	CardContent,
	Button,
} from "@rosegriffon/ui";
import { ArrowLeft, Loader2, Shield } from "lucide-react";
import { FaDiscord } from "react-icons/fa6";

export default function AchilleaAuthPage() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const { user, status, isAuthenticated, login } = useAchilleaAuth();

	const rawReturn = searchParams.get("returnUrl");
	// Sanitize return url to prevent open redirect
	const returnUrl = rawReturn && rawReturn.startsWith("/") ? rawReturn : null;

	useEffect(() => {
		if (isAuthenticated && user?.id) {
			const target = returnUrl || `/achillea/users/${encodeURIComponent(user.id)}`;
			router.replace(target);
		}
	}, [isAuthenticated, user, returnUrl, router]);

	const handleLogin = () => {
		login(returnUrl || "/achillea");
	};

	return (
		<div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
			<Card className="max-w-md w-full border-border/60 shadow-lg">
				<CardHeader className="text-center space-y-2 pb-4">
					<div className="size-12 rounded-full bg-[#5865F2]/10 text-[#5865F2] flex items-center justify-center mx-auto mb-2">
						<Shield className="size-6" />
					</div>
					<CardTitle className="text-2xl font-bold">Connexion Achilléa</CardTitle>
					<CardDescription className="text-sm text-muted-foreground">
						Connecte-toi avec ton compte Discord pour participer aux tournois, gérer ton clan et
						accumuler des points classés (AP).
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4 pt-2">
					{status === "loading" ? (
						<div className="flex flex-col items-center justify-center py-6 space-y-3">
							<Loader2 className="size-8 animate-spin text-primary" />
							<p className="text-xs text-muted-foreground">Vérification de session...</p>
						</div>
					) : (
						<>
							<Button
								onClick={handleLogin}
								className="w-full gap-2.5 bg-[#5865F2] hover:bg-[#4752C4] text-white py-6 text-base font-semibold"
							>
								<FaDiscord className="size-5" />
								Se connecter avec Discord
							</Button>

							<p className="text-[11px] text-center text-muted-foreground px-4">
								En te connectant, ton profil public Achilléa sera synchronisé avec ton identifiant
								Discord officiel.
							</p>

							<div className="pt-2 border-t border-border/40 text-center">
								<Link
									href="/achillea"
									className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition"
								>
									<ArrowLeft className="size-3" />
									Retour à l&apos;accueil Achilléa
								</Link>
							</div>
						</>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
