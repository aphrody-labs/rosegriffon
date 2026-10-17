"use client";

import { ArrowUp, BadgeCheck, CalendarDays, ExternalLink, Link2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { MARQUES } from "@/lib/feed/comptes";
import type { FiltreFil } from "@/lib/feed/comptes";
import type { CompteSource, PostFeed, ProfilFeed, StatutSource } from "@/lib/feed/types";

import { CartePost, entier, SquelettePosts, TexteAvecLiens } from "./carte-post";
import { BadgeReseau } from "./marque";

const INTERVALLE_MS = 30_000;
const SEUIL_DEFILEMENT = 160;

export interface PageFeed {
  posts: PostFeed[];
  profils?: Record<string, ProfilFeed>;
  sources?: StatutSource[];
  curseur?: string;
}

type Ordre = "date" | "serveur";

const parDate = (a: PostFeed, b: PostFeed) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id);

function fusionnerListe(actuels: PostFeed[], ajouts: PostFeed[], ordre: Ordre, enTete = false): PostFeed[] {
  const vus = new Set(actuels.map(p => p.id));
  const nouveaux = ajouts.filter(p => !vus.has(p.id) && vus.add(p.id));
  if (nouveaux.length === 0) return actuels;
  const liste = enTete ? [...nouveaux, ...actuels] : [...actuels, ...nouveaux];
  return ordre === "date" ? liste.sort(parDate) : liste;
}

/**
 * Liste paginée alimentée par l'API : la première page vient du serveur (ou se charge seule),
 * la suite se charge quand le bas de liste approche. Quand `rafraichir` est actif, la page 1 est
 * relue toutes les 30 s ; les posts parus entre-temps arrivent d'eux-mêmes en tête si on est en
 * haut de page, sinon derrière un bouton (pas de saut de contenu pendant la lecture).
 */
function useListe(url: string, initial: PageFeed | null, rafraichir: boolean, ordre: Ordre) {
  const [posts, setPosts] = useState<PostFeed[]>(initial?.posts ?? []);
  const [profils, setProfils] = useState<Record<string, ProfilFeed>>(initial?.profils ?? {});
  const [sources, setSources] = useState<StatutSource[]>(initial?.sources ?? []);
  const [curseur, setCurseur] = useState<string | undefined>(initial?.curseur);
  const [enAttente, setEnAttente] = useState<PostFeed[]>([]);
  const [charge, setCharge] = useState(initial !== null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState(false);
  const sentinelle = useRef<HTMLDivElement | null>(null);
  const postsRef = useRef(posts);
  useEffect(() => {
    postsRef.current = posts;
  }, [posts]);

  const lire = useCallback(
    async (cur?: string): Promise<PageFeed> => {
      const sep = url.includes("?") ? "&" : "?";
      const reponse = await fetch(`${url}${cur ? `${sep}cursor=${encodeURIComponent(cur)}` : ""}`, { cache: "no-store" });
      if (!reponse.ok) throw new Error(String(reponse.status));
      return (await reponse.json()) as PageFeed;
    },
    [url],
  );

  const suite = useCallback(async () => {
    if (chargement || !curseur) return;
    setChargement(true);
    try {
      const page = await lire(curseur);
      setPosts(actuels => fusionnerListe(actuels, page.posts, ordre));
      if (page.profils) setProfils(p => ({ ...p, ...page.profils }));
      setCurseur(page.curseur);
      setErreur(false);
    } catch {
      setErreur(true);
    } finally {
      setChargement(false);
    }
  }, [chargement, curseur, lire, ordre]);

  const afficherNouveaux = useCallback(() => {
    setPosts(actuels => fusionnerListe(actuels, enAttente, ordre, true));
    setEnAttente([]);
  }, [enAttente, ordre]);

  useEffect(() => {
    let actif = true;
    const appliquer = (page: PageFeed, premiere: boolean) => {
      if (page.profils) setProfils(p => ({ ...p, ...page.profils }));
      if (page.sources) setSources(page.sources);
      if (premiere) {
        setPosts(page.posts);
        setCurseur(page.curseur);
        return;
      }
      const actuels = postsRef.current;
      const plusAncien = actuels.length > 0 ? actuels[actuels.length - 1]!.date : "";
      const vus = new Set(actuels.map(p => p.id));
      // Un post plus ancien que le bas de liste appartient à la suite, pas aux nouveautés.
      const nouveaux = page.posts.filter(p => !vus.has(p.id) && p.date > plusAncien);
      if (nouveaux.length === 0) return;
      if (window.scrollY < SEUIL_DEFILEMENT) setPosts(a => fusionnerListe(a, nouveaux, ordre, true));
      else setEnAttente(a => fusionnerListe(a, nouveaux, "date"));
    };
    const premiere = async () => {
      try {
        appliquer(await lire(), true);
        if (actif) setErreur(false);
      } catch {
        if (actif) setErreur(true);
      } finally {
        if (actif) setCharge(true);
      }
    };
    if (initial === null) void premiere();
    if (!rafraichir) return () => void (actif = false);
    const relire = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const page = await lire();
        if (actif) appliquer(page, false);
      } catch {
        // La liste affichée reste valable ; le prochain passage retentera.
      }
    };
    const minuteur = setInterval(relire, INTERVALLE_MS);
    document.addEventListener("visibilitychange", relire);
    return () => {
      actif = false;
      clearInterval(minuteur);
      document.removeEventListener("visibilitychange", relire);
    };
  }, [initial, lire, ordre, rafraichir]);

  useEffect(() => {
    const noeud = sentinelle.current;
    if (!noeud || !curseur) return;
    const observateur = new IntersectionObserver(entrees => entrees[0]?.isIntersecting && void suite(), {
      rootMargin: "600px",
    });
    observateur.observe(noeud);
    return () => observateur.disconnect();
  }, [curseur, suite]);

  return { posts, profils, sources, curseur, enAttente, afficherNouveaux, charge, chargement, erreur, sentinelle, suite };
}

