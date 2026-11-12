import Image from "next/image";
import { metadonneesAchillea } from "@/app/achillea/metadonnees";
import { HeroSection } from "@/components/achillea/HeroSection";
import { createAchilleaClient } from "@/lib/achillea";
import { lireChiffresEsport } from "@/lib/achillea/classement";
import { loadRecentTournaments } from "@/lib/achillea/home-tournaments";
import { getPgPoolOrNull } from "@/lib/db/pg";
import { ArrowRight, PlayCircle, Video } from "lucide-react";
import type { ParticipantDTO, Tournament } from "@rosegriffon/achillea-types";
import { TournamentState } from "@rosegriffon/achillea-types";

export const dynamic = "force-static";
export const revalidate = 300;

export const metadata = metadonneesAchillea({
  titre: "Accueil E-Sport & Tournois",
  description:
    "Achilléa, le portail compétitif officiel Inazuma Eleven: Victory Road. Tournois, clans et classements classés.",
  chemin: "/achillea",
});

const ACTIVE_STATES = ["Ongoing", "Preparing", "Preregistering", "Open"];

interface PlaylistAchillea {
  id: string;
  titre: string;
  description: string;
  miniature: string;
  url: string;
  videos: number | null;
}

async function chargerPlaylists(): Promise<PlaylistAchillea[]> {
  const key = process.env["YOUTUBE_API_KEY"] ?? process.env["GOOGLE_API_KEY"];
  const channel = process.env["ACHILLEA_YOUTUBE_CHANNEL_ID"];
  if (!key || !channel) return [];

  try {
    const url = new URL("https://www.googleapis.com/youtube/v3/playlists");
    url.searchParams.set("part", "snippet,contentDetails");
    url.searchParams.set("channelId", channel);
    url.searchParams.set("maxResults", "6");
    url.searchParams.set("key", key);
    const response = await fetch(url, { next: { revalidate: 3600 } });
    if (!response.ok) return [];
    const body = (await response.json()) as {
      items?: Array<{
        id?: string;
        snippet?: { title?: string; description?: string; thumbnails?: Record<string, { url?: string }> };
        contentDetails?: { itemCount?: number };
      }>;
    };
    return (body.items ?? []).flatMap(item => {
      if (!item.id) return [];
      const thumbnail = item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url;
      if (!thumbnail) return [];
      return [
        {
          description: item.snippet?.description ?? "",
          id: item.id,
          miniature: thumbnail,
          titre: item.snippet?.title ?? "Playlist Achilléa",
          url: `https://www.youtube.com/playlist?list=${item.id}`,
          videos: item.contentDetails?.itemCount ?? null,
        },
      ];
    });
  } catch {
    return [];
  }
}

async function loadActiveTournaments(): Promise<{
  featured: Tournament | null;
  featuredParticipants: ParticipantDTO[];
  otherActive: Tournament[];
}> {
  try {
    const pool = getPgPoolOrNull();
    if (pool) {
      const { rows } = await pool.query<{
        id: number;
        name: string;
        starts_at: string | null;
        tournament_type: string | null;
        status: string;
        internal_state: string;
        participants_number: number | null;
        logo: string | null;
        affiche: string | null;
      }>(
        `SELECT id, name, starts_at, tournament_type, status, internal_state, participants_number, logo, affiche
				FROM achillea.event WHERE status != 'Canceled' AND internal_state = ANY($1::text[])
				ORDER BY array_position($1::text[], internal_state), starts_at DESC LIMIT 4`,
        [ACTIVE_STATES],
      );
      if (rows.length) {
        const asTournament = (row: (typeof rows)[number]) =>
          ({
            id: row.id,
            name: row.name,
            startsAt: row.starts_at ?? new Date().toISOString(),
            tournamentType: row.tournament_type ?? "single_elimination",
            status: row.status,
            internalState: row.internal_state as TournamentState,
            participantsNumber: row.participants_number ?? 0,
            logo: row.logo,
            affiche: row.affiche,
          }) as unknown as Tournament;
        const { rows: participants } = await pool.query<{
          id: number;
          user_id: string;
          username: string | null;
          display_name: string | null;
          avatar: string | null;
        }>(
          `SELECT tp.id, tp.user_id, u.username, u.display_name, u.avatar FROM achillea.tournament_participant tp
					 JOIN achillea."user" u ON u.id = tp.user_id WHERE tp.tournament_id = $1 LIMIT 12`,
          [rows[0].id],
        );
        return {
          featured: asTournament(rows[0]),
          featuredParticipants: participants.map(
            participant =>
              ({
                id: participant.id,
                userId: participant.user_id,
                tournamentId: rows[0].id,
                status: "registered",
                user: {
                  id: participant.user_id,
                  username: participant.display_name || participant.username || "Joueur",
                  avatar: participant.avatar ?? undefined,
                },
              }) as unknown as ParticipantDTO,
          ),
          otherActive: rows.slice(1).map(asTournament),
        };
      }
    }
  } catch (error) {
    console.warn("[achillea] lecture des tournois actifs échouée", error);
  }

  try {
    const response = await createAchilleaClient().tournaments.list({ page: 1, pagination: 12 });
    if (!response.ok) return { featured: null, featuredParticipants: [], otherActive: [] };
    const items = response.value.data.filter(item => ACTIVE_STATES.includes(item.status ?? ""));
    const details = await Promise.all(items.slice(0, 4).map(item => createAchilleaClient().tournaments.get(item.id)));
    const loaded = details.flatMap(detail => (detail.ok ? [detail.value] : []));
    const [primary, ...rest] = loaded;
    return primary
      ? {
          featured: primary[0] as unknown as Tournament,
          featuredParticipants: primary[1] as unknown as ParticipantDTO[],
          otherActive: rest.map(([tournament]) => tournament as unknown as Tournament),
        }
      : { featured: null, featuredParticipants: [], otherActive: [] };
  } catch {
    return { featured: null, featuredParticipants: [], otherActive: [] };
  }
}

