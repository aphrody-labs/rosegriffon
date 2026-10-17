import { Twitter } from "@/lib/brand-icons";
import { lireCompte } from "@/lib/x/live";
import type { XLive } from "@/lib/x/live";
import { PageHero } from "@/components/shared/PageShell";

import { FilX } from "./fil-x";

export const dynamic = "force-dynamic";

export const metadata = {
  alternates: { canonical: "/x" },
  description: "Les derniers posts d'Azalée sur X, relus en direct sur X.",
  title: "Azalée sur X",
};

export default async function PageX() {
  let initial: XLive | null = null;
  try {
    initial = await lireCompte("Azalee_IE");
  } catch {
    // Le client retente seul ; la page reste utile sans les données du serveur.
  }
  return (
    <>
      <PageHero
        eyebrow="@Azalee_IE"
        icon={<Twitter className="size-4" aria-hidden />}
        title="Azalée sur X"
        description="Les posts s'affichent tels que X les sert à l'instant, sans copie intermédiaire."
      />
      <main className="mx-auto w-full max-w-3xl px-4 pb-16 sm:px-6 lg:px-8">
        <FilX initial={initial} />
      </main>
    </>
  );
}
