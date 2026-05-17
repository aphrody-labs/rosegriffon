import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
const DEFAULT_CHANNEL = "rose_griffontv";
const ALLOWED_CHANNELS = new Set(["rose_griffontv", "achillea_ie"]);

interface TwitchTokenResponse {
  access_token: string;
  expires_in: number;
}

// Cache simple en mémoire pour le token
let accessToken: string | null = null;
let tokenExpiry: number = 0;

async function getTwitchAccessToken(): Promise<string | null> {
  if (accessToken && Date.now() < tokenExpiry) return accessToken;
  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) return null;

  try {
    const params = new URLSearchParams({
      client_id: TWITCH_CLIENT_ID,
      client_secret: TWITCH_CLIENT_SECRET,
      grant_type: "client_credentials",
    });

    const response = await fetch(`https://id.twitch.tv/oauth2/token?${params.toString()}`, {
      method: "POST",
    });

    if (!response.ok) return null;

    const data: TwitchTokenResponse = await response.json();
    accessToken = data.access_token;
    tokenExpiry = Date.now() + data.expires_in * 1000 - 60000;
    return accessToken;
  } catch {
    return null;
  }
}

function twitchHeaders(token: string) {
  return {
    "Client-ID": TWITCH_CLIENT_ID!,
    Authorization: `Bearer ${token}`,
  };
}

async function twitchFetch(url: string, token: string) {
  const res = await fetch(url, { headers: twitchHeaders(token), next: { revalidate: 300 } });
  if (!res.ok) return null;
  return res.json();
}

// ─── YouTube fallback (rediffs) ─────────────────────────────────────────
// Pas d'API key requise — utilise le RSS feed natif (15 dernières vidéos).
const YOUTUBE_CHANNEL_IDS: Record<string, string> = {
  rose_griffontv: "UCleqt3V_yTgxY6XLZeEFV8g", // @rosegriffon
  achillea_ie: "UCh2FiAYaOfuvwTaBVs7CpFw", // @achillearg
};

interface YoutubeVideo {
  id: string;
  title: string;
  thumbnail_url: string;
  view_count: number;
  created_at: string;
  duration: string;
  url: string;
  type: "youtube";
}

