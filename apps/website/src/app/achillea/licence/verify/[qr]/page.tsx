"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { createAchilleaClient } from "@/lib/achillea";
import { UserAvatar } from "@/components/achillea/UserAvatar";
import type { LicenseVerifyResult } from "@rosegriffon/achillea-types/domain/license";
import {
	ShieldCheck,
	ShieldAlert,
	ArrowLeft,
	Loader2,
	CheckCircle2,
	XCircle,
	Calendar,
	IdCard,
} from "lucide-react";

export default function LicenseVerifyPage({
	params,
}: {
	params: Promise<{ qr: string }>;
}) {
	const resolvedParams = use(params);
	const qrSecret = resolvedParams.qr;

	const [result, setResult] = useState<LicenseVerifyResult | null>(null);
	const [loading, setLoading] = useState<boolean>(true);

	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		const client = createAchilleaClient();

		client.licenses
			.verify(qrSecret)
			.then((res) => {
				if (cancelled) return;
				if (res.ok && res.value) {
					setResult(res.value);
				} else {
					setResult({ valid: false, reason: "not_found" });
				}
			})
			.catch(() => {
				if (!cancelled) setResult({ valid: false, reason: "not_found" });
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [qrSecret]);

	return (
		<div className="max-w-md mx-auto px-4 py-16 space-y-6">
			<div className="space-y-1 text-center">
				<Link
					href="/achillea"
					className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition mb-4"
				>
					<ArrowLeft className="w-3.5 h-3.5" />
					Accueil Achilléa
				</Link>
				<h1 className="text-2xl font-black">Vérification de Licence</h1>
				<p className="text-xs text-muted-foreground">
					Contrôle officiel d'authenticité de licence compétiteur Achilléa.
				</p>
			</div>

			{loading ? (
				<div className="py-12 text-center space-y-3">
					<Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
					<p className="text-xs text-muted-foreground">Vérification de l'empreinte de sécurité...</p>
				</div>
			) : !result || !result.valid ? (
				<div className="border border-destructive/30 bg-destructive/5 rounded-3xl p-8 text-center space-y-4">
					<XCircle className="w-14 h-14 text-rose-500 mx-auto" />
					<div className="space-y-1">
						<h2 className="text-xl font-bold text-rose-400">Licence Invalide ou Introuvable</h2>
						<p className="text-xs text-muted-foreground">
							{result?.reason === "expired"
								? "Cette licence a expiré. Le joueur doit renouveler son adhésion."
								: result?.reason === "revoked"
								? "Cette licence a été révoquée par l'arbitrage officiel."
								: "Ce QR code ne correspond à aucune licence valide sur le réseau Achilléa."}
						</p>
					</div>
				</div>
			) : (
				<div className="border-2 border-emerald-500/40 bg-gradient-to-b from-emerald-500/10 via-card to-card rounded-3xl p-8 text-center space-y-6 shadow-xl">
					<div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500/40 flex items-center justify-center text-emerald-400 mx-auto">
						<CheckCircle2 className="w-8 h-8" />
					</div>

					<div className="space-y-1">
						<span className="px-3 py-0.5 rounded-full text-xs font-black bg-emerald-500 text-black uppercase tracking-wider">
							Licence Homologuée
						</span>
						<h2 className="text-2xl font-black pt-2">{result.holder?.displayName}</h2>
						<div className="font-mono text-xs text-muted-foreground font-semibold">
							N° {result.licenseNumber}
						</div>
					</div>

					{result.holder && (
						<UserAvatar
							avatar={result.holder.avatar}
							displayName={result.holder.displayName}
							className="w-20 h-20 mx-auto ring-4 ring-emerald-500/30 shadow-lg"
						/>
					)}

					<div className="p-4 rounded-xl bg-background/80 border border-border text-xs space-y-2 text-left">
						<div className="flex items-center justify-between">
							<span className="text-muted-foreground">Statut d'éligibilité :</span>
							<span className="font-bold text-emerald-400">Autorisé en compétition</span>
						</div>
						{result.validUntil && (
							<div className="flex items-center justify-between">
								<span className="text-muted-foreground">Date limite :</span>
								<span className="font-mono font-medium">
									{new Date(result.validUntil).toLocaleDateString("fr-FR")}
								</span>
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
