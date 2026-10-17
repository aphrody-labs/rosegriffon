import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import Link from "next/link";

import { CommentsSection } from "@/components/shared/CommentsSection";
import { getPgPool } from "@/lib/db/pg";

import { estIdPost, lireThread } from "@/lib/x/live";
import type { PageXPosts } from "@/lib/x/live";

import { FilThread } from "../../fil-x";
import { VARIABLES_X } from "../../x-theme";

export const dynamic = "force-dynamic";

export const metadata = { robots: { index: false }, title: "Publication sur X" };

export default async function PagePost({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!estIdPost(id)) notFound();
  let initial: PageXPosts | null = null;
  try {
    initial = await lireThread(id);
  } catch {
    // Le client retente seul.
  }
  // Le post a-t-il une version traduite et éditée sur le site (table `tweets`) ?
  let articleExiste = false;
  try {
    // Un post seul porte son identifiant ; un thread liste ses posts dans `raw_tweets`.
    const { rows } = await getPgPool().query(
      "SELECT 1 FROM tweets WHERE id = $1 OR raw_tweets::jsonb @> $2::jsonb LIMIT 1",
      [id, JSON.stringify([{ id }])],
    );
    articleExiste = rows.length > 0;
  } catch {
    articleExiste = false;
  }
  return (
    <div className="min-h-full bg-[#000] px-0 sm:px-4" style={VARIABLES_X}>
      <div className="mx-auto min-h-screen w-full max-w-[600px] border-x border-[var(--x-border)] bg-[var(--x-bg)] text-[var(--x-text)]">
        <header className="sticky top-14 z-10 flex min-h-[53px] items-center gap-6 border-b border-[var(--x-border)] bg-[var(--x-bg)]/85 px-4 backdrop-blur">
          <Link
            href="/x"
            aria-label="Retour aux comptes"
            className="-ml-2 flex size-11 items-center justify-center rounded-full hover:bg-white/10"
          >
            <ArrowLeft className="size-5" aria-hidden />
          </Link>
          <h1 className="text-xl leading-6 font-extrabold">Publication</h1>
          <a
            href={`https://x.com/i/status/${id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-[15px] text-[var(--x-link)] hover:underline"
          >
            Ouvrir sur X
          </a>
        </header>
        {articleExiste && (
          <Link
            href={`/news/tweet/${id}`}
            className="flex min-h-[53px] items-center justify-between gap-3 border-b border-[var(--x-border)] px-4 text-[15px] leading-5 hover:bg-white/[0.03]"
          >
            <span>Ce post a une version traduite et éditée sur Rose Griffon.</span>
            <span className="shrink-0 text-[var(--x-link)]">Lire l'article</span>
          </Link>
        )}
        <FilThread id={id} initial={initial} />
        <section aria-labelledby="discussion-rg" className="bg-background p-4 text-foreground">
          <h2 id="discussion-rg" className="mb-3 text-lg font-semibold">
            Discussion sur Rose Griffon
          </h2>
          <CommentsSection targetId={id} targetType="x_post" />
        </section>
      </div>
    </div>
  );
}
