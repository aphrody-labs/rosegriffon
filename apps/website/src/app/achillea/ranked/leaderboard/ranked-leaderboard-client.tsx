"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import {
	createAchilleaClient,
	eloToRankKey,
	rankImagePath,
	winRatePercent,
} from "@/lib/achillea";
import { UserAvatar } from "@/components/achillea/UserAvatar";
import type { LeaderboardEntry, LeaderboardPage } from "@rosegriffon/achillea-types";
import {
	Trophy,
	Medal,
	Crown,
	Search,
	Loader2,
	ChevronLeft,
	ChevronRight,
	Swords,
	ArrowLeft,
} from "lucide-react";
import { signalerException } from "@/lib/achillea/signaler";

export default function RankedLeaderboardPage() {
	const [mode, setMode] = useState<2 | 4>(2);
	const [page, setPage] = useState<number>(0);
	const pageSize = 25;
	const [data, setData] = useState<LeaderboardPage | null>(null);
	const [loading, setLoading] = useState<boolean>(true);
	const [searchQuery, setSearchQuery] = useState<string>("");

	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		const client = createAchilleaClient();

		client.ranked
			.leaderboard({ mode, page, pageSize })
			.then((res) => {
				if (cancelled) return;
				if (res.ok) {
					setData(res.value);
				}
			})
			.catch((cause) => {
				signalerException("ranked/leaderboard", cause);
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [mode, page]);

	const entries = data?.entries ?? [];
	const total = data?.total ?? 0;
	const totalPages = Math.ceil(total / pageSize) || 1;

	// Top 3 for podium
	const top3 = useMemo(() => {
		if (page !== 0) return [];
		return entries.slice(0, 3);
	}, [entries, page]);

	// Filtered list by player name search
	const filteredEntries = useMemo(() => {
		if (!searchQuery.trim()) return entries;
		const q = searchQuery.toLowerCase();
		return entries.filter((e) => e.displayName.toLowerCase().includes(q));
	}, [entries, searchQuery]);

	return (
		<div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
			{/* Breadcrumb / Top Bar */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
				<div className="space-y-1">
					<Link
						href="/achillea/ranked"
						className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition mb-1"
					>
						<ArrowLeft className="w-3.5 h-3.5" />
						Retour au hub classé
					</Link>
					<div className="flex items-center gap-2">
						<span className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
							<Trophy className="w-5 h-5" />
						</span>
						<h1 className="text-3xl font-bold tracking-tight">Classement Général (Leaderboard)</h1>
					</div>
					<p className="text-sm text-muted-foreground">
						Les meilleurs joueurs classés de la saison active sur Inazuma Eleven: Victory Road.
					</p>
				</div>

				{/* Mode switch */}
				<div className="flex items-center p-1 bg-muted rounded-lg self-start sm:self-auto">
					<button
						type="button"
						onClick={() => {
							setMode(2);
							setPage(0);
						}}
						className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${
							mode === 2
								? "bg-primary text-primary-foreground shadow-sm"
								: "text-muted-foreground hover:text-foreground"
						}`}
					>
						1 contre 1 (Solo)
					</button>
					<button
						type="button"
						onClick={() => {
							setMode(4);
							setPage(0);
						}}
						className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${
							mode === 4
								? "bg-primary text-primary-foreground shadow-sm"
								: "text-muted-foreground hover:text-foreground"
						}`}
					>
						2 contre 2 (Duo)
					</button>
				</div>
			</div>

			{/* Top 3 Podium (Only on page 0) */}
			{page === 0 && top3.length > 0 && !searchQuery && (
				<div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 pb-2 items-end">
					{/* 2nd place */}
					{top3[1] && (
						<div className="order-2 sm:order-1 border border-slate-700/60 bg-gradient-to-b from-slate-800/40 to-card rounded-2xl p-5 text-center space-y-3 relative shadow-md">
							<span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-bold bg-slate-300 text-black shadow">
								#2 Argent
							</span>
							<div className="pt-2">
								<UserAvatar
									avatar={top3[1].avatar}
									displayName={top3[1].displayName}
									className="w-16 h-16 mx-auto ring-2 ring-slate-300"
								/>
							</div>
							<div>
								<Link
									href={`/achillea/users/${top3[1].userId}`}
									className="font-bold text-sm hover:text-primary transition"
								>
									{top3[1].displayName}
								</Link>
								<div className="text-xl font-extrabold text-slate-300 mt-1">{top3[1].elo} AP</div>
								<div className="text-[11px] text-muted-foreground mt-0.5">
									{top3[1].gamesPlayed} matchs · Pic {top3[1].peakRating} AP
								</div>
							</div>
						</div>
					)}

					{/* 1st place (Hero podium) */}
					{top3[0] && (
						<div className="order-1 sm:order-2 border-2 border-amber-500/80 bg-gradient-to-b from-amber-500/10 via-card to-card rounded-2xl p-6 text-center space-y-3 relative shadow-xl sm:-translate-y-2">
							<div className="absolute -top-4 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3.5 py-1 rounded-full text-xs font-bold bg-amber-400 text-black shadow-lg">
								<Crown className="w-3.5 h-3.5 fill-black" />
								#1 Champion
							</div>
							<div className="pt-2">
								<UserAvatar
									avatar={top3[0].avatar}
									displayName={top3[0].displayName}
									className="w-20 h-20 mx-auto ring-4 ring-amber-400 shadow-amber-500/20"
								/>
							</div>
							<div>
								<Link
									href={`/achillea/users/${top3[0].userId}`}
									className="font-bold text-base hover:text-amber-400 transition"
								>
									{top3[0].displayName}
								</Link>
								<div className="text-2xl font-black text-amber-400 mt-1">{top3[0].elo} AP</div>
								<div className="text-xs text-muted-foreground mt-0.5">
									{top3[0].gamesPlayed} matchs · Pic {top3[0].peakRating} AP
								</div>
							</div>
						</div>
					)}

					{/* 3rd place */}
					{top3[2] && (
						<div className="order-3 border border-amber-800/60 bg-gradient-to-b from-amber-950/20 to-card rounded-2xl p-5 text-center space-y-3 relative shadow-md">
							<span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-bold bg-amber-700 text-amber-100 shadow">
								#3 Bronze
							</span>
							<div className="pt-2">
								<UserAvatar
									avatar={top3[2].avatar}
									displayName={top3[2].displayName}
									className="w-16 h-16 mx-auto ring-2 ring-amber-700"
								/>
							</div>
							<div>
								<Link
									href={`/achillea/users/${top3[2].userId}`}
									className="font-bold text-sm hover:text-primary transition"
								>
									{top3[2].displayName}
								</Link>
								<div className="text-xl font-extrabold text-amber-600 mt-1">{top3[2].elo} AP</div>
								<div className="text-[11px] text-muted-foreground mt-0.5">
									{top3[2].gamesPlayed} matchs · Pic {top3[2].peakRating} AP
								</div>
							</div>
						</div>
					)}
				</div>
			)}

			{/* Search filter and counts */}
			<div className="flex flex-col sm:flex-row items-center justify-between gap-4">
				<div className="relative w-full sm:w-72">
					<Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
					<input
						type="text"
						placeholder="Rechercher un joueur..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="w-full pl-9 pr-3 py-2 text-xs bg-card border border-border rounded-lg placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
					/>
				</div>

				<div className="text-xs text-muted-foreground self-end sm:self-auto">
					Total : <span className="font-semibold text-foreground">{total}</span> joueurs classés
				</div>
			</div>

			{/* Leaderboard Table */}
			<div className="border border-border rounded-2xl bg-card overflow-hidden shadow-sm">
				{loading ? (
					<div className="py-20 text-center space-y-3">
						<Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
						<p className="text-sm text-muted-foreground">Chargement du classement...</p>
					</div>
				) : filteredEntries.length === 0 ? (
					<div className="py-16 text-center text-muted-foreground text-sm">
						Aucun joueur trouvé.
					</div>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full text-left text-xs">
							<thead>
								<tr className="border-b border-border bg-muted/40 text-muted-foreground uppercase text-[10px] tracking-wider">
									<th className="py-3 px-4 w-16 text-center">Rang</th>
									<th className="py-3 px-4">Joueur</th>
									<th className="py-3 px-4 text-center">Palier</th>
									<th className="py-3 px-4 text-right">Points (AP)</th>
									<th className="py-3 px-4 text-right">Parties</th>
									<th className="py-3 px-4 text-right">Pic</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border/60">
								{filteredEntries.map((entry, idx) => {
									const actualRank = page * pageSize + idx + 1;
									return (
										<tr
											key={entry.userId}
											className="hover:bg-muted/30 transition-colors"
										>
											<td className="py-3 px-4 text-center font-bold">
												{actualRank === 1 ? (
													<span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-400 text-black text-xs font-extrabold">
														1
													</span>
												) : actualRank === 2 ? (
													<span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-300 text-black text-xs font-extrabold">
														2
													</span>
												) : actualRank === 3 ? (
													<span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-700 text-white text-xs font-extrabold">
														3
													</span>
												) : (
													<span className="text-muted-foreground font-mono">#{actualRank}</span>
												)}
											</td>
											<td className="py-3 px-4">
												<Link
													href={`/achillea/users/${entry.userId}`}
													className="inline-flex items-center gap-2.5 font-semibold text-foreground hover:text-primary transition"
												>
													<UserAvatar
														avatar={entry.avatar}
														displayName={entry.displayName}
														className="w-7 h-7"
													/>
													<span>{entry.displayName}</span>
												</Link>
											</td>
											<td className="py-3 px-4 text-center">
												<span className="px-2 py-0.5 rounded-md bg-background border border-border text-[11px] font-medium">
													{entry.elo >= 1500
														? "Légendaire"
														: entry.elo >= 1350
														? "Supernova"
														: entry.elo >= 1200
														? "Divin"
														: entry.elo >= 1050
														? "Rubis"
														: entry.elo >= 900
														? "Émeraude"
														: entry.elo >= 750
														? "Diamant"
														: entry.elo >= 600
														? "Platine"
														: entry.elo >= 450
														? "Or"
														: entry.elo >= 300
														? "Argent"
														: entry.elo >= 150
														? "Bronze"
														: "Fer"}
												</span>
											</td>
											<td className="py-3 px-4 text-right font-bold text-amber-400 font-mono text-sm">
												{entry.elo} AP
											</td>
											<td className="py-3 px-4 text-right text-muted-foreground">
												{entry.gamesPlayed}
											</td>
											<td className="py-3 px-4 text-right text-muted-foreground font-mono">
												{entry.peakRating}
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}

				{/* Pagination */}
				{totalPages > 1 && (
					<div className="flex items-center justify-between p-4 border-t border-border bg-muted/20">
						<button
							type="button"
							onClick={() => setPage((p) => Math.max(0, p - 1))}
							disabled={page === 0 || loading}
							className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-md border border-border bg-card hover:bg-muted disabled:opacity-40 transition"
						>
							<ChevronLeft className="w-3.5 h-3.5" />
							Précédent
						</button>
						<span className="text-xs text-muted-foreground">
							Page <span className="font-semibold text-foreground">{page + 1}</span> sur{" "}
							<span className="font-semibold text-foreground">{totalPages}</span>
						</span>
						<button
							type="button"
							onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
							disabled={page >= totalPages - 1 || loading}
							className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-md border border-border bg-card hover:bg-muted disabled:opacity-40 transition"
						>
							Suivant
							<ChevronRight className="w-3.5 h-3.5" />
						</button>
					</div>
				)}
			</div>
		</div>
	);
}
