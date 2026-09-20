"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createAchilleaClient } from "@/lib/achillea";
import { UserAvatar } from "@/components/achillea/UserAvatar";
import type { CircuitRanking } from "@rosegriffon/achillea-types";
import {
	Trophy,
	ArrowLeft,
	Crown,
	Medal,
	Shield,
	Users,
	Sparkles,
	Loader2,
	Calendar,
	ChevronRight,
} from "lucide-react";

export default function CircuitRankingPage() {
	const [data, setData] = useState<CircuitRanking | null>(null);
	const [loading, setLoading] = useState<boolean>(true);
	const [activeTab, setActiveTab] = useState<"players" | "clans" | "tournaments">("players");

	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		const client = createAchilleaClient();

		client.tournaments
			.circuitRanking()
			.then((res) => {
				if (cancelled) return;
				if (res.ok && res.value) {
					setData(res.value);
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

	const leaderboard = data?.leaderboard ?? [];
	const clanRanking = data?.clanRanking ?? [];
	const tournaments = data?.tournaments ?? [];

	const top3 = leaderboard.slice(0, 3);

	return (
		<div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
			{/* Breadcrumb */}
			<div className="space-y-1 border-b border-border pb-6">
				<Link
					href="/achillea/tournaments"
					className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition mb-2"
				>
					<ArrowLeft className="w-3.5 h-3.5" />
					Retour aux tournois
				</Link>
				<div className="flex items-center gap-2">
					<span className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
						<Trophy className="w-5 h-5" />
					</span>
					<h1 className="text-3xl font-bold tracking-tight">Circuit Achilléa — Classement Officiel</h1>
				</div>
				<p className="text-sm text-muted-foreground">
					Barème de points cumulés sur l'ensemble des tournois homologués de la saison compétitive.
				</p>
			</div>

			{/* Top 3 Podium */}
			{top3.length > 0 && (
				<div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 pb-2 items-end">
					{/* #2 */}
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
								<div className="font-bold text-sm">{top3[1].displayName}</div>
								{top3[1].clan && (
									<span className="text-[11px] text-muted-foreground">[{top3[1].clan.shortName}]</span>
								)}
								<div className="text-xl font-extrabold text-slate-300 mt-1">{top3[1].points} pts</div>
								<div className="text-[11px] text-muted-foreground mt-0.5">
									{top3[1].wins} titre{top3[1].wins > 1 ? "s" : ""} · {top3[1].tournamentsPlayed} tournois
								</div>
							</div>
						</div>
					)}

					{/* #1 Champion */}
					{top3[0] && (
						<div className="order-1 sm:order-2 border-2 border-amber-500/80 bg-gradient-to-b from-amber-500/10 via-card to-card rounded-2xl p-6 text-center space-y-3 relative shadow-xl sm:-translate-y-2">
							<div className="absolute -top-4 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3.5 py-1 rounded-full text-xs font-bold bg-amber-400 text-black shadow-lg">
								<Crown className="w-3.5 h-3.5 fill-black" />
								#1 Leader Circuit
							</div>
							<div className="pt-2">
								<UserAvatar
									avatar={top3[0].avatar}
									displayName={top3[0].displayName}
									className="w-20 h-20 mx-auto ring-4 ring-amber-400 shadow-amber-500/20"
								/>
							</div>
							<div>
								<div className="font-bold text-base hover:text-amber-400 transition">
									{top3[0].displayName}
								</div>
								{top3[0].clan && (
									<span className="text-xs text-muted-foreground">[{top3[0].clan.shortName}]</span>
								)}
								<div className="text-2xl font-black text-amber-400 mt-1">{top3[0].points} pts</div>
								<div className="text-xs text-muted-foreground mt-0.5">
									{top3[0].wins} titre{top3[0].wins > 1 ? "s" : ""} · {top3[0].tournamentsPlayed} tournois
								</div>
							</div>
						</div>
					)}

					{/* #3 */}
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
								<div className="font-bold text-sm">{top3[2].displayName}</div>
								{top3[2].clan && (
									<span className="text-[11px] text-muted-foreground">[{top3[2].clan.shortName}]</span>
								)}
								<div className="text-xl font-extrabold text-amber-600 mt-1">{top3[2].points} pts</div>
								<div className="text-[11px] text-muted-foreground mt-0.5">
									{top3[2].wins} titre{top3[2].wins > 1 ? "s" : ""} · {top3[2].tournamentsPlayed} tournois
								</div>
							</div>
						</div>
					)}
				</div>
			)}

			{/* Tabs */}
			<div className="flex items-center gap-2 border-b border-border pb-px">
				<button
					type="button"
					onClick={() => setActiveTab("players")}
					className={`px-4 py-2 text-xs font-semibold border-b-2 transition -mb-px flex items-center gap-1.5 ${
						activeTab === "players"
							? "border-primary text-foreground"
							: "border-transparent text-muted-foreground hover:text-foreground"
					}`}
				>
					<Users className="w-3.5 h-3.5" />
					Classement Joueurs ({leaderboard.length})
				</button>
				<button
					type="button"
					onClick={() => setActiveTab("clans")}
					className={`px-4 py-2 text-xs font-semibold border-b-2 transition -mb-px flex items-center gap-1.5 ${
						activeTab === "clans"
							? "border-primary text-foreground"
							: "border-transparent text-muted-foreground hover:text-foreground"
					}`}
				>
					<Shield className="w-3.5 h-3.5" />
					Classement Clans ({clanRanking.length})
				</button>
				<button
					type="button"
					onClick={() => setActiveTab("tournaments")}
					className={`px-4 py-2 text-xs font-semibold border-b-2 transition -mb-px flex items-center gap-1.5 ${
						activeTab === "tournaments"
							? "border-primary text-foreground"
							: "border-transparent text-muted-foreground hover:text-foreground"
					}`}
				>
					<Trophy className="w-3.5 h-3.5" />
					Palmarès des Tournois ({tournaments.length})
				</button>
			</div>

			{loading ? (
				<div className="py-20 text-center space-y-3">
					<Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
					<p className="text-sm text-muted-foreground">Chargement du classement du circuit...</p>
				</div>
			) : (
				<>
					{/* Players Tab */}
					{activeTab === "players" && (
						<div className="border border-border rounded-2xl bg-card overflow-hidden">
							<table className="w-full text-left text-xs">
								<thead>
									<tr className="border-b border-border bg-muted/40 text-muted-foreground uppercase text-[10px] tracking-wider">
										<th className="py-3 px-4 w-16 text-center">Rang</th>
										<th className="py-3 px-4">Joueur</th>
										<th className="py-3 px-4 text-center">Clan</th>
										<th className="py-3 px-4 text-right">Points Circuit</th>
										<th className="py-3 px-4 text-right">Titres</th>
										<th className="py-3 px-4 text-right">Tournois</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-border/60">
									{leaderboard.map((player, idx) => (
										<tr key={player.userId} className="hover:bg-muted/30 transition">
											<td className="py-3 px-4 text-center font-bold text-muted-foreground font-mono">
												#{idx + 1}
											</td>
											<td className="py-3 px-4">
												<Link
													href={`/achillea/users/${player.userId}`}
													className="inline-flex items-center gap-2.5 font-semibold text-foreground hover:text-primary transition"
												>
													<UserAvatar
														avatar={player.avatar}
														displayName={player.displayName}
														className="w-7 h-7"
													/>
													<span>{player.displayName}</span>
												</Link>
											</td>
											<td className="py-3 px-4 text-center">
												{player.clan ? (
													<span className="px-2 py-0.5 rounded bg-muted text-[11px] font-mono">
														[{player.clan.shortName}]
													</span>
												) : (
													<span className="text-muted-foreground">-</span>
												)}
											</td>
											<td className="py-3 px-4 text-right font-bold text-amber-400 font-mono text-sm">
												{player.points} pts
											</td>
											<td className="py-3 px-4 text-right font-semibold text-emerald-400">
												{player.wins > 0 ? `🏆 ${player.wins}` : "0"}
											</td>
											<td className="py-3 px-4 text-right text-muted-foreground font-mono">
												{player.tournamentsPlayed}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}

					{/* Clans Tab */}
					{activeTab === "clans" && (
						<div className="border border-border rounded-2xl bg-card overflow-hidden">
							<table className="w-full text-left text-xs">
								<thead>
									<tr className="border-b border-border bg-muted/40 text-muted-foreground uppercase text-[10px] tracking-wider">
										<th className="py-3 px-4 w-16 text-center">Rang</th>
										<th className="py-3 px-4">Clan</th>
										<th className="py-3 px-4 text-right">Points Cumulés</th>
										<th className="py-3 px-4 text-right">Titres</th>
										<th className="py-3 px-4 text-right">Joueurs Actifs</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-border/60">
									{clanRanking.map((clan, idx) => (
										<tr key={clan.id} className="hover:bg-muted/30 transition">
											<td className="py-3 px-4 text-center font-bold text-muted-foreground font-mono">
												#{idx + 1}
											</td>
											<td className="py-3 px-4">
												<Link
													href={`/achillea/clans/${clan.id}`}
													className="font-bold text-foreground hover:text-primary transition"
												>
													{clan.name} [{clan.shortName}]
												</Link>
											</td>
											<td className="py-3 px-4 text-right font-bold text-amber-400 font-mono text-sm">
												{clan.points} pts
											</td>
											<td className="py-3 px-4 text-right font-semibold text-emerald-400">
												{clan.wins > 0 ? `🏆 ${clan.wins}` : "0"}
											</td>
											<td className="py-3 px-4 text-right text-muted-foreground font-mono">
												{clan.players}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}

					{/* Tournaments Palmarès */}
					{activeTab === "tournaments" && (
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							{tournaments.map((t) => (
								<div
									key={t.id}
									className="border border-border bg-card rounded-2xl p-5 space-y-3 transition hover:shadow-md"
								>
									<div className="flex items-center justify-between">
										<h4 className="font-bold text-sm">{t.name}</h4>
										<span className="text-[11px] text-muted-foreground">
											{new Date(t.grandFinalAt).toLocaleDateString("fr-FR")}
										</span>
									</div>

									{/* Podium preview */}
									<div className="space-y-1.5 pt-2 border-t border-border/60 text-xs">
										{t.podium.map((p) => (
											<div key={p.rank} className="flex items-center justify-between text-muted-foreground">
												<span className="font-medium text-foreground">
													{p.rankLabel || (p.rank === 1 ? "🥇 1er" : p.rank === 2 ? "🥈 2e" : "🥉 3e")} : {p.displayName}
												</span>
											</div>
										))}
									</div>

									<Link
										href={`/achillea/tournaments/${t.id}`}
										className="inline-flex items-center gap-1 text-xs text-primary font-semibold hover:underline pt-1"
									>
										Voir le tournoi
										<ChevronRight className="w-3.5 h-3.5" />
									</Link>
								</div>
							))}
						</div>
					)}
				</>
			)}
		</div>
	);
}
