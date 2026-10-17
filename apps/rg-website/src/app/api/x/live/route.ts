import { NextResponse } from "next/server";

import { chercher, COMPTES_X, estCompteX, estIdPost, lireCompte, lireThread } from "@/lib/x/live";

export const dynamic = "force-dynamic";

const ENTETES = { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=60" };

/** `?compte=` profil + posts · `?q=` recherche · `?thread=` conversation ; `&cursor=` pour la page suivante. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const curseur = searchParams.get("cursor") ?? undefined;
  const q = searchParams.get("q");
  const thread = searchParams.get("thread");
  try {
    if (thread) {
      if (!estIdPost(thread)) return NextResponse.json({ error: "Identifiant de post invalide." }, { status: 400 });
      return NextResponse.json(await lireThread(thread, curseur), { headers: ENTETES });
    }
    if (q) return NextResponse.json(await chercher(q, 20, curseur), { headers: ENTETES });
    const compte = searchParams.get("compte") ?? COMPTES_X[0];
    if (!estCompteX(compte)) return NextResponse.json({ error: "Compte non pris en charge." }, { status: 400 });
    return NextResponse.json(await lireCompte(compte, 12, curseur), { headers: ENTETES });
  } catch {
    return NextResponse.json({ error: "X ne répond pas pour le moment." }, { status: 502 });
  }
}
