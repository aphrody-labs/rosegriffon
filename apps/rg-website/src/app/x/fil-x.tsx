"use client";

import { BadgeCheck, CalendarDays, Link2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { PageXPosts, XLive, XProfil, XTweet } from "@/lib/x/live";

import { entier, Post, SquelettePosts, TexteAvecLiens } from "./x-composants";

const INTERVALLE_MS = 30_000;

interface Page extends PageXPosts {
  profil?: XProfil;
}

/**
 * Liste paginée : la première page vient du serveur (ou se charge seule), « la suite » se charge
 * quand le bas de liste approche, et `rafraichir` ramène en tête les posts parus entre-temps.
 */
function useListe(url: string, initial: Page | null, rafraichir: boolean) {
  const [posts, setPosts] = useState<XTweet[]>(initial?.tweets ?? []);
  const [profil, setProfil] = useState<XProfil | undefined>(initial?.profil);
  const [curseur, setCurseur] = useState<string | undefined>(initial?.next_cursor);
  const [charge, setCharge] = useState(initial !== null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState(false);
  const sentinelle = useRef<HTMLDivElement | null>(null);

  const lire = useCallback(
    async (cur?: string): Promise<Page> => {
      const reponse = await fetch(`${url}${cur ? `&cursor=${encodeURIComponent(cur)}` : ""}`, { cache: "no-store" });
      if (!reponse.ok) throw new Error(String(reponse.status));
      return (await reponse.json()) as Page;
    },
    [url],
  );

  const suite = useCallback(async () => {
    if (chargement || !curseur) return;
    setChargement(true);
    try {
      const page = await lire(curseur);
      setPosts(actuels => {
        const vus = new Set(actuels.map(p => p.id));
        return [...actuels, ...page.tweets.filter(p => !vus.has(p.id))];
      });
      setCurseur(page.next_cursor);
      setErreur(false);
    } catch {
      setErreur(true);
    } finally {
      setChargement(false);
    }
  }, [chargement, curseur, lire]);

  useEffect(() => {
    let actif = true;
    const premiere = async () => {
      try {
        const page = await lire();
        if (!actif) return;
        setPosts(page.tweets);
        setCurseur(page.next_cursor);
        if (page.profil) setProfil(page.profil);
        setErreur(false);
      } catch {
        if (actif) setErreur(true);
      } finally {
        if (actif) setCharge(true);
      }
    };
    if (initial === null) void premiere();
    if (!rafraichir) return () => void (actif = false);
    const minuteur = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const page = await lire();
        if (!actif) return;
        if (page.profil) setProfil(page.profil);
        setPosts(actuels => {
          const vus = new Set(actuels.map(p => p.id));
          const nouveaux = page.tweets.filter(p => !vus.has(p.id));
          return nouveaux.length > 0 ? [...nouveaux, ...actuels] : actuels;
        });
        setErreur(false);
      } catch {
        // La liste affichée reste valable ; le prochain passage retentera.
      }
    }, INTERVALLE_MS);
    return () => {
      actif = false;
      clearInterval(minuteur);
    };
  }, [initial, lire, rafraichir]);

  useEffect(() => {
    const noeud = sentinelle.current;
    if (!noeud || !curseur) return;
    const observateur = new IntersectionObserver(entrees => entrees[0]?.isIntersecting && void suite(), {
      rootMargin: "600px",
    });
    observateur.observe(noeud);
    return () => observateur.disconnect();
  }, [curseur, suite]);

  return { posts, profil, curseur, charge, chargement, erreur, sentinelle, suite };
}

function ListePosts({
  liste,
  profil,
  vide,
}: {
  liste: ReturnType<typeof useListe>;
  profil?: XProfil;
  vide: string;
}) {
  const { posts, curseur, charge, chargement, erreur, sentinelle, suite } = liste;
  if (!charge && posts.length === 0)
    return erreur ? <Erreur /> : <SquelettePosts />;
  if (posts.length === 0)
    return erreur ? (
      <Erreur />
    ) : (
      <p className="p-8 text-center text-[15px] leading-5 text-[var(--x-muted)]">{vide}</p>
    );
  return (
    <div>
      {posts.map(post => (
        <Post key={post.id} post={post} profil={profil} />
      ))}
      {curseur && (
        <div ref={sentinelle}>
          {chargement ? (
            <SquelettePosts nombre={2} />
          ) : (
            <button
              type="button"
              onClick={() => void suite()}
              className="min-h-[53px] w-full text-[15px] text-[var(--x-link)] hover:bg-white/[0.03]"
            >
              {erreur ? "Réessayer" : "Afficher plus de posts"}
            </button>
          )}
        </div>
      )}
      <p className="sr-only" role="status">
        {posts.length} posts affichés
      </p>
    </div>
  );
}

