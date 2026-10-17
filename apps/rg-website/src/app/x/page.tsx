import Link from "next/link";

import { COMPTES_X, estCompteX, lireCompte } from "@/lib/x/live";
import type { XLive } from "@/lib/x/live";

import { FilX } from "./fil-x";
import { VARIABLES_X } from "./x-theme";

export const dynamic = "force-dynamic";

export const metadata = {
  alternates: { canonical: "/x" },
  description: "Les derniers posts de Rose Griffon, d'Achilléa et d'Azalée, relus en direct sur X.",
  title: "Nos comptes sur X",
};

const NOMS: Record<(typeof COMPTES_X)[number], string> = {
  Achillea_IE: "Achilléa",
  Azalee_IE: "Azalée",
  rose_griffon: "Rose Griffon",
};

export default async function PageX({ searchParams }: { searchParams: Promise<{ compte?: string }> }) {
  const { compte: demande } = await searchParams;
  const compte = demande && estCompteX(demande) ? demande : COMPTES_X[0];
  let initial: XLive | null = null;
  try {
    initial = await lireCompte(compte);
  } catch {
    // Le client retente seul ; la page reste utile sans les données du serveur.
  }
  return (
    <div className="min-h-full bg-[#000] px-0 sm:px-4" style={VARIABLES_X}>
      <div className="mx-auto min-h-screen w-full max-w-[600px] border-x border-[var(--x-border)] bg-[var(--x-bg)] font-sans text-[var(--x-text)]">
        <nav aria-label="Comptes" className="sticky top-14 z-10 flex border-b border-[var(--x-border)] bg-[var(--x-bg)]/85 backdrop-blur">
          {COMPTES_X.map(c => {
            const actif = c === compte;
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
        <FilX key={compte} compte={compte} initial={initial} />
      </div>
    </div>
  );
}
