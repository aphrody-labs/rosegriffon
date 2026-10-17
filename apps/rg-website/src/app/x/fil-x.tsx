"use client";

import { BadgeCheck, CalendarDays, ChartNoAxesColumn, Heart, Link2, MessageCircle, Repeat2 } from "lucide-react";
import { Fragment, useEffect, useState } from "react";

import type { XLive, XProfil, XTweet } from "@/lib/x/live";

const INTERVALLE_MS = 30_000;
const SEUIL_LONG = 420;
const MOTIF_TCO = /(https:\/\/t\.co\/\w+)/g;
const MOTIF_TCO_SEUL = /^https:\/\/t\.co\/\w+$/;

const compact = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });
const entier = new Intl.NumberFormat("fr-FR");

function dateCourte(valeur: string): string {
  const date = new Date(valeur);
  if (Number.isNaN(date.getTime())) return "";
  const meme = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString("fr-FR", meme ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" });
}

function TexteAvecLiens({ texte }: { texte: string }) {
  return (
    <>
      {texte.split(MOTIF_TCO).map((morceau, i) =>
        MOTIF_TCO_SEUL.test(morceau) ? (
          <a
            key={i}
            href={morceau}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--x-link)] hover:underline"
          >
            {morceau.replace("https://", "")}
          </a>
        ) : (
          <Fragment key={i}>{morceau}</Fragment>
        ),
      )}
    </>
  );
}

function Compteur({
  icone: Icone,
  libelle,
  valeur,
  survol,
}: {
  icone: typeof Heart;
  libelle: string;
  valeur?: number;
  survol: string;
}) {
  return (
    <span
      className={`group/c flex min-h-11 items-center gap-1 text-[13px] leading-4 text-[var(--x-muted)] ${survol}`}
      title={`${valeur != null ? entier.format(valeur) : 0} ${libelle}`}
    >
      <Icone className="size-[18px]" aria-hidden />
      <span className="tabular-nums">{valeur ? compact.format(valeur) : ""}</span>
      <span className="sr-only">{libelle}</span>
    </span>
  );
}

function Avatar({ profil, taille }: { profil: Pick<XProfil, "avatar" | "name">; taille: number }) {
  return profil.avatar ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={profil.avatar}
      alt=""
      width={taille}
      height={taille}
      referrerPolicy="no-referrer"
      className="shrink-0 rounded-full bg-[var(--x-border)] object-cover"
      style={{ width: taille, height: taille }}
    />
  ) : (
    <span className="shrink-0 rounded-full bg-[var(--x-border)]" style={{ width: taille, height: taille }} />
  );
}

function Medias({ post, citation = false }: { post: XTweet; citation?: boolean }) {
  const medias = post.media?.filter(m => m.preview_url || m.url) ?? [];
  if (medias.length === 0) return null;
  const grille = medias.length === 1 ? "grid-cols-1" : "grid-cols-2";
  return (
    <div
      className={`mt-3 grid ${grille} gap-0.5 overflow-hidden rounded-2xl border border-[var(--x-border)] ${citation ? "" : ""}`}
    >
      {medias.slice(0, 4).map(m => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={m.url}
          src={m.preview_url ?? m.url}
          alt=""
          width={m.width}
          height={m.height}
          loading="lazy"
          referrerPolicy="no-referrer"
          className={`w-full object-cover ${medias.length === 1 ? "max-h-[510px]" : "aspect-square"}`}
        />
      ))}
    </div>
  );
}

function Citation({ post }: { post: XTweet }) {
  return (
    <a
      href={`https://x.com/${post.author.username}/status/${post.id}`}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-3 block overflow-hidden rounded-2xl border border-[var(--x-border)] p-3 hover:bg-white/[0.03]"
    >
      <p className="flex flex-wrap items-baseline gap-x-1 text-[15px] leading-5">
        <span className="font-bold text-[var(--x-text)]">{post.author.name}</span>
        <span className="text-[var(--x-muted)]">@{post.author.username}</span>
      </p>
      <p className="mt-0.5 line-clamp-4 whitespace-pre-line break-words text-[15px] leading-5 text-[var(--x-text)]">
        {post.text}
      </p>
      <Medias post={post} citation />
    </a>
  );
}

