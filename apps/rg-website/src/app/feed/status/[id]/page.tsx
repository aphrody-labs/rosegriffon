import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import Link from "next/link";

import { CommentsSection } from "@/components/shared/CommentsSection";
import { requireAdminOrFail } from "@/lib/auth-helpers";
import { getPgPool } from "@/lib/db/pg";

import { conversationX, estIdPost } from "@/lib/feed";

import { BoutonBrouillon } from "../../bouton-brouillon";
import { FilThread } from "../../fil-feed";
import type { PageFeed } from "../../fil-feed";

export const dynamic = "force-dynamic";

export const metadata = { robots: { index: false }, title: "Publication sur X" };

export default async function PagePost({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!estIdPost(id)) notFound();
  let initial: PageFeed | null = null;
  try {
    initial = await conversationX(id);
  } catch {
    // Le client retente seul.
  }
  // Le post a-t-il une version traduite et éditée sur le site (table `tweets`) ?
  const admin = await requireAdminOrFail().then(() => true, () => false);
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
    <div className="min-h-full bg-background px-3 py-4 text-on-surface sm:px-4">
      <div className="mx-auto w-full max-w-[640px] space-y-3">
        <header className="flex min-h-14 items-center gap-3">
          <Link
            href="/feed"
            aria-label="Retour au feed"
            className="-ml-2 flex size-11 items-center justify-center rounded-full hover:bg-surface-container-high"
          >
            <ArrowLeft className="size-5" aria-hidden />
          </Link>
          <h1 className="text-xl leading-6 font-extrabold">Publication</h1>
          <a
            href={`https://x.com/i/status/${id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto flex min-h-11 items-center text-sm text-primary hover:underline"
          >
            Ouvrir sur X
          </a>
        </header>
        {articleExiste && (
          <Link
            href={`/news/tweet/${id}`}
            className="flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-outline-variant bg-surface-container-low px-4 py-2 text-sm leading-5 hover:bg-surface-container"
          >
            <span>Ce post a une version traduite et éditée sur Rose Griffon.</span>
            <span className="shrink-0 text-primary">Lire l&apos;article</span>
          </Link>
        )}
        {admin && initial?.posts[0] && <BoutonBrouillon post={initial.posts[0]} />}
        <FilThread id={id} initial={initial} />
        <section aria-labelledby="discussion-rg" className="rounded-2xl border border-outline-variant bg-surface-container-low p-4">
          <h2 id="discussion-rg" className="mb-3 text-lg font-semibold">
            Discussion sur Rose Griffon
          </h2>
          <CommentsSection targetId={id} targetType="x_post" />
        </section>
      </div>
    </div>
  );
}