const BOUTON =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-outline-variant bg-surface-container px-5 text-sm font-medium text-on-surface hover:bg-surface-container-high";

function Message({ children, alerte = false }: { children: React.ReactNode; alerte?: boolean }) {
  return (
    <p
      role={alerte ? "alert" : "status"}
      className="rounded-2xl border border-outline-variant bg-surface-container-low p-6 text-center text-sm leading-6 text-on-surface-variant"
    >
      {children}
    </p>
  );
}

function NotesSources({ sources, filtre, vide }: { sources: StatutSource[]; filtre?: FiltreFil; vide: boolean }) {
  const notes = sources.filter(
    s => s.message && (s.etat === "indisponible" || (s.etat === "vide" && (filtre?.reseau === s.reseau || vide))),
  );
  if (notes.length === 0) return null;
  return (
    <ul className="mb-3 space-y-2">
      {notes.map(s => (
        <li
          key={s.reseau}
          className="flex items-start gap-3 rounded-2xl border border-outline-variant bg-surface-container-low p-3 text-sm leading-5 text-on-surface-variant"
        >
          <BadgeReseau reseau={s.reseau} taille={22} />
          <span>{s.message}</span>
        </li>
      ))}
    </ul>
  );
}

function ListePosts({
  liste,
  vide,
  filtre,
  messageErreur,
}: {
  liste: ReturnType<typeof useListe>;
  vide: string;
  filtre?: FiltreFil;
  messageErreur: string;
}) {
  const { posts, profils, sources, curseur, enAttente, afficherNouveaux, charge, chargement, erreur, sentinelle, suite } = liste;
  if (!charge && posts.length === 0) return erreur ? <Message alerte>{messageErreur}</Message> : <SquelettePosts />;
  return (
    <div>
      {enAttente.length > 0 && (
        <output className="sticky top-16 z-10 mb-3 flex justify-center">
          <button
            type="button"
            onClick={() => {
              afficherNouveaux();
              window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
            }}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-on-primary shadow-lg"
          >
            <ArrowUp className="size-4" aria-hidden />
            {enAttente.length > 1 ? `${enAttente.length} nouveaux posts` : "1 nouveau post"}
          </button>
        </output>
      )}
      <NotesSources sources={sources} filtre={filtre} vide={posts.length === 0} />
      {posts.length === 0 ? (
        erreur ? (
          <Message alerte>{messageErreur}</Message>
        ) : (
          <Message>{vide}</Message>
        )
      ) : (
        <div className="space-y-3">
          {posts.map(post => (
            <CartePost key={post.id} post={post} profils={profils} />
          ))}
        </div>
      )}
      {curseur && (
        <div ref={sentinelle} className="mt-3 min-h-[184px]">
          {chargement ? (
            <SquelettePosts nombre={1} />
          ) : (
            <button type="button" onClick={() => void suite()} className={`${BOUTON} w-full`}>
              {erreur ? "Réessayer" : "Afficher plus de posts"}
            </button>
          )}
        </div>
      )}
      <output className="sr-only">{posts.length} posts affichés</output>
    </div>
  );
}