function Post({ post, profil }: { post: XTweet; profil: XProfil }) {
  const [deplie, setDeplie] = useState(false);
  const long = post.text.length > SEUIL_LONG;
  return (
    <article className="flex gap-3 border-b border-[var(--x-border)] px-4 pt-3 pb-1 transition-colors hover:bg-[var(--x-hover)]">
      <Avatar profil={profil} taille={40} />
      <div className="min-w-0 flex-1">
        <header className="flex min-w-0 items-baseline gap-x-1 text-[15px] leading-5">
          <span className="truncate font-bold text-[var(--x-text)]">{post.author.name}</span>
          {profil.certifie && <BadgeCheck className="size-[18px] shrink-0 self-center fill-[var(--x-link)] text-black" aria-label="Compte certifié" />}
          <span className="shrink-0 text-[var(--x-muted)]">@{post.author.username}</span>
          <span aria-hidden className="text-[var(--x-muted)]">
            ·
          </span>
          <a
            href={`https://x.com/${post.author.username}/status/${post.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-[var(--x-muted)] hover:underline"
          >
            <time dateTime={new Date(post.created_at).toISOString()}>{dateCourte(post.created_at)}</time>
          </a>
        </header>
        <p
          className={`whitespace-pre-line break-words text-[15px] leading-5 text-[var(--x-text)] ${long && !deplie ? "line-clamp-6" : ""}`}
        >
          <TexteAvecLiens texte={post.text} />
        </p>
        {long && (
          <button
            type="button"
            onClick={() => setDeplie(!deplie)}
            aria-expanded={deplie}
            className="min-h-11 text-[15px] text-[var(--x-link)] hover:underline"
          >
            {deplie ? "Réduire" : "Afficher plus"}
          </button>
        )}
        <Medias post={post} />
        {post.quoted_tweet && <Citation post={post.quoted_tweet} />}
        <footer className="mt-1 flex max-w-[425px] justify-between">
          <Compteur icone={MessageCircle} libelle="réponses" valeur={post.reply_count} survol="hover:text-[var(--x-link)]" />
          <Compteur
            icone={Repeat2}
            libelle="reposts"
            valeur={(post.retweet_count ?? 0) + (post.quote_count ?? 0)}
            survol="hover:text-[#00ba7c]"
          />
          <Compteur icone={Heart} libelle="j'aime" valeur={post.like_count} survol="hover:text-[#f91880]" />
          <Compteur icone={ChartNoAxesColumn} libelle="vues" valeur={post.view_count} survol="hover:text-[var(--x-link)]" />
        </footer>
      </div>
    </article>
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
          <p className="mt-3 text-[15px] leading-5 whitespace-pre-line text-[var(--x-text)]">{profil.description}</p>
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

export function FilX({ compte, initial }: { compte: string; initial: XLive | null }) {
  const [donnees, setDonnees] = useState<XLive | null>(initial);
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    let actif = true;
    const charger = async () => {
      try {
        const reponse = await fetch(`/api/x/live?compte=${compte}`, { cache: "no-store" });
        if (!reponse.ok) throw new Error(String(reponse.status));
        const suivant = (await reponse.json()) as XLive;
        if (actif) {
          setDonnees(suivant);
          setErreur(false);
        }
      } catch {
        if (actif) setErreur(true);
      }
    };
    if (!initial) void charger();
    const minuteur = setInterval(() => {
      if (document.visibilityState === "visible") void charger();
    }, INTERVALLE_MS);
    return () => {
      actif = false;
      clearInterval(minuteur);
    };
  }, [compte, initial]);

  if (!donnees) {
    return (
      <p role={erreur ? "alert" : "status"} className="p-8 text-center text-[15px] text-[var(--x-muted)]">
        {erreur ? "X ne répond pas pour le moment. Nouvel essai dans quelques secondes." : "Chargement des posts…"}
      </p>
    );
  }

  return (
    <>
      <EnTete profil={donnees.profil} />
      <p className="sr-only" aria-live="polite">
        Mis à jour à {new Date(donnees.recuLe).toLocaleTimeString("fr-FR")}
        {erreur ? ". X ne répond plus, dernier état affiché." : ""}
      </p>
      <div className="border-t border-[var(--x-border)]">
        {donnees.tweets.map(post => (
          <Post key={post.id} post={post} profil={donnees.profil} />
        ))}
      </div>
    </>
  );
}
