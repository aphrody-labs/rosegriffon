"use client";

import { useEffect, useState } from "react";

import type { XLive, XTweet } from "@/lib/x/live";

const INTERVALLE_MS = 30_000;

const nombre = new Intl.NumberFormat("fr-FR", { notation: "compact" });

function quand(valeur: string): string {
  const date = new Date(valeur);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}

function Compteur({ libelle, valeur }: { libelle: string; valeur?: number }) {
  if (valeur == null) return null;
  return (
    <span>
      <span className="font-medium text-foreground">{nombre.format(valeur)}</span> {libelle}
    </span>
  );
}

function Post({ post }: { post: XTweet }) {
  const media = post.media?.filter(m => m.type === "photo" || m.preview_url) ?? [];
  return (
    <article className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <header className="mb-2 flex flex-wrap items-baseline gap-x-2 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{post.author.name}</span>
        <span>@{post.author.username}</span>
        <a
          href={`https://x.com/${post.author.username}/status/${post.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto min-h-11 content-center underline-offset-2 hover:underline"
        >
          <time dateTime={new Date(post.created_at).toISOString()}>{quand(post.created_at)}</time>
        </a>
      </header>
      <p className="whitespace-pre-line break-words text-pretty">{post.text}</p>
      {media.length > 0 && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {media.slice(0, 4).map(m => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={m.url}
              src={m.preview_url ?? m.url}
              alt=""
              width={m.width}
              height={m.height}
              loading="lazy"
              referrerPolicy="no-referrer"
              className="w-full rounded-lg border border-border object-cover"
            />
          ))}
        </div>
      )}
      <footer className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <Compteur libelle="vues" valeur={post.view_count} />
        <Compteur libelle="j'aime" valeur={post.like_count} />
        <Compteur libelle="reposts" valeur={post.retweet_count} />
        <Compteur libelle="réponses" valeur={post.reply_count} />
      </footer>
    </article>
  );
}

export function FilX({ initial }: { initial: XLive | null }) {
  const [donnees, setDonnees] = useState<XLive | null>(initial);
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    let actif = true;
    const charger = async () => {
      try {
        const reponse = await fetch("/api/x/live", { cache: "no-store" });
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
  }, [initial]);

  if (!donnees) {
    return (
      <p role={erreur ? "alert" : "status"} className="rounded-xl border border-border bg-card p-6 text-center">
        {erreur ? "X ne répond pas pour le moment. Nouvel essai dans quelques secondes." : "Chargement des posts…"}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {donnees.profil.name} · mis à jour à{" "}
        {new Date(donnees.recuLe).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        {erreur ? " · X ne répond plus, dernier état affiché" : ""}
      </p>
      {donnees.tweets.map(post => (
        <Post key={post.id} post={post} />
      ))}
    </div>
  );
}
