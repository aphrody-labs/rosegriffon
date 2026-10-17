"use client";

import { BadgeCheck, ChartNoAxesColumn, Heart, MessageCircle, Repeat2 } from "lucide-react";
import Link from "next/link";
import { Fragment, useState } from "react";

import type { XProfil, XTweet } from "@/lib/x/live";

const SEUIL_LONG = 420;
const MOTIF_TEXTE = /(https:\/\/t\.co\/\w+|#[\p{L}\p{N}_]+|@\w{1,15})/gu;

export const compact = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });
export const entier = new Intl.NumberFormat("fr-FR");

export function dateCourte(valeur: string): string {
  const date = new Date(valeur);
  if (Number.isNaN(date.getTime())) return "";
  const meme = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(
    "fr-FR",
    meme ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" },
  );
}

/** Liens `t.co` → destination, #mots-dièses → recherche sur la page, @pseudos → profil X. */
export function TexteAvecLiens({ texte }: { texte: string }) {
  const lien = "text-[var(--x-link)] hover:underline";
  return (
    <>
      {texte.split(MOTIF_TEXTE).map((morceau, i) => {
        if (morceau.startsWith("https://t.co/"))
          return (
            <a key={i} href={morceau} target="_blank" rel="noopener noreferrer" className={lien}>
              {morceau.replace("https://", "")}
            </a>
          );
        if (morceau.startsWith("#") && morceau.length > 1)
          return (
            <Link key={i} href={`/x?q=${encodeURIComponent(morceau)}`} className={lien} onClick={e => e.stopPropagation()}>
              {morceau}
            </Link>
          );
        if (/^@\w{1,15}$/.test(morceau))
          return (
            <a key={i} href={`https://x.com/${morceau.slice(1)}`} target="_blank" rel="noopener noreferrer" className={lien}>
              {morceau}
            </a>
          );
        return <Fragment key={i}>{morceau}</Fragment>;
      })}
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
      className={`flex min-h-11 items-center gap-1 text-[13px] leading-4 text-[var(--x-muted)] ${survol}`}
      title={`${valeur != null ? entier.format(valeur) : 0} ${libelle}`}
    >
      <Icone className="size-[18px]" aria-hidden />
      <span className="tabular-nums">{valeur ? compact.format(valeur) : ""}</span>
      <span className="sr-only">{libelle}</span>
    </span>
  );
}

export function Avatar({ profil, taille }: { profil: Pick<XProfil, "avatar">; taille: number }) {
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

function Medias({ post }: { post: XTweet }) {
  const medias = post.media?.filter(m => m.preview_url || m.url) ?? [];
  if (medias.length === 0) return null;
  return (
    <div
      className={`mt-3 grid gap-0.5 overflow-hidden rounded-2xl border border-[var(--x-border)] ${medias.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}
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
      onClick={e => e.stopPropagation()}
    >
      <p className="flex flex-wrap items-baseline gap-x-1 text-[15px] leading-5">
        <span className="font-bold text-[var(--x-text)]">{post.author.name}</span>
        <span className="text-[var(--x-muted)]">@{post.author.username}</span>
      </p>
      <p className="mt-0.5 line-clamp-4 break-words whitespace-pre-line text-[15px] leading-5 text-[var(--x-text)]">
        {post.text}
      </p>
      <Medias post={post} />
    </a>
  );
}

/**
 * Un post. `profil` n'est fourni que pour les posts du compte affiché (avatar, certification) ;
 * les résultats de recherche et les réponses n'ont que le nom et le pseudo de l'auteur.
 */
export function Post({ post, profil, ouvert = false }: { post: XTweet; profil?: XProfil; ouvert?: boolean }) {
  const [deplie, setDeplie] = useState(ouvert);
  const long = post.text.length > SEUIL_LONG;
  const duProfil = profil && profil.screen_name.toLowerCase() === post.author.username.toLowerCase() ? profil : undefined;
  return (
    <article className="flex gap-3 border-b border-[var(--x-border)] px-4 pt-3 pb-1 transition-colors hover:bg-[var(--x-hover)]">
      <Avatar profil={{ avatar: duProfil?.avatar }} taille={40} />
      <div className="min-w-0 flex-1">
        <header className="flex min-w-0 items-baseline gap-x-1 text-[15px] leading-5">
          <span className="truncate font-bold text-[var(--x-text)]">{post.author.name}</span>
          {duProfil?.certifie && (
            <BadgeCheck className="size-[18px] shrink-0 self-center fill-[var(--x-link)] text-black" aria-label="Compte certifié" />
          )}
          <span className="shrink-0 text-[var(--x-muted)]">@{post.author.username}</span>
          <span aria-hidden className="text-[var(--x-muted)]">
            ·
          </span>
          <Link href={`/x/status/${post.id}`} className="shrink-0 text-[var(--x-muted)] hover:underline">
            <time dateTime={new Date(post.created_at).toISOString()}>{dateCourte(post.created_at)}</time>
          </Link>
        </header>
        <p
          className={`break-words whitespace-pre-line text-[15px] leading-5 text-[var(--x-text)] ${long && !deplie ? "line-clamp-6" : ""}`}
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

/** Emplacements de chargement : ils réservent la hauteur des posts pour éviter tout saut de mise en page. */
export function SquelettePosts({ nombre = 4 }: { nombre?: number }) {
  return (
    <div aria-hidden>
      {Array.from({ length: nombre }, (_, i) => (
        <div key={i} className="flex gap-3 border-b border-[var(--x-border)] px-4 py-3">
          <span className="size-10 shrink-0 rounded-full bg-[var(--x-border)] motion-safe:animate-pulse" />
          <div className="flex-1 space-y-2">
            <span className="block h-4 w-1/3 rounded bg-[var(--x-border)] motion-safe:animate-pulse" />
            <span className="block h-4 w-full rounded bg-[var(--x-border)] motion-safe:animate-pulse" />
            <span className="block h-4 w-4/5 rounded bg-[var(--x-border)] motion-safe:animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}
