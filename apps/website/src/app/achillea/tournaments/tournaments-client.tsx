"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { createAchilleaClient } from "@/lib/achillea";
import { TournamentTable } from "@/components/achillea/TournamentTable";
import type { Tournament } from "@rosegriffon/achillea-types";
import { TournamentState } from "@rosegriffon/achillea-types/enums/eventEnums";
import {
	Trophy,
	Plus,
	Search,
	Layers,
	Calendar,
	Activity,
	CheckCircle2,
	Clock,
} from "lucide-react";
import { signalerException } from "@/lib/achillea/signaler";

export default function TournamentsListPage() {
	const [tournaments, setTournaments] = useState<Tournament[]>([]);
	const [loading, setLoading] = useState<boolean>(true);
	const [searchQuery, setSearchQuery] = useState<string>("");
	const [selectedTab, setSelectedTab] = useState<"all" | "open" | "ongoing" | "finished">("all");

	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		const client = createAchilleaClient();

		client.tournaments
			.list()
			.then((res) => {
				if (cancelled) return;
				if (res.ok && res.value) {
					const list = Array.isArray(res.value) ? res.value : (res.value as any).data ?? [];
					setTournaments(list);
				}
			})
			.catch((cause) => {
				signalerException("tournaments", cause);
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, []);

	const filteredTournaments = useMemo(() => {
		return tournaments.filter((t) => {
			// Tab filtering
			if (selectedTab === "open" && t.internalState !== TournamentState.PREREGISTERING) return false;
			if (selectedTab === "ongoing" && t.internalState !== TournamentState.ONGOING) return false;
			if (selectedTab === "finished" && t.internalState !== TournamentState.FINISHED) return false;

			// Search query
			if (searchQuery.trim()) {
				const q = searchQuery.toLowerCase();
				const matchesName = t.name.toLowerCase().includes(q);
				const matchesOrg = t.organization?.name?.toLowerCase().includes(q);
				if (!matchesName && !matchesOrg) return false;
			}

			return true;
		});
	}, [tournaments, selectedTab, searchQuery]);

	return (
		<div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
			{/* Top Header */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
				<div className="space-y-1">
					<div className="flex items-center gap-2">
						<span className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
							<Trophy className="w-5 h-5" />
						</span>
						<h1 className="text-3xl font-bold tracking-tight">Tournois Officiels & Communautaires</h1>
					</div>
					<p className="text-sm text-muted-foreground">
						Participez aux tournois Inazuma Eleven: Victory Road, gagnez des cashprizes en AP et qualifiez-vous pour le Circuit Achilléa.
					</p>
				</div>

				<div className="flex items-center gap-2">
					<Link
						href="/achillea/tournaments/circuit/ranking"
						className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border border-border bg-card hover:bg-muted transition"
					>
						<Layers className="w-3.5 h-3.5 text-blue-400" />
						Circuit & Classement
					</Link>
					<Link
						href="/achillea/tournaments/create"
						className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-sm"
					>
						<Plus className="w-4 h-4" />
						Créer un tournoi
					</Link>
				</div>
			</div>

			{/* Filters & Tabs */}
			<div className="flex flex-col sm:flex-row items-center justify-between gap-4">
				{/* Status tabs */}
				<div className="flex items-center p-1 bg-muted rounded-xl self-start sm:self-auto overflow-x-auto max-w-full">
					<button
						type="button"
						onClick={() => setSelectedTab("all")}
						className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
							selectedTab === "all"
								? "bg-card text-foreground shadow-sm"
								: "text-muted-foreground hover:text-foreground"
						}`}
					>
						Tous ({tournaments.length})
					</button>
					<button
						type="button"
						onClick={() => setSelectedTab("open")}
						className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
							selectedTab === "open"
								? "bg-card text-foreground shadow-sm"
								: "text-muted-foreground hover:text-foreground"
						}`}
					>
						<Clock className="w-3 h-3 text-emerald-400" />
						Inscriptions ouvertes
					</button>
					<button
						type="button"
						onClick={() => setSelectedTab("ongoing")}
						className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
							selectedTab === "ongoing"
								? "bg-card text-foreground shadow-sm"
								: "text-muted-foreground hover:text-foreground"
						}`}
					>
						<Activity className="w-3 h-3 text-amber-400" />
						En cours
					</button>
					<button
						type="button"
						onClick={() => setSelectedTab("finished")}
						className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
							selectedTab === "finished"
								? "bg-card text-foreground shadow-sm"
								: "text-muted-foreground hover:text-foreground"
						}`}
					>
						<CheckCircle2 className="w-3 h-3 text-blue-400" />
						Terminés
					</button>
				</div>

				{/* Search bar */}
				<div className="relative w-full sm:w-72">
					<Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
					<input
						type="text"
						placeholder="Rechercher un tournoi..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="w-full pl-9 pr-3 py-2 text-xs bg-card border border-border rounded-xl placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
					/>
				</div>
			</div>

			{/* Tournaments Table */}
			<TournamentTable tournaments={filteredTournaments} loading={loading} />
		</div>
	);
}
