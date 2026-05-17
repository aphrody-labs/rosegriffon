"use server";

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
const CHANNEL_NAME = "rose_griffontv";

async function getTwitchAccessToken() {
  const response = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${TWITCH_CLIENT_ID}&client_secret=${TWITCH_CLIENT_SECRET}&grant_type=client_credentials`,
    {
      method: "POST",
    }
  );
  const data = await response.json();
  return data.access_token;
}

export interface TwitchClip {
  id: string;
  url: string;
  embed_url: string;
  broadcaster_id: string;
  broadcaster_name: string;
  creator_id: string;
  creator_name: string;
  video_id: string;
  game_id: string;
  language: string;
  title: string;
  view_count: number;
  created_at: string;
  thumbnail_url: string;
  duration: number;
  download_url?: string; // Custom field
}

export async function getChannelClips(
  limit = 20
): Promise<{ success: boolean; clips?: TwitchClip[]; error?: string }> {
  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
    return {
      success: false,
      error: "Twitch API credentials are not configured.",
    };
  }

  try {
    const accessToken = await getTwitchAccessToken();
    if (!accessToken) {
      return {
        success: false,
        error: "Failed to retrieve Twitch access token.",
      };
    }

    // 1. Get user ID from channel name
    const userResponse = await fetch(`https://api.twitch.tv/helix/users?login=${CHANNEL_NAME}`, {
      headers: {
        "Client-ID": TWITCH_CLIENT_ID,
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const userData = await userResponse.json();
    const userId = userData.data?.[0]?.id;

    if (!userId) {
      return { success: false, error: "Channel not found" };
    }

    // 2. Get clips
    const clipsResponse = await fetch(
      `https://api.twitch.tv/helix/clips?broadcaster_id=${userId}&first=${limit}`,
      {
        headers: {
          "Client-ID": TWITCH_CLIENT_ID,
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    const clipsData = await clipsResponse.json();

    if (!clipsData.data) {
      return { success: false, error: "Failed to fetch clips" };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const clips: TwitchClip[] = clipsData.data.map((clip: any) => {
      // Attempt to generate download URL from thumbnail URL
      // Thumbnail: https://clips-media-assets2.twitch.tv/AT-cm%7C...-preview-480x272.jpg
      // Video: https://clips-media-assets2.twitch.tv/AT-cm%7C... .mp4
      let download_url = "";
      if (clip.thumbnail_url) {
        const index = clip.thumbnail_url.indexOf("-preview-");
        if (index !== -1) {
          download_url = `${clip.thumbnail_url.substring(0, index)}.mp4`;
        }
      }
      return {
        ...clip,
        download_url,
      };
    });

    return { success: true, clips };
  } catch (error) {
    console.error("Error fetching clips:", error);
    return { success: false, error: "Internal server error" };
  }
}

export async function sendClipsToDiscord(
  _clips: TwitchClip[],
  _channelId: string
): Promise<{ success: boolean; error?: string }> {
  return { success: false, error: "Not implemented" };
}
