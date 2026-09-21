"use client";

import React, { useEffect, useState } from "react";
import { createAchilleaClient } from "@/lib/achillea";
import { UserAvatar } from "./UserAvatar";
import { Trophy, Coins, Loader2 } from "lucide-react";
import type { TournamentSummary } from "@rosegriffon/achillea-types";

interface TournamentTopSummaryProps {
	tournamentId: number;
}

export function TournamentTopSummary({ tournamentId }: TournamentTopSummaryProps) {
	const [summary, setSummary] = useState<TournamentSummary | null>(null);
	const [loading, setLoading] = useState<boolean>(true);

	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		const client = createAchilleaClient();

		client.tournaments
			.summary(tournamentId)
			.then((res) => {
				if (cancelled) return;
				if (res.ok && res.value) {
					setSummary(res.value);
				}
			})
			.catch(() => {})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [tournamentId]);

	if (loading) {
		return (
			<div className="py-8 text-center space-y-2">
				<Loader2 className="w-6 h-6 animate-spin text-amber-400 mx-auto" />
				<p className="text-xs text-muted-foreground">Chargement des classements et du podium…</p>
			</div>
		);
	}

	if (!summary?.top10 || summary.top10.length === 0) return null;

	const top3 = summary.top10.slice(0, 3);
	const rest = summary.top10.slice(3);

	return (
		<div className="space-y-6">
			{/* Podium Section */}
			<div className="border border-border bg-card rounded-3xl p-6 shadow-xs space-y-6">
				<div className="flex items-center gap-2 border-b border-border pb-3">
					<span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
						<Trophy className="w-4 h-4" />
					</span>
					<h3 className="font-bold text-sm uppercase tracking-wider text-foreground">
						Podium Officiel du Tournoi
					</h3>
				</div>

				<div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
					{top3.map((entry, idx) => {
						const isWinner = idx === 0;
						const isSecond = idx === 1;

						const medalBg = isWinner
							? "bg-amber-500/10 border-amber-500/30 text-amber-400"
							: isSecond
								? "bg-slate-400/10 border-slate-400/30 text-slate-300"
								: "bg-amber-700/10 border-amber-700/30 text-amber-600";

						return (
							<div
								key={entry.userId || idx}
								className={`p-5 rounded-2xl border text-center space-y-3 flex flex-col items-center justify-center relative shadow-xs ${medalBg}`}
							>
								<div className="absolute top-3 left-3 font-mono font-black text-lg">
									#{idx + 1}
								</div>

								<UserAvatar
									avatar={entry.avatar}
									displayName={entry.displayName}
									className="w-14 h-14 ring-2 ring-border shadow-md"
								/>

								<div className="space-y-0.5">
									<div className="font-bold text-sm text-foreground truncate max-w-[150px]">
										{entry.displayName}
									</div>
									{entry.clan && (
										<div className="text-xs text-muted-foreground font-semibold">
											[{entry.clan.shortName}] {entry.clan.name}
										</div>
									)}
								</div>

								{entry.points > 0 && (
									<div className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 text-xs font-mono font-bold flex items-center gap-1">
										<Coins className="w-3 h-3" />+{entry.points} AP
									</div>
								)}
							</div>
						);
					})}
				</div>
			</div>

			{/* Rest of Top 10 */}
			{rest.length > 0 && (
				<div className="border border-border bg-card rounded-2xl overflow-hidden shadow-xs">
					<div className="p-4 bg-muted/30 border-b border-border text-xs font-bold uppercase tracking-wider text-muted-foreground">
						Places d&apos;honneur (Top 4 à 10)
					</div>
					<div className="divide-y divide-border/60">
						{rest.map((entry, idx) => (
							<div
								key={entry.userId || idx}
								className="p-3 px-4 flex items-center justify-between text-xs hover:bg-muted/20 transition"
							>
								<div className="flex items-center gap-3">
									<span className="font-mono font-bold text-muted-foreground w-6 text-center">
										#{idx + 4}
									</span>
									<UserAvatar
										avatar={entry.avatar}
										displayName={entry.displayName}
										className="w-7 h-7"
									/>
									<span className="font-semibold text-foreground">{entry.displayName}</span>
									{entry.clan && (
										<span className="text-xs text-muted-foreground">
											[{entry.clan.shortName}]
										</span>
									)}
								</div>

								{entry.points > 0 && (
									<span className="font-mono font-bold text-amber-400">
										+{entry.points} AP
									</span>
								)}
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
