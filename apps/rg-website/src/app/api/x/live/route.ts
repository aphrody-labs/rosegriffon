import { NextResponse } from "next/server";

import { chercher, COMPTES_X, estCompteX, lireCompte } from "@/lib/x/live";

export const dynamic = "force-dynamic";

const ENTETES = { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=60" };

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  try {
    if (q) return NextResponse.json({ tweets: await chercher(q) }, { headers: ENTETES });
    const compte = searchParams.get("compte") ?? COMPTES_X[0];
    if (!estCompteX(compte)) return NextResponse.json({ error: "Compte non pris en charge." }, { status: 400 });
    return NextResponse.json(await lireCompte(compte), { headers: ENTETES });
  } catch {
    return NextResponse.json({ error: "X ne répond pas pour le moment." }, { status: 502 });
  }
}
