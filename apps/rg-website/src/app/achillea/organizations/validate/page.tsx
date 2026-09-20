"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAchilleaAuth, createAchilleaClient } from "@/lib/achillea";
import type { OrganizationDTO } from "@rosegriffon/achillea-types";
import { OrganizationState } from "@rosegriffon/achillea-types/enums/organization";
import {
	Building2,
	ArrowLeft,
	ShieldAlert,
	Loader2,
	ChevronRight,
} from "lucide-react";
import { signalerException } from "@/lib/achillea/signaler";

export default function OrganizationsPendingValidationPage() {
	const { user, isAuthenticated } = useAchilleaAuth();
	const [orgs, setOrgs] = useState<OrganizationDTO[]>([]);
	const [loading, setLoading] = useState<boolean>(true);

	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		const client = createAchilleaClient({ credentials: "include" });

		client.organizations
			.list({ page: 1, pagination: 50, state: OrganizationState.Pending })
			.then((res) => {
				if (cancelled) return;
				if (res.ok && res.value?.data) {
					setOrgs(res.value.data);
				}
			})
			.catch((cause) => {
				signalerException("organizations/validate", cause);
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, []);

	return (
		<div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
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
					<h1 className="text-3xl font-bold tracking-tight">Organisations en Attente de Revue</h1>
				</div>
			</div>

			{loading ? (
				<div className="py-20 text-center space-y-3">
					<Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
					<p className="text-sm text-muted-foreground">Chargement des organisations...</p>
				</div>
			) : orgs.length === 0 ? (
				<div className="border border-dashed border-border rounded-2xl p-12 text-center text-xs text-muted-foreground">
					Aucune organisation en attente de validation.
				</div>
			) : (
				<div className="divide-y divide-border border border-border rounded-2xl bg-card overflow-hidden">
					{orgs.map((org) => (
						<div key={org.id ?? org.name} className="p-4 flex items-center justify-between gap-4">
							<div>
								<div className="font-bold text-sm">{org.name}</div>
								<div className="text-xs text-muted-foreground mt-0.5">{org.description}</div>
							</div>
							<Link
								href={`/achillea/admins/dashboard/organizations/validate/${org.id}`}
								className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition"
							>
								Examiner
								<ChevronRight className="w-3.5 h-3.5" />
							</Link>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
