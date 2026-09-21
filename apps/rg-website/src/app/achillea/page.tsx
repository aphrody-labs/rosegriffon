import Image from "next/image";
import Link from "next/link";
import { metadonneesAchillea } from "@/app/achillea/metadonnees";
import { createAchilleaClient } from "@/lib/achillea";
import { getPgPoolOrNull } from "@/lib/db/pg";
import {
	lireClassement,
	lireChiffresEsport,
	lireClansActifs,
	lireTournoisActifs,
	type LigneClassement,
	type ChiffresEsport,
	type PreviewClan,
	type PreviewTournament,
} from "@/lib/achillea/classement";
import { HeroSection } from "@/components/achillea/HeroSection";
import { AchilleaLiveHub } from "@/components/home/AchilleaLiveHub";
import { RankedTiersGrid } from "@/components/achillea/RankedTiersGrid";
import { TournamentState } from "@rosegriffon/achillea-types";
import type { Tournament, ParticipantDTO } from "@rosegriffon/achillea-types";
import {
	PlayCircle,
	Video,
	Swords,
	Users,
	Trophy,
	Shield,
	ExternalLink,
	BookOpen,
	ArrowRight,
	Sparkles,
} from "lucide-react";
import { FaDiscord, FaTwitch } from "react-icons/fa6";
import { Button } from "@rosegriffon/ui";

export const revalidate = 60;

export const metadata = metadonneesAchillea({
	titre: "Accueil E-Sport & Tournois",
	description:
		"Achilléa, le portail compétitif officiel Inazuma Eleven: Victory Road. Tournois homologués, clans actifs, classement classé 1v1/2v2, ELO et diffusions live.",
	chemin: "/achillea",
});

const STATE_PRIORITY: Record<string, number> = {
	[TournamentState.ONGOING]: 0,
	[TournamentState.PREPARING]: 1,
	[TournamentState.PREREGISTERING]: 2,
};

interface PlaylistAchillea {
	id: string;
	titre: string;
	description: string;
	miniature: string;
	url: string;
	videos: number | null;
}

async function chargerPlaylists(): Promise<PlaylistAchillea[]> {
	const cle = process.env["YOUTUBE_API_KEY"] ?? process.env["GOOGLE_API_KEY"];
	const chaine = process.env["ACHILLEA_YOUTUBE_CHANNEL_ID"];

	if (!cle || !chaine) {
		return [];
	}

	try {
		const url = new URL("https://www.googleapis.com/youtube/v3/playlists");
		url.searchParams.set("part", "snippet,contentDetails");
		url.searchParams.set("channelId", chaine);
		url.searchParams.set("maxResults", "6");
		url.searchParams.set("key", cle);

		const reponse = await fetch(url, { next: { revalidate: 3600 } });
		if (!reponse.ok) return [];

		const corps = (await reponse.json()) as { items?: Array<{
			id?: string;
			snippet?: {
				title?: string;
				description?: string;
				thumbnails?: Record<string, { url?: string } | undefined>;
			};
			contentDetails?: { itemCount?: number };
		}> };

		return (corps.items ?? [])
			.filter((item): item is typeof item & { id: string } => typeof item.id === "string")
			.map((item) => ({
				description: item.snippet?.description || "",
				id: item.id,
				miniature:
					item.snippet?.thumbnails?.["medium"]?.url ??
					item.snippet?.thumbnails?.["default"]?.url ??
					"",
				titre: item.snippet?.title ?? "",
				url: `https://www.youtube.com/playlist?list=${item.id}`,
				videos:
					typeof item.contentDetails?.itemCount === "number"
						? item.contentDetails.itemCount
						: null,
			}));
	} catch {
		return [];
	}
}

