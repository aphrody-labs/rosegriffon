"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAchilleaAuth, createAchilleaClient } from "@/lib/achillea";
import type { OrganizationDTO } from "@rosegriffon/achillea-types";
import {
	Building2,
	ArrowLeft,
	ShieldAlert,
	Loader2,
	Check,
	X,
	CheckCircle2,
	XCircle,
} from "lucide-react";

export default function OrganizationValidationPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const resolvedParams = use(params);
	const orgId = resolvedParams.id;

	const router = useRouter();
	const { user, isAuthenticated } = useAchilleaAuth();

	const [org, setOrg] = useState<OrganizationDTO | null>(null);
	const [loading, setLoading] = useState<boolean>(true);
	const [actionRunning, setActionRunning] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		const client = createAchilleaClient({ credentials: "include" });

		client.organizations
			.get(orgId)
			.then((res) => {
				if (cancelled) return;
				if (res.ok && res.value?.data) {
					setOrg(res.value.data);
				} else {
					setError("Organisation introuvable.");
				}
			})
			.catch(() => {
				if (!cancelled) setError("Erreur de communication.");
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [orgId]);

	const handleApprove = async () => {
		setActionRunning(true);
		const client = createAchilleaClient({ credentials: "include" });
		try {
			const res = await client.organizations.approve(orgId);
			if (res.ok) {
				router.push("/achillea/admins/dashboard");
			} else {
				setError(res.detail || "Action non autorisée.");
			}
		} finally {
			setActionRunning(false);
		}
	};

	const handleReject = async () => {
		setActionRunning(true);
		const client = createAchilleaClient({ credentials: "include" });
		try {
			const res = await client.organizations.reject(orgId);
			if (res.ok) {
				router.push("/achillea/admins/dashboard");
			} else {
				setError(res.detail || "Action non autorisée.");
			}
		} finally {
			setActionRunning(false);
		}
	};

	if (loading) {
		return (
			<div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-3">
				<Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
				<p className="text-sm text-muted-foreground">Chargement des données de l'organisation...</p>
			</div>
		);
	}

	return (
		<div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
			{/* Breadcrumb */}
			<div className="space-y-1 border-b border-border pb-6">
				<Link
					href="/achillea/admins/dashboard"
					className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition mb-2"
				>
					<ArrowLeft className="w-3.5 h-3.5" />
					Retour au dashboard admin
				</Link>
				<div className="flex items-center gap-2">
					<span className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
						<Building2 className="w-5 h-5" />
					</span>
					<h1 className="text-3xl font-bold tracking-tight">Validation d'Organisation</h1>
				</div>
				<p className="text-sm text-muted-foreground">
					Vérification de la conformité et arbitrage de la demande de création de structure esport.
				</p>
			</div>

			{error && (
				<div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold">
					{error}
				</div>
			)}

			{org && (
				<div className="border border-border bg-card rounded-2xl p-6 md:p-8 space-y-6">
					<div className="space-y-4">
						<div className="p-4 rounded-xl bg-background/80 border border-border space-y-2">
							<div className="flex items-center justify-between">
								<h2 className="text-xl font-bold">{org.name}</h2>
								<span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-muted text-muted-foreground">
									{org.origin?.name || org.origin?.code || "FR"}
								</span>
							</div>
							<p className="text-xs text-muted-foreground leading-relaxed">
								{org.description}
							</p>
						</div>

						<div className="grid grid-cols-2 gap-3 text-xs">
							<div className="p-3 rounded-xl bg-background border border-border">
								<div className="text-muted-foreground">Propriétaire</div>
								<div className="font-bold mt-0.5">{org.owner?.username || "Inconnu"}</div>
							</div>
							<div className="p-3 rounded-xl bg-background border border-border">
								<div className="text-muted-foreground">Identifiant</div>
								<div className="font-bold font-mono mt-0.5">{orgId}</div>
							</div>
						</div>
					</div>

					<div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
						<button
							type="button"
							onClick={handleReject}
							disabled={actionRunning}
							className="inline-flex items-center gap-1.5 px-4 py-2 border border-destructive/40 text-destructive hover:bg-destructive/10 rounded-xl text-xs font-semibold transition"
						>
							<X className="w-4 h-4" />
							Rejeter la demande
						</button>
						<button
							type="button"
							onClick={handleApprove}
							disabled={actionRunning}
							className="inline-flex items-center gap-1.5 px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-sm"
						>
							{actionRunning ? (
								<Loader2 className="w-4 h-4 animate-spin" />
							) : (
								<Check className="w-4 h-4" />
							)}
							Approuver et valider
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
