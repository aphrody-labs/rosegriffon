import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Calendar, ChevronLeft, Clock, Twitter } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function extractTitleAndBody(text: string): { title: string; body: string } {
	const paragraphs = text.split(/\n\n+/).filter(Boolean);
	const title = paragraphs[0]?.trim() || "";
	const body = paragraphs.slice(1).join("\n\n").trim();
	return { body, title };
}

function estimateReadTime(text: string): number {
	return Math.max(1, Math.ceil(text.trim().split(/\s+/).length / 200));
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ id: string }>;
}): Promise<Metadata> {
	const { id } = await params;
	const supabase = await createClient();
	const { data: tweet } = await (supabase as any)
		.from("tweets")
		.select("text, author_username, media")
		.eq("id", id)
		.single();

	const { title } = extractTitleAndBody(tweet?.text || "");
	const description = title.slice(0, 160);
	const image = tweet?.media?.[0]?.url;

	return {
		description,
		openGraph: {
			description,
			title: title.slice(0, 60),
			...(image && { images: [{ url: image }] }),
		},
		title: `${title.slice(0, 60)} | Azalée`,
		twitter: {
			card: "summary_large_image",
			creator: "@Azalee_IE",
			site: "@Azalee_IE",
		},
	};
}

export default async function TweetPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const supabase = await createClient();
	const { data: tweet } = await (supabase as any)
		.from("tweets")
		.select("*")
		.eq("id", id)
		.single();

	if (!tweet) {notFound();}

	const { title, body } = extractTitleAndBody(tweet.text || "");
	const heroImage = tweet.media?.[0]?.url;
	const readTime = estimateReadTime(tweet.text || "");
	const isThread = tweet.is_thread && tweet.tweet_count > 1;
	const publishedDate = tweet.created_at;

	// Build sections: for threads, pair each raw_tweet with its media
	const rawTweets: any[] =
		isThread && Array.isArray(tweet.raw_tweets) ? tweet.raw_tweets : [];

	// Gather sections from raw_tweets (skip first paragraph which is the title)
	interface Section { text: string; media: any[] }
	let sections: Section[] = [];

	if (rawTweets.length > 0) {
		// Thread: each raw tweet is a section
		sections = rawTweets.map((rt: any) => ({
			media: (rt.media || []).map((m: any) => {
				// Match with downloaded media by finding the corresponding item
				const downloaded = tweet.media?.find(
					(dm: any) => dm.original_url === m.url || dm.url === m.url,
				);
				return downloaded || m;
			}),
			text:
				rt.fullText && rt.fullText.length > (rt.text?.length || 0)
					? rt.fullText
					: rt.text || "",
		}));
		// Remove the first section text from display since it's used as title
		if (sections.length > 0) {
			sections[0] = { ...sections[0], text: "" };
		}
	} else {
		// Single tweet: body paragraphs as sections
		if (body) {
			sections = body
				.split(/\n\n+/)
				.filter(Boolean)
				.map((p) => ({ media: [], text: p.trim() }));
		}
		// Attach remaining media (skip first which is hero) to first section
		const remainingMedia = (tweet.media || []).slice(1);
		if (remainingMedia.length > 0 && sections.length > 0) {
			sections[0] = { ...sections[0], media: remainingMedia };
		} else if (remainingMedia.length > 0) {
			sections.push({ media: remainingMedia, text: "" });
		}
	}

	return (
		<article className="min-h-screen bg-background animate-in fade-in duration-300">
			{/* ═══ HERO IMAGE ═══ */}
			<header className="relative">
				<div className="relative w-full aspect-[4/3] sm:aspect-[16/9] md:aspect-[21/9] bg-surface-container overflow-hidden">
					{heroImage ? (
						<Image
							src={heroImage}
							alt={title}
							fill
							className="object-cover"
							priority
							sizes="100vw"
						/>
					) : (
						<div className="absolute inset-0 bg-linear-to-br from-[#1DA1F2]/20 via-surface-container to-primary/10" />
					)}
					{/* Gradient overlay */}
					<div className="absolute inset-0 bg-linear-to-t from-background via-background/50 to-transparent" />

					{/* Back button */}
					<div className="absolute top-3 left-3 sm:top-6 sm:left-6 z-10">
						<Link
							href="/news"
							className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium
                bg-black/30 backdrop-blur-md text-white/90 hover:bg-black/50 transition-colors"
						>
							<ChevronLeft className="size-4" />
							<span className="hidden sm:inline">Actualités</span>
						</Link>
					</div>
				</div>

				{/* ═══ HEADER CONTENT ═══ */}
				<div className="relative -mt-20 sm:-mt-28 md:-mt-36 px-4 sm:px-6 md:px-8 lg:px-12 max-w-[900px] mx-auto z-10">
					{/* Badge */}
					<div className="flex flex-wrap items-center gap-2 mb-3">
						<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-lg bg-[#1DA1F2] text-white">
							<Twitter className="size-3 fill-current" />
							{isThread ? `Thread · ${tweet.tweet_count} tweets` : "Tweet"}
						</span>
					</div>

					{/* Title */}
					<h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black font-sans tracking-tight leading-[1.15] text-on-surface mb-3 sm:mb-4">
						{title}
					</h1>

					{/* Author + Meta */}
					<div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-on-surface-variant">
						{/* Author */}
						<div className="flex items-center gap-2">
							<div className="size-8 sm:size-9 rounded-full bg-surface-container-high overflow-hidden relative shrink-0 ring-2 ring-background">
								<Image
									src="/icon.webp"
									alt="Azalée"
									fill
									sizes="36px"
									className="object-cover"
								/>
							</div>
							<span className="font-semibold text-on-surface">Azalée 🌸</span>
							<span className="text-on-surface-variant/60">
								@{tweet.author_username}
							</span>
						</div>

						<span className="text-on-surface-variant/30 hidden sm:inline">
							|
						</span>

						{/* Date */}
						<div className="flex items-center gap-1.5">
							<Calendar className="size-3.5 text-on-surface-variant/50" />
							<time dateTime={publishedDate}>
								{format(new Date(publishedDate), "d MMMM yyyy", { locale: fr })}
							</time>
						</div>

						{/* Reading time */}
						<div className="flex items-center gap-1.5">
							<Clock className="size-3.5 text-on-surface-variant/50" />
							{readTime} min
						</div>
					</div>
				</div>
			</header>

			{/* ═══ CONTENT ═══ */}
			<div className="px-4 sm:px-6 md:px-8 lg:px-12 pt-6 sm:pt-8 pb-12 max-w-[900px] mx-auto">
				<div
					className="prose prose-base sm:prose-lg dark:prose-invert max-w-none
          font-medium leading-relaxed text-on-surface/90
          prose-headings:font-sans prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-on-surface
          prose-p:mb-5 prose-p:text-on-surface-variant/90 prose-p:leading-[1.8]
          prose-img:rounded-2xl prose-img:shadow-lg prose-img:border prose-img:border-outline-variant/10
          prose-blockquote:border-l-4 prose-blockquote:border-[#1DA1F2] prose-blockquote:bg-surface-container-low
            prose-blockquote:py-4 prose-blockquote:px-5 prose-blockquote:rounded-r-2xl prose-blockquote:not-italic
          prose-a:text-[#1DA1F2] prose-a:no-underline hover:prose-a:underline
          prose-strong:text-on-surface prose-strong:font-bold"
				>
					{sections.map((section, i) => (
						<div key={i}>
							{section.text && (
								<p className="whitespace-pre-wrap">{section.text}</p>
							)}
							{section.media.length > 0 && (
								<div
									className={`not-prose my-6 ${section.media.length === 1 ? "" : "grid grid-cols-2 gap-3"}`}
								>
									{section.media.map((m: any, j: number) => (
										<div
											key={j}
											className={`relative overflow-hidden rounded-2xl border border-outline-variant/10 shadow-lg bg-surface-container ${
												section.media.length === 1
													? "aspect-video"
													: (section.media.length === 3 && j === 0
														? "col-span-2 aspect-video"
														: "aspect-square")
											}`}
										>
											<Image
												src={m.url}
												alt=""
												fill
												className="object-cover"
												sizes={section.media.length === 1 ? "900px" : "450px"}
											/>
										</div>
									))}
								</div>
							)}
						</div>
					))}
				</div>

				{/* ═══ FOOTER ═══ */}
				<div className="mt-8 pt-6 border-t border-outline-variant/15">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							<div className="size-12 rounded-full bg-surface-container-high overflow-hidden relative border border-outline-variant/10">
								<Image
									src="/icon.webp"
									alt="Azalée"
									fill
									className="object-cover"
								/>
							</div>
							<div>
								<p className="font-bold text-on-surface">
									Azalée 🌸 | Inazuma Eleven FR
								</p>
								<p className="text-sm text-on-surface-variant/60">
									@{tweet.author_username}
								</p>
							</div>
						</div>
						<a
							href={`https://x.com/Azalee_IE/status/${tweet.id}`}
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#1DA1F2]/10 text-[#1DA1F2] text-sm font-bold hover:bg-[#1DA1F2]/20 transition-colors"
						>
							<Twitter className="size-4 fill-current" />
							Voir sur X
						</a>
					</div>
				</div>
			</div>
		</article>
	);
}
