import { Search } from "lucide-react";
import Link from "next/link";

import { chercher, COMPTES_X, estCompteX, lireCompte } from "@/lib/x/live";
import type { PageXPosts, XLive } from "@/lib/x/live";

import { FilX, ResultatsRecherche } from "./fil-x";
import { VARIABLES_X } from "./x-theme";

export const dynamic = "force-dynamic";

export const metadata = {
  alternates: { canonical: "/x" },
  description: "Les posts de Rose Griffon, d'Achilléa et d'Azalée, et la recherche sur X, relus en direct.",
  title: "Nos comptes sur X",
};

const NOMS: Record<(typeof COMPTES_X)[number], string> = {
  Achillea_IE: "Achilléa",
  Azalee_IE: "Azalée",
  rose_griffon: "Rose Griffon",
};

export default async function PageX({ searchParams }: { searchParams: Promise<{ compte?: string; q?: string }> }) {
  const { compte: demande, q: recherche } = await searchParams;
  const q = recherche?.trim().slice(0, 200) ?? "";
  const compte = demande && estCompteX(demande) ? demande : COMPTES_X[0];

  let initialCompte: (XLive & { next_cursor?: string }) | null = null;
  let initialRecherche: PageXPosts | null = null;
  try {
    if (q) initialRecherche = await chercher(q);
    else initialCompte = await lireCompte(compte);
  } catch {
    // Le client retente seul ; la page reste utile sans les données du serveur.
  }

  return (
    <div className="min-h-full bg-[#000] px-0 sm:px-4" style={VARIABLES_X}>
      <div className="mx-auto min-h-screen w-full max-w-[600px] border-x border-[var(--x-border)] bg-[var(--x-bg)] text-[var(--x-text)]">
        <form action="/x" role="search" className="border-b border-[var(--x-border)] px-4 py-2">
          <label htmlFor="x-recherche" className="sr-only">
            Rechercher sur X
          </label>
          <div className="flex min-h-11 items-center gap-3 rounded-full bg-[#202327] px-4 focus-within:ring-1 focus-within:ring-[var(--x-link)]">
            <Search className="size-[18px] shrink-0 text-[var(--x-muted)]" aria-hidden />
            <input
              id="x-recherche"
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
          className="sticky top-14 z-10 flex border-b border-[var(--x-border)] bg-[var(--x-bg)]/85 backdrop-blur"
        >
          {COMPTES_X.map(c => {
            const actif = !q && c === compte;
            return (
              <Link
                key={c}
                href={`/x?compte=${c}`}
                aria-current={actif ? "page" : undefined}
                className="relative flex min-h-[53px] flex-1 items-center justify-center text-[15px] leading-5 font-medium text-[var(--x-muted)] transition-colors hover:bg-white/[0.03] aria-[current=page]:font-bold aria-[current=page]:text-[var(--x-text)]"
              >
                <span className="relative flex h-full items-center">
                  {NOMS[c]}
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
