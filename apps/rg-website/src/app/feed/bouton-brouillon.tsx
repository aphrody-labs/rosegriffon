"use client";

import { useState } from "react";

import type { XTweet } from "@/lib/feed/live";

type Etat = { phase: "repos" } | { phase: "envoi" } | { phase: "ok"; lien: string } | { phase: "erreur"; message: string };

const MOTIF_TCO = /\s*https:\/\/t\.co\/\w+/g;

/** Réservé aux administrateurs : transforme le post en brouillon d'article du CMS éditorial. */
export function BoutonBrouillon({ post }: { post: XTweet }) {
  const [etat, setEtat] = useState<Etat>({ phase: "repos" });

  const creer = async () => {
    setEtat({ phase: "envoi" });
    const propre = post.text.replace(MOTIF_TCO, "").trim();
    const [premiere = "", ...reste] = propre.split("\n").filter(l => l.trim());
    const titre = premiere.length > 90 ? `${premiere.slice(0, 87)}…` : premiere;
    const tags = [...new Set([...propre.matchAll(/#([\p{L}\p{N}_]+)/gu)].map(m => m[1]!.toLowerCase()))].slice(0, 6);
    try {
      const reponse = await fetch("/api/admin/news/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: titre || `Post de @${post.author.username}`,
          content: [...reste, "", `Source : https://x.com/${post.author.username}/status/${post.id}`].join("\n\n"),
          excerpt: propre.slice(0, 200),
          category: "community",
          tags,
          featured_image_url: post.media?.[0]?.url,
        }),
      });
      const donnees = (await reponse.json()) as { editUrl?: string; error?: string };
      if (!reponse.ok || !donnees.editUrl) throw new Error(donnees.error ?? "Création impossible");
      setEtat({ phase: "ok", lien: new URL(donnees.editUrl).pathname });
    } catch (e) {
      setEtat({ phase: "erreur", message: e instanceof Error ? e.message : "Création impossible" });
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-[var(--x-border)] px-4 py-2 text-[15px] leading-5">
      {etat.phase === "ok" ? (
        <a href={etat.lien} className="min-h-11 content-center text-[var(--x-link)] hover:underline">
          Brouillon créé — ouvrir dans l'éditeur
        </a>
      ) : (
        <button
          type="button"
          onClick={() => void creer()}
          disabled={etat.phase === "envoi"}
          className="min-h-11 rounded-full border border-[var(--x-border)] px-4 font-bold hover:bg-white/10 disabled:opacity-60"
        >
          {etat.phase === "envoi" ? "Création…" : "Rédiger un article depuis ce post"}
        </button>
      )}
      {etat.phase === "erreur" && (
        <span role="alert" className="text-[#f4212e]">
          {etat.message}
        </span>
      )}
    </div>
  );
}
