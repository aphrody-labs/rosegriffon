"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useAchilleaAuth, createAchilleaClient } from "@/lib/achillea";
import { UserAvatar } from "@/components/achillea/UserAvatar";
import type { CastEventDetail } from "@rosegriffon/achillea-types/domain/cast";
import {
	Tv,
	ArrowLeft,
	Calendar,
	Users,
	Loader2,
	Clock,
} from "lucide-react";

export default function CastPlanningPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const resolvedParams = use(params);
	const eventId = resolvedParams.id;

	const [detail, setDetail] = useState<CastEventDetail | null>(null);
	const [loading, setLoading] = useState<boolean>(true);

	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		const client = createAchilleaClient();

		client.casts
			.getEvent(eventId)
			.then((res) => {
				if (cancelled) return;
				if (res.ok && res.value) {
					setDetail(res.value);
				}
			})
			.catch(() => {})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [eventId]);

	return (
		<div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
			{/* Breadcrumb */}
			<div className="space-y-1 border-b border-border pb-6">
				<Link
					href="/achillea/casts"
					className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition mb-2"
				>
					<ArrowLeft className="w-3.5 h-3.5" />
					Retour aux casters
				</Link>
				<div className="flex items-center gap-2">
					<span className="p-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
						<Tv className="w-5 h-5" />
					</span>
					<h1 className="text-3xl font-bold tracking-tight">Planning de Régie</h1>
				</div>
				<p className="text-sm text-muted-foreground">
					Organisation des créneaux de diffusion et répartition des commentateurs.
				</p>
			</div>

			{loading ? (
				<div className="py-20 text-center space-y-3">
					<Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
					<p className="text-sm text-muted-foreground">Chargement du planning...</p>
				</div>
			) : !detail ? (
				<div className="border border-dashed border-border rounded-2xl p-12 text-center text-xs text-muted-foreground">
					Évènement de cast introuvable.
				</div>
			) : (
				<div className="space-y-6">
					<div className="border border-border bg-card rounded-2xl p-6 space-y-2">
						<h2 className="text-xl font-bold">{detail.event.name}</h2>
						<div className="flex items-center gap-4 text-xs text-muted-foreground">
							<span className="flex items-center gap-1">
								<Calendar className="w-3.5 h-3.5" />
								{new Date(detail.event.scheduledAt).toLocaleDateString("fr-FR", {
									weekday: "long",
									day: "numeric",
									month: "long",
									hour: "2-digit",
									minute: "2-digit",
								})}
							</span>
							<span>·</span>
							<span className="flex items-center gap-1">
								<Clock className="w-3.5 h-3.5" />
								{detail.event.duration} minutes
							</span>
						</div>
					</div>

					{/* Slots and Attributions */}
					<div className="border border-border bg-card rounded-2xl overflow-hidden">
						<div className="p-4 border-b border-border bg-muted/20">
							<h3 className="font-bold text-xs uppercase text-muted-foreground">
								Postes attribués
							</h3>
						</div>

						{detail.attributions.length === 0 ? (
							<div className="py-12 text-center text-xs text-muted-foreground">
								Aucun poste attribué pour le moment.
							</div>
						) : (
							<div className="divide-y divide-border/60">
								{detail.attributions.map((att) => (
									<div
										key={att.id}
										className="p-4 flex items-center justify-between gap-4"
									>
										<div>
											<div className="font-semibold text-xs text-foreground">
												Caster ID: {att.userId || "Non assigné"}
											</div>
											<div className="text-[10px] text-muted-foreground">
												Créneau #{att.slotId}
											</div>
										</div>

										<span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
											Assigné
										</span>
									</div>
								))}
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
