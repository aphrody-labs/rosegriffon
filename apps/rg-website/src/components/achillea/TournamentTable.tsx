"use client";

import Link from "next/link";
import type { TournamentListItem } from "@rosegriffon/achillea-types/domain/tournament";
import { Badge, Button, Skeleton } from "@rosegriffon/ui";
import { Calendar, ChevronRight, Trophy } from "lucide-react";

interface TournamentTableProps {
	tournaments: TournamentListItem[];
	loading?: boolean;
	className?: string;
}

function statusLabel(status: string | null): string {
	switch (status) {
		case "Open": return "Inscriptions ouvertes";
		case "Ongoing": return "En cours";
		case "Finished": return "Terminé";
		case "Canceled": return "Annulé";
		default: return status || "Statut à confirmer";
	}
}

export function TournamentTable({
	tournaments,
	loading = false,
	className,
}: TournamentTableProps) {
	if (loading) {
		return (
			<div className="space-y-3">
				{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
			</div>
		);
	}

	if (!tournaments.length) {
		return (
			<div className="text-center py-12 border border-dashed border-outline/30 rounded-2xl p-6 text-on-surface-variant">
				<Trophy className="size-10 mx-auto mb-2 opacity-40" />
				<p className="font-semibold">Aucun tournoi trouvé</p>
			</div>
		);
	}

	return (
		<div className={`overflow-x-auto rounded-2xl border border-outline/20 bg-surface ${className ?? ""}`}>
			<table className="w-full text-left text-sm">
				<thead className="bg-surface-variant/40 text-on-surface-variant text-xs uppercase font-bold border-b border-outline/10">
					<tr>
						<th className="px-4 py-3">Tournoi</th>
						<th className="px-4 py-3 hidden md:table-cell">Type</th>
						<th className="px-4 py-3 hidden sm:table-cell">Description</th>
						<th className="px-4 py-3">Publié</th>
						<th className="px-4 py-3 text-center">Statut</th>
						<th className="px-4 py-3 text-right">Action</th>
					</tr>
				</thead>
				<tbody className="divide-y divide-outline/10 text-on-surface">
					{tournaments.map((t) => (
						<tr key={t.id} className="hover:bg-surface-variant/20 transition-colors group">
							<td className="px-4 py-3 font-semibold">
								<Link href={`/achillea/tournaments/${t.id}`} className="flex items-center gap-3 group-hover:text-primary transition-colors">
									<span className="size-9 rounded-lg bg-surface-variant shrink-0 border border-outline/20 flex items-center justify-center text-on-surface-variant">
										<Trophy className="size-4" />
									</span>
									<span className="truncate max-w-[180px] sm:max-w-[240px]">{t.name}</span>
								</Link>
							</td>
							<td className="px-4 py-3 hidden md:table-cell text-on-surface-variant text-xs">
								{t.type === "TOURNAMENT" ? "Tournoi" : t.type}
							</td>
							<td className="px-4 py-3 hidden sm:table-cell text-on-surface-variant text-xs max-w-sm truncate">
								{t.description || "—"}
							</td>
							<td className="px-4 py-3 text-xs text-on-surface-variant whitespace-nowrap">
								<span className="inline-flex items-center gap-1.5"><Calendar className="size-3" />{new Date(t.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>
							</td>
							<td className="px-4 py-3 text-center">
								<Badge variant={t.status === "Finished" || t.status === "Canceled" ? "secondary" : "default"} className="text-[11px] whitespace-nowrap">
									{statusLabel(t.status)}
								</Badge>
							</td>
							<td className="px-4 py-3 text-right">
								<Button asChild variant="ghost" size="sm" className="h-8 px-2 text-xs">
									<Link href={`/achillea/tournaments/${t.id}`}>Détails<ChevronRight className="size-3.5 ml-1" /></Link>
								</Button>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