function Erreur() {
  return (
    <p role="alert" className="p-8 text-center text-[15px] leading-5 text-[var(--x-muted)]">
      X ne répond pas pour le moment. Nouvel essai dans quelques secondes.
    </p>
  );
}

function EnTete({ profil }: { profil: XProfil }) {
  const rejoint = profil.rejointLe
    ? new Date(profil.rejointLe).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
    : null;
  return (
    <section aria-label={`Profil de ${profil.name}`}>
      <div className="aspect-[3/1] w-full bg-[#333639]">
        {profil.banner && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profil.banner} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
        )}
      </div>
      <div className="px-4 pb-3">
        <div className="-mt-[calc(min(15%,134px)/2)] mb-3 w-[25%] max-w-[134px] min-w-[72px]">
          {profil.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profil.avatar}
              alt={profil.name}
              referrerPolicy="no-referrer"
              className="aspect-square w-full rounded-full border-4 border-[var(--x-bg)] bg-[var(--x-border)] object-cover"
            />
          ) : (
            <span className="block aspect-square w-full rounded-full border-4 border-[var(--x-bg)] bg-[var(--x-border)]" />
          )}
        </div>
        <h1 className="flex items-center gap-1 text-xl leading-6 font-extrabold text-[var(--x-text)]">
          {profil.name}
          {profil.certifie && <BadgeCheck className="size-5 fill-[var(--x-link)] text-black" aria-label="Compte certifié" />}
        </h1>
        <p className="text-[15px] leading-5 text-[var(--x-muted)]">@{profil.screen_name}</p>
        {profil.description && (
          <p className="mt-3 text-[15px] leading-5 whitespace-pre-line text-[var(--x-text)]">
            <TexteAvecLiens texte={profil.description} />
          </p>
        )}
        <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] leading-5 text-[var(--x-muted)]">
          {profil.site && (
            <a
              href={profil.site.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[var(--x-link)] hover:underline"
            >
              <Link2 className="size-[18px] text-[var(--x-muted)]" aria-hidden />
              {profil.site.affichage}
            </a>
          )}
          {rejoint && (
            <span className="flex items-center gap-1">
              <CalendarDays className="size-[18px]" aria-hidden />A rejoint X en {rejoint}
            </span>
          )}
        </p>
        <p className="mt-3 flex gap-5 text-[15px] leading-5 text-[var(--x-muted)]">
          <span>
            <b className="font-bold text-[var(--x-text)]">{entier.format(profil.following ?? 0)}</b> abonnements
          </span>
          <span>
            <b className="font-bold text-[var(--x-text)]">{entier.format(profil.followers ?? 0)}</b> abonnés
          </span>
        </p>
      </div>
    </section>
  );
}

/** Profil d'un compte officiel et son fil, en direct. */
export function FilX({ compte, initial }: { compte: string; initial: (XLive & { next_cursor?: string }) | null }) {
  const liste = useListe(`/api/x/live?compte=${compte}`, initial, true);
  return (
    <>
      {liste.profil ? <EnTete profil={liste.profil} /> : <div className="aspect-[3/1] w-full bg-[#333639]" aria-hidden />}
      <div className="border-t border-[var(--x-border)]">
        <ListePosts liste={liste} profil={liste.profil} vide="Aucun post à afficher pour le moment." />
      </div>
    </>
  );
}

/** Résultats de recherche (posts les plus récents sur X). */
export function ResultatsRecherche({ q, initial }: { q: string; initial: PageXPosts | null }) {
  const liste = useListe(`/api/x/live?q=${encodeURIComponent(q)}`, initial, false);
  return <ListePosts liste={liste} vide={`Aucun résultat pour « ${q} ».`} />;
}

/** Un post et ses réponses. */
export function FilThread({ id, initial }: { id: string; initial: PageXPosts | null }) {
  const liste = useListe(`/api/x/live?thread=${id}`, initial, false);
  return <ListePosts liste={liste} vide="Ce post est introuvable ou n'est plus visible." />;
}
