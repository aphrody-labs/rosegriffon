"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createAchilleaClient } from "@/lib/achillea";
import { CastCard } from "@/components/achillea/CastCard";
import type { CasterPublic } from "@rosegriffon/achillea-types/domain/cast";
import {
	Tv,
	ArrowLeft,
	Loader2,
	ExternalLink,
	Sparkles,
} from "lucide-react";
import { FaTwitch } from "react-icons/fa6";

export default function CastsPublicPage() {
	const [casters, setCasters] = useState<CasterPublic[]>([]);
	const [loading, setLoading] = useState<boolean>(true);

	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		const client = createAchilleaClient();

		client.casts
			.listCasters()
			.then((res) => {
				if (cancelled) return;
				if (res.ok && res.value) {
					setCasters(res.value);
				}
			})
			.catch(() => {})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, []);

	return (
		<div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
			{/* Breadcrumb */}
			<div className="space-y-1 border-b border-border pb-6">
				<Link
					href="/achillea"
					className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition mb-2"
				>
					<ArrowLeft className="w-3.5 h-3.5" />
					Retour au hub Achilléa
				</Link>
				<div className="flex items-center justify-between gap-4">
					<div className="flex items-center gap-2">
						<span className="p-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
							<Tv className="w-5 h-5" />
						</span>
						<h1 className="text-3xl font-bold tracking-tight">Casters & Régie Officiels</h1>
					</div>

					<a
						href="https://twitch.tv/rosegriffon"
						target="_blank"
						rel="noreferrer"
						className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition shadow-sm"
					>
						<FaTwitch className="w-4 h-4" />
						Chaîne Officielle
					</a>
				</div>
				<p className="text-sm text-muted-foreground">
					Découvrez l'équipe de commentateurs et streamers officiels d'Achilléa sur Inazuma Eleven: Victory Road.
				</p>
			</div>

			{loading ? (
				<div className="py-20 text-center space-y-3">
					<Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
					<p className="text-sm text-muted-foreground">Chargement des casters...</p>
				</div>
			) : casters.length === 0 ? (
				<div className="border border-dashed border-border rounded-2xl p-12 text-center text-xs text-muted-foreground">
					Aucun caster répertorié pour le moment.
				</div>
			) : (
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
					{casters.map((caster) => (
						<CastCard key={caster.id} caster={caster} />
					))}
				</div>
			)}
		</div>
	);
}
