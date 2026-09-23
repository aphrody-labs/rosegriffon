"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
	createAchilleaClient,
} from "@/lib/achillea";
import type { LeaderboardPage, RankedTierInfo } from "@rosegriffon/achillea-types";
import { UserAvatar } from "@/components/achillea/UserAvatar";
import {
	Trophy,
	Search,
	Loader2,
	ChevronLeft,
	ChevronRight,
	Swords,
	ArrowLeft,
} from "lucide-react";
import { signalerException } from "@/lib/achillea/signaler";

export default function RankedLeaderboardPage({
	initialData,
	initialTiers,
}: {
	initialData?: LeaderboardPage | null;
	initialTiers?: RankedTierInfo[] | null;
}) {
	const [mode, setMode] = useState<2 | 4>(2);
	const [page, setPage] = useState<number>(0);
	const pageSize = 25;
	const [data, setData] = useState<LeaderboardPage | null>(initialData ?? null);
	const [tiers, setTiers] = useState<RankedTierInfo[] | null>(initialTiers ?? null);
	const [loading, setLoading] = useState<boolean>(initialData == null);
	const [searchQuery, setSearchQuery] = useState<string>("");
	const [search, setSearch] = useState<string>("");
	const [error, setError] = useState<string | null>(null);
	useEffect(() => {
		const timer = setTimeout(() => { setSearch(searchQuery.trim()); setPage(0); }, 300);
		return () => clearTimeout(timer);
	}, [searchQuery]);

	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		setError(null);
		const client = createAchilleaClient();
		Promise.all([client.ranked.leaderboard({ mode, page, pageSize, search }), client.ranked.tiers(mode)])
			.then(([board, tierResult]) => {
				if (cancelled) return;
				if (!board.ok) { setError("Le classement est momentanément indisponible."); return; }
				setData(board.value);
				if (tierResult.ok) setTiers(tierResult.value);
			})
			.catch((cause) => { signalerException("ranked/leaderboard", cause); if (!cancelled) setError("Le classement est momentanément indisponible."); })
			.finally(() => { if (!cancelled) setLoading(false); });

		return () => {
			cancelled = true;
		};
	}, [mode, page, search]);

	const entries = data?.entries ?? [];
	const total = data?.total ?? 0;
	const totalPages = Math.ceil(total / pageSize) || 1;

	const filteredEntries = entries;

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
				) : error ? (
					<div role="alert" className="py-16 text-center text-rose-400 text-sm">{error}</div>
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
								{filteredEntries.map((entry) => {
								const actualRank = entry.rank;
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
												{tiers?.find((tier) => entry.elo >= tier.minElo && entry.elo <= tier.maxElo)?.key ?? "—"}
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