export default async function AchilleaHomePage() {
  const [{ featured, featuredParticipants, otherActive }, stats, playlists] = await Promise.all([
    loadActiveTournaments(),
    lireChiffresEsport(),
    chargerPlaylists(),
  ]);
  // Sans tournoi actif, l'encart montre les derniers tournois joués plutôt
  // qu'un état vide : l'API en a, tous terminés.
  const recent = featured ? [] : await loadRecentTournaments(createAchilleaClient());

  return (
    <div className="achillea-home-page max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-12">
      <HeroSection
        featured={featured}
        featuredParticipants={featuredParticipants}
        otherActive={otherActive}
        recent={recent}
        stats={stats}
      />
      {playlists.length > 0 && (
        <section
          aria-labelledby="vods-title"
          className="rounded-3xl border border-outline-variant/15 bg-surface-container/60 backdrop-blur-md p-6 sm:p-8"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-outline-variant/10 pb-4">
            <div>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary mb-1">
                <Video className="size-4" aria-hidden="true" /> Archives Vidéos
              </span>
              <h2 id="vods-title" className="text-2xl font-black text-on-surface tracking-tight">
                Revoir les Matchs & VODs
              </h2>
            </div>
            <a
              href="https://www.youtube.com/@AchilleaRG"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold bg-surface-container-high hover:bg-surface-container-highest text-on-surface transition-all duration-150 self-start sm:self-auto"
            >
              Chaîne Achilléa <ArrowRight className="size-4" aria-hidden="true" />
            </a>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {playlists.map(playlist => (
              <a
                key={playlist.id}
                href={playlist.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col rounded-2xl border border-outline-variant/10 bg-surface-container-high/40 hover:bg-surface-container-high transition-all duration-200 hover:-translate-y-1 hover:shadow-lg overflow-hidden"
              >
                <div className="relative aspect-video w-full overflow-hidden bg-surface-container-highest">
                  <Image
                    src={playlist.miniature}
                    alt=""
                    fill
                    unoptimized
                    sizes="(max-width: 600px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                    <PlayCircle className="size-12 text-white/90 group-hover:scale-110 transition-transform drop-shadow-md" aria-hidden="true" />
                  </div>
                  {playlist.videos !== null && (
                    <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/75 text-[11px] font-bold text-white font-mono backdrop-blur-xs">
                      {playlist.videos} vidéos
                    </span>
                  )}
                </div>
                <div className="p-4 flex flex-col flex-1">
                  <h3 className="text-base font-bold text-on-surface line-clamp-1 group-hover:text-primary transition-colors">
                    {playlist.titre}
                  </h3>
                  {playlist.description && (
                    <p className="text-xs text-on-surface-variant line-clamp-2 mt-1">
                      {playlist.description}
                    </p>
                  )}
                </div>
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