async function loadTournamentData(): Promise<{
	featured: any;
	featuredParticipants: any[];
	otherActive: any[];
}> {
	// 1. Essai direct en base Postgres locale (chargement ultra-rapide < 5ms)
	try {
		const pool = getPgPoolOrNull();
		if (pool) {
			const { rows: events } = await pool.query<{
				id: number;
				name: string;
				description: string | null;
				starts_at: string | null;
				tournament_type: string | null;
				status: string;
				internal_state: string;
				participants_number: number | null;
				logo: string | null;
				affiche: string | null;
			}>(
				`SELECT id, name, description, starts_at, tournament_type, status, internal_state, participants_number, logo, affiche
				 FROM achillea.event 
				 WHERE status != 'Canceled' AND internal_state != 'Pending'
				 ORDER BY CASE internal_state
				   WHEN 'Ongoing' THEN 1
				   WHEN 'Preparing' THEN 2
				   WHEN 'Preregistering' THEN 3
				   WHEN 'Open' THEN 4
				   ELSE 5 END,
				   starts_at DESC 
				 LIMIT 4`
			);

			if (events.length > 0) {
				const primary = events[0];
				const otherEvents = events.slice(1);

				// Récupération des participants du tournoi vedette
				const { rows: participants } = await pool.query<{
					id: number;
					user_id: string;
					username: string | null;
					display_name: string | null;
					avatar: string | null;
				}>(
					`SELECT tp.id, tp.user_id, u.username, u.display_name, u.avatar
					 FROM achillea.tournament_participant tp
					 JOIN achillea."user" u ON u.id = tp.user_id
					 WHERE tp.tournament_id = $1
					 LIMIT 12`,
					[primary.id]
				);

				const featuredParticipants = participants.map((p) => ({
					bracketParticipantId: null,
					hasCheckedIn: true,
					id: p.id,
					registeredAt: new Date().toISOString(),
					seed: 0,
					status: "registered",
					statusActorId: null,
					statusChangedAt: null,
					statusReason: null,
					tournamentId: primary.id,
					user: {
						avatar: p.avatar ?? undefined,
						id: p.user_id,
						username: p.display_name || p.username || "Joueur",
					},
					userId: p.user_id,
				})) as unknown as ParticipantDTO[];

				return {
					featured: {
						affiche: primary.affiche,
						description: primary.description,
						id: primary.id,
						internalState: primary.internal_state as TournamentState,
						logo: primary.logo,
						name: primary.name,
						participantsNumber: primary.participants_number ?? 0,
						startsAt: primary.starts_at ?? new Date().toISOString(),
						status: primary.status,
						tournamentType: primary.tournament_type ?? "single_elimination",
					} as unknown as Tournament,
					featuredParticipants,
					otherActive: otherEvents.map((o) => ({
						id: o.id,
						internalState: o.internal_state as TournamentState,
						name: o.name,
						startsAt: o.starts_at ?? new Date().toISOString(),
						tournamentType: o.tournament_type ?? "single_elimination",
					})) as unknown as Tournament[],
				};
			}
		}
	} catch (error) {
		console.warn("[achillea] Chargement Postgres tournois en repli:", error);
	}

	// 2. Repli vers le client API si disponible
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
	const [
		{ featured, featuredParticipants, otherActive },
		classement,
		chiffresEsport,
		clans,
		tournaments,
		playlists,
	] = await Promise.all([
		loadTournamentData(),
		lireClassement(2, 5),
		lireChiffresEsport(),
		lireClansActifs(4),
		lireTournoisActifs(4),
		chargerPlaylists(),
	]);

	const previewData = {
		clans,
		leaderboard: classement,
		stats: chiffresEsport,
		tournaments,
	};

	return (
		<div className="space-y-12 sm:space-y-16 pb-16">
			{/* 1. Hero & Featured Tournament */}
			<HeroSection
				featured={featured}
				featuredParticipants={featuredParticipants}
				otherActive={otherActive}
			/>

			{/* 2. Hub Compétitif Live (Leaderboard 1v1, Clans, Tournois, Modes & Podium Direct) */}
			<AchilleaLiveHub
				classement={classement}
				chiffresEsport={chiffresEsport}
				previewData={previewData}
			/>

			{/* 3. L'Échelle des 11 Paliers ELO (Fer à Légendaire) */}
			<RankedTiersGrid />

			{/* 4. Playlists YouTube & Replays de Matchs */}
			{playlists.length > 0 && (
				<section
					aria-labelledby="vods-title"
					className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6"
				>
					<div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-outline/15 pb-4">
						<div className="space-y-1">
							<div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-500 text-xs font-bold uppercase tracking-wider">
								<Video className="size-3.5" />
								VODs &amp; Matchs
							</div>
							<h2
								id="vods-title"
								className="text-2xl sm:text-3xl font-black text-on-surface tracking-tight"
							>
								Revivez les Meilleurs Matchs
							</h2>
							<p className="text-xs sm:text-sm text-on-surface-variant max-w-2xl">
								Replays, analyses et temps forts des tournois officiels Achilléa.
							</p>
						</div>

						<a
							href="https://youtube.com/@Achillea_IE"
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-red-400 hover:underline shrink-0 group"
						>
							Chaîne YouTube Officielle
							<ArrowRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" />
						</a>
					</div>

					<div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
						{playlists.map((pl) => (
							<a
								key={pl.id}
								href={pl.url}
								target="_blank"
								rel="noopener noreferrer"
								className="group flex flex-col rounded-2xl border border-outline/20 bg-surface/80 hover:border-primary/50 hover:bg-surface hover:shadow-xl transition-all overflow-hidden"
							>
								<div className="relative aspect-video w-full overflow-hidden bg-surface-variant shrink-0">
									<Image
										src={pl.miniature}
										alt={pl.titre}
										fill
										unoptimized
										className="object-cover group-hover:scale-105 transition-transform duration-300"
									/>
									<div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover:bg-black/10 transition-colors">
										<PlayCircle className="size-10 text-white drop-shadow-md group-hover:scale-110 transition-transform" />
									</div>
									{pl.videos !== null && (
										<span className="absolute bottom-2 right-2 bg-black/80 text-white text-[11px] font-bold px-2 py-0.5 rounded-md font-mono tabular-nums backdrop-blur-sm">
											{pl.videos} vidéos
										</span>
									)}
								</div>

								<div className="p-4 flex-1 flex flex-col justify-between space-y-2">
									<h3 className="font-bold text-sm sm:text-base text-on-surface group-hover:text-primary transition-colors line-clamp-1">
										{pl.titre}
									</h3>
									<p className="text-xs text-on-surface-variant line-clamp-2 leading-relaxed">
										{pl.description || "Replay des phases éliminatoires et finales."}
									</p>
									<span className="pt-2 text-xs font-semibold text-primary flex items-center gap-1">
										Visionner la playlist →
									</span>
								</div>
							</a>
						))}
					</div>
				</section>
			)}

			{/* 5. Écosystème, Homologation & Communauté */}
			<section
				aria-labelledby="ecosystem-title"
				className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6"
			>
				<div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-outline/15 pb-4">
					<div className="space-y-1">
						<div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-achillea-purple/25 border border-achillea-lime/40 text-achillea-lime text-xs font-bold uppercase tracking-wider">
							<Shield className="size-3.5" />
							Règlement &amp; Outils
						</div>
						<h2
							id="ecosystem-title"
							className="text-2xl sm:text-3xl font-black text-on-surface tracking-tight"
						>
							L&apos;Écosystème Compétitif Achilléa
						</h2>
						<p className="text-xs sm:text-sm text-on-surface-variant max-w-2xl">
							Règles homologuées, bot Discord officiel, gestion de tournois et salon des casters.
						</p>
					</div>
				</div>

				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
					{/* Card 1: Bot Achilléa */}
					<div className="p-5 rounded-2xl border border-outline/20 bg-surface/80 flex flex-col justify-between space-y-3">
						<div className="space-y-2">
							<div className="size-10 rounded-xl bg-achillea-purple/20 text-achillea-lime flex items-center justify-center font-bold">
								<Swords className="size-5" />
							</div>
							<h3 className="text-base font-black text-on-surface">Bot Achilléa</h3>
							<p className="text-xs text-on-surface-variant leading-relaxed">
								Scores automatiques, matchmaking classé en temps réel et signalement de résultats directement sur Discord.
							</p>
						</div>
						<Button asChild size="sm" variant="outline" className="w-full text-xs font-bold rounded-xl">
							<Link href="/achillea/guide">
								Consulter le guide
							</Link>
						</Button>
					</div>

					{/* Card 2: Homologation de tournoi */}
					<div className="p-5 rounded-2xl border border-outline/20 bg-surface/80 flex flex-col justify-between space-y-3">
						<div className="space-y-2">
							<div className="size-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold">
								<Trophy className="size-5" />
							</div>
							<h3 className="text-base font-black text-on-surface">Homologation</h3>
							<p className="text-xs text-on-surface-variant leading-relaxed">
								Faites homologuer votre tournoi communautaire pour attribuer des points de classement officiel.
							</p>
						</div>
						<Button asChild size="sm" variant="outline" className="w-full text-xs font-bold rounded-xl">
							<Link href="/achillea/tournaments/create">
								Créer un tournoi
							</Link>
						</Button>
					</div>

					{/* Card 3: Twitch Live */}
					<div className="p-5 rounded-2xl border border-outline/20 bg-surface/80 flex flex-col justify-between space-y-3">
						<div className="space-y-2">
							<div className="size-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold">
								<FaTwitch className="size-5" />
							</div>
							<h3 className="text-base font-black text-on-surface">Twitch Officiel</h3>
							<p className="text-xs text-on-surface-variant leading-relaxed">
								Diffusions officielles des finales de coupe, casts en direct et analyses de la méta Inazuma Eleven.
							</p>
						</div>
						<Button asChild size="sm" variant="outline" className="w-full text-xs font-bold rounded-xl">
							<a href="https://twitch.tv/Achillea_IE" target="_blank" rel="noopener noreferrer">
								Rejoindre le live
								<ExternalLink className="size-3 ml-1" />
							</a>
						</Button>
					</div>

					{/* Card 4: Discord Compétitif */}
					<div className="p-5 rounded-2xl border border-outline/20 bg-surface/80 flex flex-col justify-between space-y-3">
						<div className="space-y-2">
							<div className="size-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold">
								<FaDiscord className="size-5" />
							</div>
							<h3 className="text-base font-black text-on-surface">Discord Achilléa</h3>
							<p className="text-xs text-on-surface-variant leading-relaxed">
								Rejoignez plus de 1 000 compétiteurs francophones : salons de recrutement, recherche de matchs et annonces.
							</p>
						</div>
						<Button asChild size="sm" variant="outline" className="w-full text-xs font-bold rounded-xl">
							<a
								href="https://discord.gg/achillea-competitif-inazuma-eleven-fr-1055585286320554055"
								target="_blank"
								rel="noopener noreferrer"
							>
								Rejoindre le Discord
								<ExternalLink className="size-3 ml-1" />
							</a>
						</Button>
					</div>
				</div>
			</section>
		</div>
	);
}
