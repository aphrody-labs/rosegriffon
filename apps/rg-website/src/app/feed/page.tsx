import { Search } from "lucide-react";
import Link from "next/link";

import { chercher, COMPTE_TOUS, COMPTES, COMPTES_X, estCompteX, lireCompte, lireFilGlobal } from "@/lib/feed/live";
import type { PageXPosts, XFilGlobal, XLive } from "@/lib/feed/live";

import { FilX, ResultatsRecherche } from "./fil-x";
import { VARIABLES_X } from "./x-theme";

export const dynamic = "force-dynamic";

export const metadata = {
  alternates: { canonical: "/feed" },
  description:
    "Le feed d'Inazuma Eleven : Rose Griffon, Achilléa, Azalée, les comptes officiels du jeu et LEVEL-5, relus en direct sur X.",
  title: "Feed Inazuma Eleven",
};

const ONGLET = "relative flex min-h-[53px] shrink-0 items-center justify-center px-4 text-[15px] leading-5 font-medium whitespace-nowrap text-[var(--x-muted)] transition-colors hover:bg-white/[0.03] aria-[current=page]:font-bold aria-[current=page]:text-[var(--x-text)]";

export default async function PageFeed({ searchParams }: { searchParams: Promise<{ compte?: string; q?: string }> }) {
  const { compte: demande, q: recherche } = await searchParams;
  const q = recherche?.trim().slice(0, 200) ?? "";
  const compte = demande && (estCompteX(demande) || demande === COMPTE_TOUS) ? demande : COMPTE_TOUS;

  let initialCompte: ((XLive & { next_cursor?: string }) | XFilGlobal) | null = null;
  let initialRecherche: PageXPosts | null = null;
  try {
    if (q) initialRecherche = await chercher(q);
    else initialCompte = compte === COMPTE_TOUS ? await lireFilGlobal() : await lireCompte(compte);
  } catch {
    // Le client retente seul ; la page reste utile sans les données du serveur.
  }

  return (
    <div className="min-h-full bg-[#000] px-0 sm:px-4" style={VARIABLES_X}>
      <div className="mx-auto min-h-screen w-full max-w-[600px] border-x border-[var(--x-border)] bg-[var(--x-bg)] text-[var(--x-text)]">
        <form action="/feed" role="search" className="border-b border-[var(--x-border)] px-4 py-2">
          <label htmlFor="feed-recherche" className="sr-only">
            Rechercher sur X
          </label>
          <div className="flex min-h-11 items-center gap-3 rounded-full bg-[#202327] px-4 focus-within:ring-1 focus-within:ring-[var(--x-link)]">
            <Search className="size-[18px] shrink-0 text-[var(--x-muted)]" aria-hidden />
            <input
              id="feed-recherche"
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Rechercher sur X"
              autoComplete="off"
              maxLength={200}
              className="min-w-0 flex-1 bg-transparent text-[15px] leading-5 text-[var(--x-text)] outline-none placeholder:text-[var(--x-muted)]"
            />
          </div>
        </form>
        <nav
          aria-label="Comptes"
          className="sticky top-14 z-10 flex overflow-x-auto border-b border-[var(--x-border)] bg-[var(--x-bg)]/85 backdrop-blur [scrollbar-width:none]"
        >
          <Link
            href="/feed"
            aria-current={!q && compte === COMPTE_TOUS ? "page" : undefined}
            className={ONGLET}
          >
            <span className="relative flex h-full items-center">
              Tout
              {!q && compte === COMPTE_TOUS && (
                <span className="absolute inset-x-0 bottom-0 h-1 rounded-full bg-[var(--x-link)]" />
              )}
            </span>
          </Link>
          {COMPTES.map(c => {
            const actif = !q && c.handle === compte;
            return (
              <Link
                key={c.handle}
                href={`/feed?compte=${c.handle}`}
                aria-current={actif ? "page" : undefined}
                title={`${c.groupe} · @${c.handle}`}
                className={ONGLET}
              >
                <span className="relative flex h-full items-center">
                  {c.nom}
                  {actif && <span className="absolute inset-x-0 bottom-0 h-1 rounded-full bg-[var(--x-link)]" />}
                </span>
              </Link>
            );
          })}
        </nav>
        {q ? (
          <>
            <h1 className="border-b border-[var(--x-border)] px-4 py-3 text-xl leading-6 font-extrabold">
              Résultats pour « {q} »
            </h1>
            <ResultatsRecherche key={q} q={q} initial={initialRecherche} />
          </>
        ) : (
          <FilX key={compte} compte={compte} initial={initialCompte} />
        )}
      </div>
    </div>
  );
}
