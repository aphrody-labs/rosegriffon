import { Search } from "lucide-react";

import { comptesDuFiltre, lireFiltre, parametresDuFiltre } from "@/lib/feed/comptes";
import { lireFil, rechercherX } from "@/lib/feed";

import { Filtres } from "./filtres";
import { FilFeed, ResultatsRecherche } from "./fil-feed";
import type { PageFeed } from "./fil-feed";

export const dynamic = "force-dynamic";

export const metadata = {
  alternates: { canonical: "/feed" },
  description:
    "Le feed d'Inazuma Eleven en direct : X, Instagram, TikTok et YouTube de Rose Griffon, Achilléa, Azalée, des comptes officiels du jeu et de LEVEL-5.",
  title: "Feed Inazuma Eleven",
};

export default async function PageFeedInazuma({
  searchParams,
}: {
  searchParams: Promise<{ reseau?: string; groupe?: string; compte?: string; q?: string }>;
}) {
  const brut = await searchParams;
  const q = brut.q?.trim().slice(0, 200) ?? "";
  const filtre = lireFiltre({ get: nom => (nom in brut ? ((brut as Record<string, string | undefined>)[nom] ?? null) : null) });
  const compte = filtre.compte ? comptesDuFiltre(filtre)[0] : undefined;

  let initial: PageFeed | null = null;
  try {
    initial = q ? await rechercherX(q) : await lireFil(filtre);
  } catch {
    // Le client retente seul ; la page reste utile sans les données du serveur.
  }

  const parametres = parametresDuFiltre(filtre);
  return (
    <div className="min-h-full bg-background px-3 pt-4 pb-24 text-on-surface sm:px-4 lg:pb-4">
      <div className="mx-auto w-full max-w-[640px]">
        {!compte && (
          <header className="mb-4">
            <h1 className="text-2xl leading-8 font-extrabold text-on-surface">Feed Inazuma Eleven</h1>
            <p className="text-sm leading-6 text-on-surface-variant">
              Rose Griffon, les comptes officiels du jeu et LEVEL-5, sur X, Instagram, TikTok et YouTube.
            </p>
          </header>
        )}
        <search className="mb-3 block"><form action="/feed">
          <label htmlFor="feed-recherche" className="sr-only">
            Rechercher sur X
          </label>
          <div className="flex min-h-11 items-center gap-3 rounded-full border border-outline-variant bg-surface-container px-4 focus-within:ring-2 focus-within:ring-primary">
            <Search className="size-[18px] shrink-0 text-on-surface-variant" aria-hidden />
            <input
              id="feed-recherche"
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Rechercher sur X"
              autoComplete="off"
              maxLength={200}
              className="min-h-11 min-w-0 flex-1 bg-transparent text-[15px] text-on-surface outline-none placeholder:text-on-surface-variant"
            />
          </div>
        </form></search>
        <div className="mb-4">
          <Filtres filtre={filtre} />
        </div>
        {q ? (
          <>
            <h2 className="mb-3 text-lg leading-6 font-bold text-on-surface">Résultats pour « {q} » sur X</h2>
            <ResultatsRecherche key={q} q={q} initial={initial} />
          </>
        ) : (
          <FilFeed
            key={parametres}
            url={`/api/feed/live${parametres ? `?${parametres}` : ""}`}
            filtre={filtre}
            compte={compte}
            initial={initial}
          />
        )}
        <details className="mt-6 rounded-2xl border border-outline-variant bg-surface-container-low text-sm leading-6 text-on-surface-variant">
          <summary className="flex min-h-11 cursor-pointer items-center px-4 font-medium text-on-surface">
            À propos des sources
          </summary>
          <div className="space-y-2 px-4 pb-4">
            <p>X est relu en direct toutes les 30 secondes : profils, fils, recherche et conversations.</p>
            <p>
              YouTube (flux public des chaînes), TikTok (les dernières vidéos publiques) et Instagram (la grille publique
              des profils) sont synchronisés en tâche de fond toutes les 30 minutes. Sans connexion, TikTok et Instagram
              se limitent à leurs publications les plus récentes, sans likes ni commentaires pour Instagram.
            </p>
            <p>
              Aucun compte officiel d&apos;Inazuma Eleven ou de LEVEL-5 n&apos;est référencé sur Instagram ni TikTok ; leurs
              vidéos officielles sont sur la chaîne YouTube LEVEL5ch.
            </p>
          </div>
        </details>
      </div>
    </div>
  );
}
