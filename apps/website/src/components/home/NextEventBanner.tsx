import { ArrowRight, Clock, MapPin } from "lucide-react";
import Link from "next/link";

import type { CalendarEvent } from "@/types/api";

interface NextEventBannerProps {
	event: CalendarEvent;
}

export function NextEventBanner({ event }: NextEventBannerProps) {
	if (!event?.start) {
		return null;
	}

	// Sécurisation des dates
	const startDateStr = event.start.dateTime || event.start.date;

	if (!startDateStr) {
		return null;
	}

	const startDate = new Date(startDateStr);

	// Formatage
	const day = startDate.toLocaleDateString("fr-FR", { day: "numeric" });
	const month = startDate.toLocaleDateString("fr-FR", { month: "short" });
	const time = event.start.dateTime
		? startDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
		: null;

	const isToday = new Date().toDateString() === startDate.toDateString();

	return (
		<section className="w-full container mx-auto px-4 mb-8">
			<div className="relative overflow-hidden rounded-3xl bg-linear-to-r from-violet-600 to-indigo-600 shadow-xl shadow-indigo-500/20 text-white">
				{/* Motif de fond */}
				<div
					className="absolute inset-0 opacity-10"
					style={{ backgroundImage: "url(/grid-pattern.svg)" }}
				/>

				<div className="relative z-10 flex flex-col md:flex-row items-center justify-between p-6 md:p-8 gap-6">
					{/* Bloc Date & Info */}
					<div className="flex flex-col md:flex-row items-center md:items-start gap-6 w-full md:w-auto text-center md:text-left">
						{/* Date Badge */}
						<div className="shrink-0 flex flex-col items-center justify-center size-20 bg-muted backdrop-blur-md rounded-2xl border border-border shadow-inner">
							<span className="text-2xl font-bold font-brad-bun-r">{day}</span>
							<span className="text-sm font-medium uppercase tracking-wider">{month}</span>
						</div>

						{/* Détails */}
						<div className="space-y-2 max-w-xl">
							<div className="flex items-center justify-center md:justify-start gap-2">
								<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-muted text-white border border-border uppercase tracking-wide">
									{isToday ? "En ce moment" : "Prochain événement"}
								</span>
								{time && (
									<span className="flex items-center gap-1 text-xs font-medium text-indigo-100">
										<Clock className="size-3" />
										{time}
									</span>
								)}
							</div>

							<h2 className="text-2xl md:text-3xl font-bold leading-tight font-brad-bun-r tracking-wide">
								{event.summary}
							</h2>

							{event.location && (
								<div className="flex items-center justify-center md:justify-start gap-2 text-indigo-100 text-sm">
									<MapPin className="size-4 shrink-0" />
									<span className="line-clamp-1">{event.location}</span>
								</div>
							)}
						</div>
					</div>

					{/* Action */}
					<div className="shrink-0">
						<Link
							href="/evenements"
							className="group flex items-center gap-2 px-6 py-3 bg-white text-indigo-600 rounded-full font-bold hover:bg-indigo-50 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0"
						>
							Voir les détails
							<ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
						</Link>
					</div>
				</div>
			</div>
		</section>
	);
}
