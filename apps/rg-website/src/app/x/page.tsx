import { Twitter } from "@/lib/brand-icons";
import Link from "next/link";

import { COMPTES_X, estCompteX, lireCompte } from "@/lib/x/live";
import type { XLive } from "@/lib/x/live";
import { PageHero } from "@/components/shared/PageShell";

import { FilX } from "./fil-x";

export const dynamic = "force-dynamic";

export const metadata = {
  alternates: { canonical: "/x" },
  description: "Les derniers posts d'Azalée, d'Achilléa et de Rose Griffon sur X, relus en direct sur X.",
  title: "Nos comptes sur X",
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
    <>
      <PageHero
        eyebrow={`@${compte}`}
        icon={<Twitter className="size-4" aria-hidden />}
        title="Nos comptes sur X"
        description="Les posts s'affichent tels que X les sert à l'instant, sans copie intermédiaire."
      />
      <main className="mx-auto w-full max-w-3xl px-4 pb-16 sm:px-6 lg:px-8">
        <nav aria-label="Comptes" className="mb-4 flex flex-wrap gap-2">
          {COMPTES_X.map(c => (
            <Link
              key={c}
              href={`/x?compte=${c}`}
              aria-current={c === compte ? "page" : undefined}
              className="inline-flex min-h-11 items-center rounded-full border border-border px-4 text-sm aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
            >
              @{c}
            </Link>
          ))}
        </nav>
        <FilX key={compte} compte={compte} initial={initial} />
      </main>
    </>
  );
}
