import { NextResponse } from "next/server";

import { lireFiltre } from "@/lib/feed/comptes";
import { conversationX, estIdPost, lireFil, rechercherX } from "@/lib/feed";

export const dynamic = "force-dynamic";

const ENTETES = { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=60" };

/**
 * Fil unifié : `?reseau=` `&groupe=` `&compte=` filtrent, `&cursor=` pagine.
 * `?q=` recherche sur X, `?thread=` ouvre la conversation d'un post X.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const curseur = searchParams.get("cursor") ?? undefined;
  const q = searchParams.get("q");
  const thread = searchParams.get("thread");
  try {
    if (thread) {
      if (!estIdPost(thread)) return NextResponse.json({ error: "Identifiant de post invalide." }, { status: 400 });
      return NextResponse.json(await conversationX(thread, curseur), { headers: ENTETES });
    }
    if (q) return NextResponse.json(await rechercherX(q.trim().slice(0, 200), curseur), { headers: ENTETES });
    return NextResponse.json(await lireFil(lireFiltre(searchParams), curseur), { headers: ENTETES });
  } catch {
    return NextResponse.json({ error: "Le fil ne répond pas pour le moment." }, { status: 502 });
  }
}