function EnteteProfil({ compte, profil }: { compte: CompteSource; profil?: ProfilFeed }) {
  const marque = MARQUES[compte.reseau];
  const nom = profil?.nom ?? compte.nom;
  const rejoint = profil?.rejointLe
    ? new Date(profil.rejointLe).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
    : null;
  return (
    <section
      aria-label={`Profil de ${nom}`}
      className="mb-3 overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-low"
    >
      <div className="aspect-[3/1] w-full bg-gradient-to-br from-rg-marine to-rg-marine-clair">
        {profil?.banniere && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profil.banniere} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
        )}
      </div>
      <div className="px-4 pb-4">
        <div className="-mt-9 mb-3 flex items-end justify-between gap-3">
          {profil?.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profil.avatar}
              alt=""
              width={72}
              height={72}
              referrerPolicy="no-referrer"
              className="size-[72px] rounded-full border-4 border-surface-container-low bg-surface-container-high object-cover"
            />
          ) : (
            <span
              aria-hidden
              className="flex size-[72px] items-center justify-center rounded-full border-4 border-surface-container-low bg-primary-container text-2xl font-bold text-on-primary-container"
            >
              {nom.charAt(0).toUpperCase()}
            </span>
          )}
          <a
            href={profil?.lien ?? marque.lien(compte.pseudo)}
            target="_blank"
            rel="noopener noreferrer"
            className={`${BOUTON} gap-2`}
          >
            Ouvrir sur {marque.nom}
            <ExternalLink className="size-4" aria-hidden />
          </a>
        </div>
        <h1 className="flex items-center gap-2 text-xl leading-6 font-extrabold text-on-surface">
          {nom}
          {profil?.certifie && <BadgeCheck className="size-5 text-info" aria-label="Compte certifié" />}
        </h1>
        <p className="flex items-center gap-2 text-sm text-on-surface-variant">
          <BadgeReseau reseau={compte.reseau} taille={18} />@{profil?.pseudo ?? compte.pseudo} · {compte.groupe}
        </p>
        {profil?.bio && (
          <p className="mt-3 text-[15px] leading-6 whitespace-pre-line text-on-surface">
            <TexteAvecLiens texte={profil.bio} reseau={compte.reseau} />
          </p>
        )}
        <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-on-surface-variant">
          {profil?.site && (
            <a
              href={profil.site.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-11 items-center gap-1 text-primary hover:underline"
            >
              <Link2 className="size-[18px]" aria-hidden />
              {profil.site.affichage}
            </a>
          )}
          {rejoint && (
            <span className="flex items-center gap-1">
              <CalendarDays className="size-[18px]" aria-hidden />
              Inscrit en {rejoint}
            </span>
          )}
        </p>
        {(profil?.abonnes != null || profil?.abonnements != null || profil?.publications != null) && (
          <p className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-on-surface-variant">
            {profil.abonnements != null && (
              <span>
                <b className="font-bold text-on-surface">{entier.format(profil.abonnements)}</b> abonnements
              </span>
            )}
            {profil.abonnes != null && (
              <span>
                <b className="font-bold text-on-surface">{entier.format(profil.abonnes)}</b> abonnés
              </span>
            )}
            {profil.publications != null && (
              <span>
                <b className="font-bold text-on-surface">{entier.format(profil.publications)}</b> publications
              </span>
            )}
          </p>
        )}
      </div>
    </section>
  );
}

/** Fil unifié (ou d'un compte) en direct. `url` porte déjà le filtre. */
export function FilFeed({
  url,
  filtre,
  compte,
  initial,
}: {
  url: string;
  filtre: FiltreFil;
  compte?: CompteSource;
  initial: PageFeed | null;
}) {
  const liste = useListe(url, initial, true, "date");
  const profil = compte ? liste.profils[`${compte.reseau}:${compte.pseudo.toLowerCase()}`] : undefined;
  return (
    <>
      {compte && <EnteteProfil compte={compte} profil={profil} />}
      <ListePosts
        liste={liste}
        filtre={filtre}
        vide="Aucun post à afficher pour le moment."
        messageErreur="Le fil ne répond pas pour le moment. Nouvel essai dans quelques secondes."
      />
    </>
  );
}

/** Résultats de recherche (posts les plus récents sur X). */
export function ResultatsRecherche({ q, initial }: { q: string; initial: PageFeed | null }) {
  const liste = useListe(`/api/feed/live?q=${encodeURIComponent(q)}`, initial, false, "serveur");
  return (
    <ListePosts
      liste={liste}
      vide={`Aucun résultat pour « ${q} ».`}
      messageErreur="La recherche ne répond pas pour le moment."
    />
  );
}

/** Un post X et ses réponses. */
export function FilThread({ id, initial }: { id: string; initial: PageFeed | null }) {
  const liste = useListe(`/api/feed/live?thread=${id}`, initial, false, "serveur");
  return (
    <ListePosts
      liste={liste}
      vide="Ce post est introuvable ou n'est plus visible."
      messageErreur="La conversation ne répond pas pour le moment."
    />
  );
}
