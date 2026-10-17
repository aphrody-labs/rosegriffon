"use client";

import { ChartNoAxesColumn, Heart, MessageCircle, Play, Repeat2 } from "lucide-react";
import Link from "next/link";
import { Fragment, useState } from "react";

import type { MetriquesFeed, PostFeed, ProfilFeed, Reseau } from "@/lib/feed/types";
import { cleProfil } from "@/lib/feed/types";

import { MARQUES } from "@/lib/feed/comptes";

import { BadgeReseau } from "./marque";

const SEUIL_LONG = 420;
const MOTIF_TEXTE = /(https:\/\/t\.co\/\w+|#[\p{L}\p{N}_]+|@[A-Za-z0-9_]{1,30})/gu;

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

const LIEN = "text-primary underline-offset-2 hover:underline focus-visible:rounded-sm";

function lienHashtag(reseau: Reseau, mot: string): string | null {
  const nom = encodeURIComponent(mot.slice(1));
  if (reseau === "instagram") return `https://www.instagram.com/explore/tags/${nom}/`;
  if (reseau === "tiktok") return `https://www.tiktok.com/tag/${nom}`;
  if (reseau === "youtube") return `https://www.youtube.com/hashtag/${nom}`;
  return null;
}

function lienMention(reseau: Reseau, mot: string): string {
  const nom = mot.slice(1);
  if (reseau === "instagram") return `https://www.instagram.com/${nom}/`;
  if (reseau === "tiktok") return `https://www.tiktok.com/@${nom}`;
  if (reseau === "youtube") return `https://www.youtube.com/@${nom}`;
  return `https://x.com/${nom}`;
}

/** Liens `t.co` → destination, #mots-dièses → recherche (X) ou page du réseau, @pseudos → profil. */
export function TexteAvecLiens({ texte, reseau }: { texte: string; reseau: Reseau }) {
  return (
    <>
      {texte.split(MOTIF_TEXTE).map((morceau, i) => {
        if (morceau.startsWith("https://t.co/"))
          return (
            <a key={i} href={morceau} target="_blank" rel="noopener noreferrer" className={LIEN}>
              {morceau.replace("https://", "")}
            </a>
          );
        if (morceau.startsWith("#") && morceau.length > 1) {
          const externe = lienHashtag(reseau, morceau);
          return externe ? (
            <a key={i} href={externe} target="_blank" rel="noopener noreferrer" className={LIEN}>
              {morceau}
            </a>
          ) : (
            <Link key={i} href={`/feed?q=${encodeURIComponent(morceau)}`} className={LIEN}>
              {morceau}
            </Link>
          );
        }
        if (/^@[A-Za-z0-9_]{1,30}$/.test(morceau))
          return (
            <a key={i} href={lienMention(reseau, morceau)} target="_blank" rel="noopener noreferrer" className={LIEN}>
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
}: {
  icone: typeof Heart;
  libelle: string;
  valeur?: number;
}) {
  if (valeur == null) return null;
  return (
    <li className="flex min-h-11 items-center gap-1.5 text-sm text-on-surface-variant" title={`${entier.format(valeur)} ${libelle}`}>
      <Icone className="size-[18px]" aria-hidden />
      <span className="tabular-nums" aria-hidden>
        {valeur > 0 ? compact.format(valeur) : "0"}
      </span>
      <span className="sr-only">
        {entier.format(valeur)} {libelle}
      </span>
    </li>
  );
}

function Compteurs({ metriques }: { metriques?: MetriquesFeed }) {
  if (!metriques) return null;
  const { reponses, partages, jaime, vues } = metriques;
  if (reponses == null && partages == null && jaime == null && vues == null) return null;
  return (
    <ul className="-mb-1 flex flex-wrap gap-x-5">
      <Compteur icone={MessageCircle} libelle="réponses" valeur={reponses} />
      <Compteur icone={Repeat2} libelle="partages" valeur={partages} />
      <Compteur icone={Heart} libelle="j'aime" valeur={jaime} />
      <Compteur icone={ChartNoAxesColumn} libelle="vues" valeur={vues} />
    </ul>
  );
}

export function Avatar({ profil, nom, taille }: { profil?: Pick<ProfilFeed, "avatar">; nom: string; taille: number }) {
  const style = { width: taille, height: taille };
  return profil?.avatar ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={profil.avatar}
      alt=""
      width={taille}
      height={taille}
      referrerPolicy="no-referrer"
      className="shrink-0 rounded-full bg-surface-container-high object-cover"
      style={style}
    />
  ) : (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full bg-primary-container text-sm font-bold text-on-primary-container"
      style={style}
    >
      {nom.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

/** Lecteur intégré du réseau (iframe publique) : rien n'est chargé tant qu'on n'a pas cliqué. */
function Integration({ post }: { post: PostFeed }) {
  const [actif, setActif] = useState(false);
  const integration = post.integration!;
  const poster = post.medias[0]?.apercu ?? post.medias[0]?.url;
  const cadre = { aspectRatio: String(integration.ratio) };
  return (
    <div
      className={`mt-3 w-full overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-high ${integration.ratio < 1 ? "max-w-[340px]" : ""}`}
      style={cadre}
    >
      {actif ? (
        <iframe
          src={integration.url}
          title={integration.titre}
          loading="lazy"
          allow="fullscreen; encrypted-media"
          referrerPolicy="no-referrer-when-downgrade"
          sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
          className="size-full border-0"
        />
      ) : (
        <button
          type="button"
          onClick={() => setActif(true)}
          aria-label={`${integration.titre} : lire`}
          className="group relative flex size-full items-center justify-center"
        >
          {poster && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={poster}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              className="absolute inset-0 size-full object-cover"
              onError={e => (e.currentTarget.style.display = "none")}
            />
          )}
          <span className="relative flex size-14 items-center justify-center rounded-full bg-rg-marine/85 text-rg-sur-marine ring-2 ring-rg-or transition-transform group-hover:scale-105 motion-reduce:transition-none">
            <Play className="size-6 fill-current" aria-hidden />
          </span>
        </button>
      )}
    </div>
  );
}

function Medias({ post }: { post: PostFeed }) {
  const medias = post.medias.filter(m => m.apercu || m.url);
  if (medias.length === 0) return null;
  const seul = medias.length === 1;
  const premier = medias[0]!;
  const ratio = seul && premier.largeur && premier.hauteur ? premier.largeur / premier.hauteur : undefined;
  return (
    <div
      className={`mt-3 grid gap-0.5 overflow-hidden rounded-2xl border border-outline-variant ${seul ? "grid-cols-1" : "grid-cols-2"}`}
    >
      {medias.slice(0, 4).map(m =>
        m.type !== "image" && /\.mp4(\?|$)/.test(m.url) ? (
          <video
            key={m.url}
            src={m.url}
            poster={m.apercu}
            controls={m.type === "video"}
            autoPlay={m.type === "gif"}
            loop={m.type === "gif"}
            muted={m.type === "gif"}
            playsInline
            preload="none"
            className="max-h-[510px] w-full bg-surface-container-high object-cover"
            style={seul && ratio ? { aspectRatio: String(ratio) } : { aspectRatio: "1" }}
          >
            <track kind="captions" />
          </video>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={m.url}
            src={m.apercu ?? m.url}
            alt=""
            width={m.largeur}
            height={m.hauteur}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="w-full bg-surface-container-high object-cover"
            style={{ aspectRatio: seul && ratio ? String(Math.max(ratio, 0.6)) : "1", maxHeight: seul ? 510 : undefined }}
          />
        ),
      )}
    </div>
  );
}

function Citation({ post }: { post: PostFeed }) {
  return (
    <a
      href={post.lien}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-3 block overflow-hidden rounded-2xl border border-outline-variant p-3 hover:bg-surface-container"
    >
      <p className="flex flex-wrap items-baseline gap-x-1 text-sm">
        <span className="font-semibold text-on-surface">{post.auteur.nom}</span>
        <span className="text-on-surface-variant">@{post.auteur.pseudo}</span>
      </p>
      <p className="mt-0.5 line-clamp-4 break-words whitespace-pre-line text-sm text-on-surface">{post.texte}</p>
      <Medias post={post} />
    </a>
  );
}

/**
 * Une carte de post, identique pour les trois réseaux. `profils` fournit l'avatar des comptes
 * suivis ; les résultats de recherche et les réponses n'ont que le nom et le pseudo.
 */
export function CartePost({
  post,
  profils,
  ouvert = false,
}: {
  post: PostFeed;
  profils?: Record<string, ProfilFeed>;
  ouvert?: boolean;
}) {
  const [deplie, setDeplie] = useState(ouvert);
  const long = post.texte.length > SEUIL_LONG;
  const profil = profils?.[cleProfil(post.reseau, post.auteur.pseudo)];
  const horodatage = (
    <time dateTime={post.date}>{dateCourte(post.date)}</time>
  );
  return (
    <article
      aria-label={`${post.auteur.nom}, ${post.reseau}`}
      className="flex gap-3 rounded-2xl border border-outline-variant bg-surface-container-low p-3 transition-colors hover:bg-surface-container motion-reduce:transition-none sm:p-4"
    >
      <Avatar profil={profil} nom={post.auteur.nom} taille={44} />
      <div className="min-w-0 flex-1">
        <header className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
          <a
            href={post.auteur.lien}
            target="_blank"
            rel="noopener noreferrer"
            className="min-w-0 truncate font-semibold text-on-surface hover:underline"
          >
            {post.auteur.nom}
          </a>
          {post.reseau !== "youtube" && (
            <span className="min-w-0 truncate text-on-surface-variant">@{post.auteur.pseudo}</span>
          )}
          <BadgeReseau reseau={post.reseau} taille={18} />
          <span aria-hidden className="text-on-surface-variant">
            ·
          </span>
          {post.reseau === "x" ? (
            <Link href={`/feed/status/${post.idOrigine}`} className="shrink-0 py-3 text-on-surface-variant hover:underline">
              {horodatage}
            </Link>
          ) : (
            <a
              href={post.lien}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 py-3 text-on-surface-variant hover:underline"
            >
              {horodatage}
            </a>
          )}
        </header>
        {post.texte && (
          <p
            className={`-mt-1 break-words whitespace-pre-line text-[15px] leading-6 text-on-surface ${long && !deplie ? "line-clamp-6" : ""}`}
          >
            <TexteAvecLiens texte={post.texte} reseau={post.reseau} />
          </p>
        )}
        {long && (
          <button
            type="button"
            onClick={() => setDeplie(!deplie)}
            aria-expanded={deplie}
            className={`min-h-11 text-sm ${LIEN}`}
          >
            {deplie ? "Réduire" : "Afficher plus"}
          </button>
        )}
        {post.integration ? <Integration post={post} /> : <Medias post={post} />}
        {post.citation && <Citation post={post.citation} />}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4">
          <Compteurs metriques={post.metriques} />
          <a
            href={post.lien}
            target="_blank"
            rel="noopener noreferrer"
            className={`ml-auto flex min-h-11 items-center text-sm ${LIEN}`}
          >
            Voir sur {MARQUES[post.reseau].nom}
          </a>
        </div>
      </div>
    </article>
  );
}

/** Emplacements de chargement : ils réservent la hauteur des cartes pour éviter tout saut de mise en page. */
export function SquelettePosts({ nombre = 4 }: { nombre?: number }) {
  return (
    <div aria-hidden className="space-y-3">
      {Array.from({ length: nombre }, (_, i) => (
        <div key={i} className="flex min-h-[184px] gap-3 rounded-2xl border border-outline-variant bg-surface-container-low p-4">
          <span className="size-11 shrink-0 rounded-full bg-surface-container-high motion-safe:animate-pulse" />
          <div className="flex-1 space-y-2.5">
            <span className="block h-4 w-1/3 rounded bg-surface-container-high motion-safe:animate-pulse" />
            <span className="block h-4 w-full rounded bg-surface-container-high motion-safe:animate-pulse" />
            <span className="block h-4 w-11/12 rounded bg-surface-container-high motion-safe:animate-pulse" />
            <span className="block h-24 w-full rounded-2xl bg-surface-container-high motion-safe:animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}
