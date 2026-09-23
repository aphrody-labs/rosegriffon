"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
	useAchilleaAuth,
	createAchilleaClient,
} from "@/lib/achillea";
import { UserAvatar } from "@/components/achillea/UserAvatar";
import { Sparkline } from "@/components/achillea/Sparkline";
import { type RankedHistoryEntry, MatchMode } from "@rosegriffon/achillea-types";
import {
	History,
	ArrowLeft,
	Loader2,
	TrendingUp,
	TrendingDown,
	Minus,
	ShieldAlert,
	Calendar,
	CheckCircle2,
	XCircle,
	AlertTriangle,
} from "lucide-react";
import { signalerException } from "@/lib/achillea/signaler";

export default function RankedHistoryPage() {
	const { user, isAuthenticated, isLoading: authLoading, login } = useAchilleaAuth();
	const [mode, setMode] = useState<-1 | 2 | 4>(-1); // -1 = all, 2 = 1v1, 4 = 2v2
	const [period, setPeriod] = useState<number>(0); // 0 = all, 7 = 7d, 30 = 30d
	const [history, setHistory] = useState<RankedHistoryEntry[]>([]);
	const [loading, setLoading] = useState<boolean>(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!isAuthenticated) {
			setLoading(false);
			return;
		}

		let cancelled = false;
		setLoading(true);
		setError(null);
		setHistory([]);
		const client = createAchilleaClient();

		const modeQuery = mode === -1 ? undefined : mode;

		client.users
			.myRankedHistory({ mode: modeQuery, limit: 100 })
			.then((res) => {
				if (cancelled) return;
				if (res.ok && res.value) {
					setHistory(res.value);
				} else {
					setError("Impossible de charger votre historique de matchs.");
				}
			})
			.catch((cause) => {
				signalerException("ranked/history", cause);
				if (!cancelled) setError("Impossible de charger votre historique de matchs.");
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [isAuthenticated, mode]);

	// Filter by period
	const filteredHistory = useMemo(() => {
		if (period === 0) return history;
		const cutoff = Date.now() - period * 24 * 3600 * 1000;
		return history.filter((m) => {
			const t = new Date(m.endedAt).getTime();
			return Number.isFinite(t) && t >= cutoff;
		});
	}, [history, period]);

	// Calculate stats
	const stats = useMemo(() => {
		const wins = filteredHistory.filter((m) => m.result === "win").length;
		const losses = filteredHistory.filter((m) => m.result === "loss").length;
		const forfeits = filteredHistory.filter((m) => m.result === "forfeit").length;
		const total = filteredHistory.length;
		const totalDelta = filteredHistory.reduce((acc, m) => acc + (m.eloDelta ?? 0), 0);
		const winrate = total > 0 ? Math.round((wins / total) * 100) : 0;
		return { wins, losses, forfeits, total, totalDelta, winrate };
	}, [filteredHistory]);

	// Sparkline data (in chronological order, so reversed from history DESC)
	const sparklineData = useMemo(() => {
		return [...filteredHistory].reverse().map((m) => m.eloDelta ?? 0);
	}, [filteredHistory]);

	const formatDate = (isoString: string) => {
		try {
			const d = new Date(isoString);
			return new Intl.DateTimeFormat("fr-FR", {
				day: "2-digit",
				month: "short",
				hour: "2-digit",
				minute: "2-digit",
			}).format(d);
		} catch {
			return isoString;
		}
	};

	return (
		<div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
			{/* Header */}
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
						<span className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
							<History className="w-5 h-5" />
						</span>
						<h1 className="text-3xl font-bold tracking-tight">Historique de Matchs</h1>
					</div>
					<p className="text-sm text-muted-foreground">
						Consultez le bilan de vos rencontres classées, vos scores et vos variations d'AP.
					</p>
				</div>

				{/* Filters */}
				<div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
					<div className="flex items-center p-1 bg-muted rounded-lg">
						<button
							type="button"
							onClick={() => setMode(-1)}
							className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
								mode === -1 ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
							}`}
						>
							Tous
						</button>
						<button
							type="button"
							onClick={() => setMode(2)}
							className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
								mode === 2 ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
							}`}
						>
							1v1
						</button>
						<button
							type="button"
							onClick={() => setMode(4)}
							className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
								mode === 4 ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
							}`}
						>
							2v2
						</button>
					</div>

					<div className="flex items-center p-1 bg-muted rounded-lg">
						<button
							type="button"
							onClick={() => setPeriod(7)}
							className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
								period === 7 ? "bg-secondary text-secondary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
							}`}
						>
							7 jours
						</button>
						<button
							type="button"
							onClick={() => setPeriod(30)}
							className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
								period === 30 ? "bg-secondary text-secondary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
							}`}
						>
							30 jours
						</button>
						<button
							type="button"
							onClick={() => setPeriod(0)}
							className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
								period === 0 ? "bg-secondary text-secondary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
							}`}
						>
							Tout
						</button>
					</div>
				</div>
			</div>

			{/*
			 * `isLoading` avant `!isAuthenticated` : pendant l'aller-retour
			 * `GET /auth/me`, `isAuthenticated` vaut false et le mur s'affichait à
			 * un joueur pourtant connecté.
			 */}
			{authLoading ? (
				<div className="py-20 text-center text-sm text-muted-foreground">
					Vérification de la session…
				</div>
			) : !isAuthenticated ? (
				<div className="p-8 border border-border bg-card rounded-2xl text-center space-y-4">
					<ShieldAlert className="w-12 h-12 text-amber-400 mx-auto opacity-80" />
					<h2 className="text-xl font-bold">Connexion requise</h2>
					<p className="text-sm text-muted-foreground max-w-md mx-auto">
						Connectez-vous pour consulter votre historique personnel de matchs classés.
					</p>
					<button
						type="button"
						onClick={() => login()}
						className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition shadow-sm"
					>
						Se connecter
					</button>
				</div>
			) : loading ? (
				<div className="py-20 text-center space-y-3">
					<Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
					<p className="text-sm text-muted-foreground">Chargement de votre historique...</p>
				</div>
			) : error ? (
				<div role="alert" className="border border-rose-500/30 rounded-2xl p-8 text-center text-sm text-rose-400">{error}</div>
			) : (
				<>
					{/* Performance summary card */}
					<div className="border border-border bg-card rounded-2xl p-6 shadow-sm space-y-4">
						<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
							<div className="space-y-1">
								<h3 className="font-bold text-sm">Bilan de la période</h3>
								<div className="text-xs text-muted-foreground">
									{stats.total} match{stats.total > 1 ? "s" : ""} enregistré{stats.total > 1 ? "s" : ""}
								</div>
							</div>

							<div className="flex items-center gap-2">
								<span className="text-xs text-muted-foreground">Bilan AP :</span>
								<span
									className={`px-2.5 py-0.5 rounded-full font-mono font-bold text-xs ${
										stats.totalDelta > 0
											? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
											: stats.totalDelta < 0
											? "bg-rose-500/10 text-rose-400 border border-rose-500/30"
											: "bg-muted text-muted-foreground"
									}`}
								>
									{stats.totalDelta > 0 ? `+${stats.totalDelta}` : stats.totalDelta} AP
								</span>
							</div>
						</div>

						<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
							<div className="p-3 rounded-xl bg-background/60 border border-border">
								<div className="text-muted-foreground">Victoires</div>
								<div className="text-lg font-bold text-emerald-400">{stats.wins}</div>
							</div>
							<div className="p-3 rounded-xl bg-background/60 border border-border">
								<div className="text-muted-foreground">Défaites</div>
								<div className="text-lg font-bold text-rose-400">{stats.losses}</div>
							</div>
							<div className="p-3 rounded-xl bg-background/60 border border-border">
								<div className="text-muted-foreground">Forfaits</div>
								<div className="text-lg font-bold text-amber-400">{stats.forfeits}</div>
							</div>
							<div className="p-3 rounded-xl bg-background/60 border border-border">
								<div className="text-muted-foreground">Winrate</div>
								<div className="text-lg font-bold">{stats.winrate}%</div>
							</div>
						</div>

						{sparklineData.length > 1 && (
							<div className="pt-2 flex items-center justify-between border-t border-border/50 text-xs text-muted-foreground">
								<span>Évolution des deltas récents</span>
								<Sparkline data={sparklineData} width={180} height={32} />
							</div>
						)}
					</div>

					{/* History list */}
					{filteredHistory.length === 0 ? (
						<div className="border border-dashed border-border rounded-2xl p-12 text-center text-muted-foreground text-sm space-y-2">
							<Calendar className="w-8 h-8 mx-auto opacity-50 mb-2" />
							<p className="font-semibold">Aucun match joué sur cette période.</p>
							<p className="text-xs">
								Lancez une recherche classée depuis le hub pour commencer à marquer des points !
							</p>
						</div>
					) : (
						<div className="space-y-3">
							{filteredHistory.map((match) => {
								const isWin = match.result === "win";
								const isForfeit = match.result === "forfeit";
								const delta = match.eloDelta ?? 0;

								return (
									<div
										key={match.lobbyId}
										className="border border-border bg-card rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition hover:bg-muted/20"
									>
										{/* Status badge & Date */}
										<div className="flex items-center gap-3">
											{isWin ? (
												<div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
													<CheckCircle2 className="w-5 h-5" />
												</div>
											) : isForfeit ? (
												<div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
													<AlertTriangle className="w-5 h-5" />
												</div>
											) : (
												<div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
													<XCircle className="w-5 h-5" />
												</div>
											)}

											<div>
												<div className="flex items-center gap-2">
													<span
														className={`text-xs font-bold uppercase ${
															isWin
																? "text-emerald-400"
																: isForfeit
																? "text-amber-400"
																: "text-rose-400"
														}`}
													>
														{isWin ? "Victoire" : isForfeit ? "Forfait" : "Défaite"}
													</span>
													<span className="px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground font-mono">
														{match.mode === MatchMode.ONE_VS_ONE ? "1v1" : "2v2"}
													</span>
												</div>
												<div className="text-[11px] text-muted-foreground mt-0.5">
													{formatDate(match.endedAt)}
												</div>
											</div>
										</div>

										{/* Opponent & Score */}
										<div className="flex items-center justify-between sm:justify-end gap-6 flex-1">
											<div className="flex items-center gap-2">
												<span className="text-xs text-muted-foreground hidden sm:inline">vs</span>
												<Link
													href={`/achillea/users/${match.opponent.userId}`}
													className="flex items-center gap-2 text-xs font-semibold hover:text-primary transition"
												>
													<UserAvatar
														avatar={match.opponent.avatar}
														displayName={match.opponent.displayName}
														className="w-6 h-6"
													/>
													<span className="truncate max-w-[120px]">{match.opponent.displayName}</span>
												</Link>
											</div>

											{/* Score */}
											<div className="font-mono font-bold text-sm bg-background border border-border px-3 py-1 rounded-lg">
												{match.myScore} - {match.opponentScore}
											</div>

											{/* Delta AP */}
											<div
												className={`w-20 text-right font-mono font-bold text-sm ${
													delta > 0
														? "text-emerald-400"
														: delta < 0
														? "text-rose-400"
														: "text-muted-foreground"
												}`}
											>
												{delta > 0 ? `+${delta}` : delta} AP
											</div>
										</div>
									</div>
								);
							})}
						</div>
					)}
				</>
			)}
		</div>
	);
}
