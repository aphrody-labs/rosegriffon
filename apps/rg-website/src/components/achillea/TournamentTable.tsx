"use client";

import Link from "next/link";
import Image from "next/image";
import type { Tournament } from "@rosegriffon/achillea-types";
import {
	stageTypeLabel,
	tournamentStateLabel,
	tournamentStateTone,
} from "@rosegriffon/achillea-core";
import { badgeVariant } from "@/lib/achillea";
import { Badge, Button, Skeleton } from "@rosegriffon/ui";
import { Calendar, Users, Trophy, ChevronRight } from "lucide-react";

interface TournamentTableProps {
	tournaments: (Tournament | any)[];
	loading?: boolean;
	className?: string;
}

export function TournamentTable({
	tournaments,
	loading = false,
	className,
}: TournamentTableProps) {
	if (loading) {
		return (
			<div className="space-y-3">
				{[1, 2, 3, 4].map((i) => (
					<Skeleton key={i} className="h-16 w-full rounded-xl" />
				))}
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
						<th className="px-4 py-3 hidden md:table-cell">Organisateur</th>
						<th className="px-4 py-3 hidden sm:table-cell">Format</th>
						<th className="px-4 py-3 hidden lg:table-cell">Capacité</th>
						<th className="px-4 py-3">Date</th>
						<th className="px-4 py-3 text-center">Statut</th>
						<th className="px-4 py-3 text-right">Action</th>
					</tr>
				</thead>
				<tbody className="divide-y divide-outline/10 text-on-surface">
					{tournaments.map((t) => {
						const tone = tournamentStateTone(t.internalState);
						const variant = badgeVariant(tone);
						const stateLabel = tournamentStateLabel(t.internalState);
						const formatName = stageTypeLabel(t.tournamentType);
						const formattedDate = new Date(t.startsAt).toLocaleDateString("fr-FR", {
							day: "numeric",
							month: "short",
							hour: "2-digit",
							minute: "2-digit",
						});

						return (
							<tr
								key={t.id}
								className="hover:bg-surface-variant/20 transition-colors group"
							>
								{/* Tournoi */}
								<td className="px-4 py-3 font-semibold">
									<Link
										href={`/achillea/tournaments/${t.id}`}
										className="flex items-center gap-3 group-hover:text-primary transition-colors"
									>
										<div className="relative size-9 rounded-lg overflow-hidden bg-surface-variant shrink-0 border border-outline/20">
											{t.logo || t.affiche ? (
												<Image
													src={t.logo || t.affiche || ""}
													alt=""
													fill
													unoptimized
													className="object-cover"
												/>
											) : (
												<div className="size-full flex items-center justify-center text-on-surface-variant">
													<Trophy className="size-4" />
												</div>
											)}
										</div>
										<span className="truncate max-w-[180px] sm:max-w-[240px]">
											{t.name}
										</span>
									</Link>
								</td>

								{/* Organisateur */}
								<td className="px-4 py-3 hidden md:table-cell text-on-surface-variant text-xs">
									{t.organization?.name || "Achilléa"}
								</td>

								{/* Format */}
								<td className="px-4 py-3 hidden sm:table-cell text-on-surface-variant text-xs">
									{formatName}
								</td>

								{/* Capacité */}
								<td className="px-4 py-3 hidden lg:table-cell text-on-surface-variant text-xs">
									<div className="flex items-center gap-1">
										<Users className="size-3.5" />
										<span>{t.participantsNumber} joueurs</span>
									</div>
								</td>

								{/* Date */}
								<td className="px-4 py-3 text-xs text-on-surface-variant whitespace-nowrap">
									<div className="flex items-center gap-1.5">
										<Calendar className="size-3 hidden sm:inline" />
										<span>{formattedDate}</span>
									</div>
								</td>

								{/* Statut */}
								<td className="px-4 py-3 text-center">
									<Badge variant={variant} className="text-[11px] whitespace-nowrap">
										{stateLabel}
									</Badge>
								</td>

								{/* Action */}
								<td className="px-4 py-3 text-right">
									<Button asChild variant="ghost" size="sm" className="h-8 px-2 text-xs">
										<Link href={`/achillea/tournaments/${t.id}`}>
											Détails
											<ChevronRight className="size-3.5 ml-1" />
										</Link>
									</Button>
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}
