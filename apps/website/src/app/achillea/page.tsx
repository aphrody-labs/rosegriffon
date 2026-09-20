import type { Metadata } from "next";
import Image from "next/image";
import { createAchilleaClient } from "@/lib/achillea";
import { TournamentState } from "@rosegriffon/achillea-types";
import type { Tournament, ParticipantDTO } from "@rosegriffon/achillea-types";
import { HeroSection } from "@/components/achillea/HeroSection";
import { PlayCircle, Video } from "lucide-react";

export const revalidate = 60;

export const metadata: Metadata = {
	title: "Accueil E-Sport & Tournois",
	description:
		"Achilléa, le portail compétitif Inazuma Eleven: Victory Road. Inscriptions tournois, clans, ranked et lives.",
};

const FEATURED_STATES = [
	TournamentState.ONGOING,
	TournamentState.PREPARING,
	TournamentState.PREREGISTERING,
];

const STATE_PRIORITY: Record<string, number> = {
	[TournamentState.ONGOING]: 0,
	[TournamentState.PREPARING]: 1,
	[TournamentState.PREREGISTERING]: 2,
};

const PLAYLISTS = [
	{
		id: "PLcKB9TqcHTYUw8SoFrbhBl6aQU3GZiZdr",
		title: "Astral Cup",
		description: "Tournoi accrédité Achilléa",
		thumbnail: "https://i.ytimg.com/vi/BooGtg46kZQ/mqdefault.jpg",
		url: "https://www.youtube.com/playlist?list=PLcKB9TqcHTYUw8SoFrbhBl6aQU3GZiZdr",
		count: 15,
	},
	{
		id: "PLcKB9TqcHTYWBZ0ua3NQJCA-wFGUeVCLp",
		title: "The Bloom Combine",
		description: "Tournoi entre 64 joueurs",
		thumbnail: "https://i.ytimg.com/vi/25oRrdeMfFs/mqdefault.jpg",
		url: "https://www.youtube.com/playlist?list=PLcKB9TqcHTYWBZ0ua3NQJCA-wFGUeVCLp",
		count: 14,
	},
];

async function loadTournamentData() {
	try {
		const client = createAchilleaClient();
		const res = await client.tournaments.list({ page: 1, pagination: 12 });
		if (!res.ok || !res.value.data.length) {
			return { featured: null, featuredParticipants: [], otherActive: [] };
		}

		const list = res.value.data;
		const now = Date.now();
		const sorted = [...list].sort((a, b) => {
			const pa = STATE_PRIORITY[a.internalState] ?? 9;
			const pb = STATE_PRIORITY[b.internalState] ?? 9;
			if (pa !== pb) return pa - pb;
			const da = Math.abs(new Date(a.startsAt).getTime() - now);
			const db = Math.abs(new Date(b.startsAt).getTime() - now);
			return da - db;
		});

		const primary = sorted[0]!;
		const otherActive = sorted.slice(1, 4);

		const detailRes = await client.tournaments.get(primary.id);
		if (detailRes.ok) {
			return {
				featured: detailRes.value[0],
				featuredParticipants: detailRes.value[1] ?? [],
				otherActive,
			};
		}

		return {
			featured: primary,
			featuredParticipants: [] as ParticipantDTO[],
			otherActive,
		};
	} catch {
		return { featured: null, featuredParticipants: [], otherActive: [] };
	}
}

export default async function AchilleaHomePage() {
	const { featured, featuredParticipants, otherActive } =
		await loadTournamentData();

	return (
		<div className="space-y-12">
			{/* Hero & Featured section */}
			<HeroSection
				featured={featured}
				featuredParticipants={featuredParticipants}
				otherActive={otherActive}
			/>

			{/* Playlists YouTube */}
			<section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
				<div className="flex items-center gap-2.5">
					<div className="size-8 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center font-bold">
						<Video className="size-4" />
					</div>
					<div>
						<h2 className="text-xl sm:text-2xl font-black text-on-surface">
							Revivez les meilleurs matchs
						</h2>
						<p className="text-xs sm:text-sm text-on-surface-variant">
							Replays et vods des tournois officiels Achilléa.
						</p>
					</div>
				</div>

				<div className="grid sm:grid-cols-2 gap-4">
					{PLAYLISTS.map((pl) => (
						<a
							key={pl.id}
							href={pl.url}
							target="_blank"
							rel="noopener noreferrer"
							className="group flex gap-4 p-4 rounded-2xl border border-outline/20 bg-surface hover:border-primary/50 hover:shadow-lg transition-all"
						>
							<div className="relative aspect-video w-36 sm:w-44 rounded-xl overflow-hidden bg-surface-variant shrink-0">
								<Image
									src={pl.thumbnail}
									alt={pl.title}
									fill
									unoptimized
									className="object-cover group-hover:scale-105 transition-transform duration-300"
								/>
								<div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover:bg-black/10 transition-colors">
									<PlayCircle className="size-8 text-white drop-shadow-md" />
								</div>
								<span className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
									{pl.count} vidéos
								</span>
							</div>

							<div className="flex-1 min-w-0 flex flex-col justify-center space-y-1">
								<h3 className="font-bold text-sm sm:text-base text-on-surface group-hover:text-primary transition-colors truncate">
									{pl.title}
								</h3>
								<p className="text-xs text-on-surface-variant line-clamp-2">
									{pl.description}
								</p>
							</div>
						</a>
					))}
				</div>
			</section>
		</div>
	);
}