async function fetchYoutubeVideos(channel: string): Promise<YoutubeVideo[]> {
  const channelId = YOUTUBE_CHANNEL_IDS[channel];
  if (!channelId) return [];
  try {
    const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, {
      next: { revalidate: 600 },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const decode = (s: string) =>
      s
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">");

    const out: YoutubeVideo[] = [];
    const entryRe = /<entry>([\s\S]*?)<\/entry>/g;
    let match: RegExpExecArray | null = entryRe.exec(xml);
    while (match !== null) {
      const block = match[1] ?? "";
      const id = block.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1];
      const title = block.match(/<title>([^<]+)<\/title>/)?.[1];
      const published = block.match(/<published>([^<]+)<\/published>/)?.[1];
      const thumb = block.match(/<media:thumbnail[^/]*url="([^"]+)"/)?.[1];
      const views = block.match(/<media:statistics[^/]*views="([^"]+)"/)?.[1];
      if (id && title) {
        out.push({
          id,
          title: decode(title),
          thumbnail_url: thumb ?? `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
          view_count: views ? Number.parseInt(views, 10) : 0,
          created_at: published ?? "",
          duration: "",
          url: `https://www.youtube.com/watch?v=${id}`,
          type: "youtube",
        });
      }
      match = entryRe.exec(xml);
    }
    return out;
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestedChannel = url.searchParams.get("channel") || DEFAULT_CHANNEL;
  const channel = ALLOWED_CHANNELS.has(requestedChannel) ? requestedChannel : DEFAULT_CHANNEL;
  const isPrimaryChannel = channel === DEFAULT_CHANNEL;

  const token = await getTwitchAccessToken();
  let liveData = { is_live: false, title: "", category: "", viewers: 0, started_at: "" };
  let userId: string | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let videos: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let clips: any[] = [];
  let followers = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let channelInfo: any = null;

  if (token && TWITCH_CLIENT_ID) {
    try {
      // 1. Récupérer l'utilisateur (pour broadcaster_id)
      const userData = await twitchFetch(
        `https://api.twitch.tv/helix/users?login=${channel}`,
        token
      );
      userId = userData?.data?.[0]?.id || null;

      // 2. Statut live (cache 1 min)
      const streamData = await fetch(`https://api.twitch.tv/helix/streams?user_login=${channel}`, {
        headers: twitchHeaders(token),
        next: { revalidate: 60 },
      }).then((r) => (r.ok ? r.json() : null));

      const stream = streamData?.data?.[0];
      if (stream) {
        liveData = {
          is_live: true,
          title: stream.title,
          category: stream.game_name,
          viewers: stream.viewer_count,
          started_at: stream.started_at,
        };
      }

      if (userId) {
        // 3. VODs : archive prioritaire, fallback highlight, puis upload (couvre tous les cas)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapVideo = (v: any) => ({
          id: v.id,
          title: v.title,
          thumbnail_url: v.thumbnail_url,
          view_count: v.view_count,
          created_at: v.created_at,
          duration: v.duration,
          url: v.url,
          type: v.type as "archive" | "highlight" | "upload",
        });
        for (const type of ["archive", "highlight", "upload"] as const) {
          const data = await twitchFetch(
            `https://api.twitch.tv/helix/videos?user_id=${userId}&first=12&type=${type}`,
            token
          );
          const list = data?.data || [];
          if (list.length > 0) {
            videos = list.map(mapVideo);
            break;
          }
        }

        // Fallback YouTube si Twitch n'a aucun VOD
        if (videos.length === 0) {
          videos = await fetchYoutubeVideos(channel);
        }

        // 4. Tous les clips all-time (paginate jusqu'à épuisement, max 2000)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const allClips: any[] = [];
        let cursor: string | undefined;
        const MAX_CLIP_PAGES = 20; // 20 * 100 = 2000 clips max
        for (let i = 0; i < MAX_CLIP_PAGES; i++) {
          const params = new URLSearchParams({ broadcaster_id: userId, first: "100" });
          if (cursor) params.set("after", cursor);
          const page = await twitchFetch(
            `https://api.twitch.tv/helix/clips?${params.toString()}`,
            token
          );
          if (!page?.data?.length) break;
          allClips.push(...page.data);
          cursor = page.pagination?.cursor;
          if (!cursor) break;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        clips = allClips.map((c: any) => ({
          id: c.id,
          title: c.title,
          thumbnail_url: c.thumbnail_url,
          view_count: c.view_count,
          created_at: c.created_at,
          creator_name: c.creator_name,
          url: c.url,
        }));

        // 5. Followers count
        const followersData = await twitchFetch(
          `https://api.twitch.tv/helix/channels/followers?broadcaster_id=${userId}&first=1`,
          token
        );
        followers = followersData?.total || 0;

        // 6. Channel info
        const user = userData?.data?.[0];
        if (user) {
          channelInfo = {
            description: user.description,
            broadcaster_language: "fr",
            totalViews: user.view_count || 0,
            profileImageUrl: user.profile_image_url,
            createdAt: user.created_at,
          };
        }
      }
    } catch (e) {
      console.error("Erreur API Twitch:", e);
    }
  }

  // Planning depuis Supabase — uniquement pour la chaîne primaire (RGTV)
  let nextStream: unknown = null;
  let currentScheduled: unknown = null;
  if (isPrimaryChannel) {
    const supabase = await createClient();
    const today = new Date().getDay();
    const nowTime = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

    const { data: schedule } = await supabase
      .from("stream_schedules")
      .select("start_time, end_time, streamer_name, category")
      .eq("day_of_week", today)
      .eq("status", "active")
      .order("start_time", { ascending: true });

    nextStream = schedule?.find((s) => s.start_time > nowTime) || null;
    currentScheduled =
      schedule?.find((s) => s.start_time <= nowTime && s.end_time > nowTime) || null;
  }

  return Response.json({
    channel: channel,
    url: `https://twitch.tv/${channel}`,
    live: liveData,
    videos,
    clips,
    followers,
    channelInfo,
    schedule: {
      current: currentScheduled,
      next: nextStream,
    },
    updated_at: new Date().toISOString(),
  });
}
