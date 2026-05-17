import { type NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/server";
import { assertBotAuth } from "../_lib";

// Cache 30s côté Next.js : stats sont OK avec un peu de staleness
export const revalidate = 30;
export const dynamic = "force-dynamic";

interface CountResult {
  count: number | null;
}

async function count(
  supabase: NonNullable<ReturnType<typeof createAdminClient>>,
  table: string,
  filter?: (q: {
    eq: (k: string, v: string) => unknown;
    gte: (k: string, v: string) => unknown;
    lt: (k: string, v: string) => unknown;
  }) => unknown
): Promise<number> {
  // We use head + count for efficiency
  let q: ReturnType<typeof supabase.from> = supabase
    .from(table)
    .select("*", { count: "exact", head: true }) as unknown as ReturnType<typeof supabase.from>;
  if (filter)
    q = filter(
      q as unknown as {
        eq: (k: string, v: string) => unknown;
        gte: (k: string, v: string) => unknown;
        lt: (k: string, v: string) => unknown;
      }
    ) as ReturnType<typeof supabase.from>;
  const { count: c } = (await q) as unknown as CountResult;
  return c ?? 0;
}

/**
 * GET /api/bot/v1/stats — agregated dashboard counts.
 * No actor check (read-only metrics). Bearer-protected only.
 */
export async function GET(request: NextRequest) {
  const denied = assertBotAuth(request);
  if (denied) return denied;

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const now = new Date().toISOString();

  const [
    profiles_total,
    profiles_24h,
    admins,
    banned,
    articles_published,
    articles_draft,
    events_upcoming,
    events_past,
    team_members,
    discord_members,
  ] = await Promise.all([
    count(supabase, "profiles"),
    count(supabase, "profiles", (q) => q.gte("updated_at", yesterday)),
    count(supabase, "profiles", (q) => q.eq("role", "admin")),
    count(supabase, "profiles", (q) => q.eq("role", "banned")),
    count(supabase, "articles", (q) => q.eq("status", "published")),
    count(supabase, "articles", (q) => q.eq("status", "draft")),
    count(supabase, "events", (q) => q.gte("end_time", now)),
    count(supabase, "events", (q) => q.lt("end_time", now)),
    count(supabase, "team_members", (q) => q.eq("is_active", "true")),
    count(supabase, "discord_members", (q) => q.eq("is_bot", "false")),
  ]);

  return NextResponse.json(
    {
      profiles_total,
      profiles_24h,
      admins,
      banned,
      articles_published,
      articles_draft,
      events_upcoming,
      events_past,
      team_members,
      discord_members,
      generated_at: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        "cache-control": "private, max-age=30, s-maxage=30",
      },
    }
  );
}
