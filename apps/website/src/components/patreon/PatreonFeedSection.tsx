import { Badge, Button, Card, CardContent } from "@rosegriffon/ui";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Calendar, ExternalLink, Heart, Lock } from "lucide-react";
import Link from "next/link";

import { getPatreonFeedForViewer } from "@/lib/patreon/feed";

export async function PatreonFeedSection() {
	const { access, posts } = await getPatreonFeedForViewer({ limit: 6 });

	if (!access.linked) return null;

	return (
		<section
			aria-labelledby="patreon-feed-title"
			className="border-b border-border/50 bg-linear-to-br from-[#FF424D]/5 via-background to-[#c9a958]/5"
		>
			<div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-10 lg:px-8">
				<div className="mb-6 flex flex-wrap items-center justify-between gap-3">
					<div className="flex items-center gap-3">
						<div className="flex size-10 items-center justify-center rounded-full bg-[#FF424D]/10 text-[#FF424D]">
							<Heart className="size-5" />
						</div>
						<div>
							<h2
								id="patreon-feed-title"
								className="text-xl font-bold text-foreground sm:text-2xl"
							>
								Vos posts Patreon
							</h2>
							<p className="text-sm text-muted-foreground">
								{access.isActiveMember
									? "Tous les posts archivés depuis votre soutien."
									: "Posts publics accessibles à votre statut Patreon lié."}
							</p>
						</div>
					</div>
					<Button
						asChild
						variant="outline"
						size="sm"
						className="gap-1.5 border-[#FF424D]/40 text-[#FF424D] hover:bg-[#FF424D]/10 hover:text-[#FF424D]"
					>
						<a
							href="https://patreon.com/RoseGriffon"
							target="_blank"
							rel="noopener noreferrer"
						>
							Voir sur Patreon
							<ExternalLink className="h-3.5 w-3.5" />
						</a>
					</Button>
				</div>

				{posts.length === 0 ? (
					<EmptyState isActive={access.isActiveMember} />
				) : (
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{posts.map((post) => (
							<PatreonPostCard key={post.id} post={post} />
						))}
					</div>
				)}
			</div>
		</section>
	);
}

function EmptyState({ isActive }: { isActive: boolean }) {
	return (
		<Card>
			<CardContent className="flex flex-col items-start gap-3 p-6">
				<p className="text-sm text-muted-foreground">
					{isActive
						? "Aucun post archivé pour le moment. Les nouveaux posts arriveront ici dès leur publication sur Patreon."
						: "Pour accéder aux posts réservés aux mécènes, soutenez l'association sur Patreon."}
				</p>
				{!isActive && (
					<Button
						asChild
						className="bg-[#FF424D] text-white hover:bg-[#e63b46]"
						size="sm"
					>
						<Link href="/nous-soutenir#tiers">Voir les paliers</Link>
					</Button>
				)}
			</CardContent>
		</Card>
	);
}

function PatreonPostCard({
	post,
}: {
	post: Awaited<ReturnType<typeof getPatreonFeedForViewer>>["posts"][number];
}) {
	const cover = post.cover?.signedUrl;
	return (
		<a
			href={post.url ?? "https://patreon.com/RoseGriffon"}
			target="_blank"
			rel="noopener noreferrer"
			className="group block focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#FF424D] focus-visible:ring-offset-2 rounded-2xl"
		>
			<article className="flex h-full flex-col overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm transition-all group-hover:-translate-y-0.5 group-hover:border-[#FF424D]/40 group-hover:shadow-md">
				<div className="relative aspect-video overflow-hidden bg-muted">
					{cover ? (
						<img
							src={cover}
							alt=""
							loading="lazy"
							className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
						/>
					) : (
						<div className="flex h-full w-full items-center justify-center text-muted-foreground/50">
							<Heart className="size-10" aria-hidden="true" />
						</div>
					)}
					<div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
						<Badge className="border-0 bg-[#FF424D]/90 text-xs uppercase tracking-wider text-white backdrop-blur-sm">
							Patreon
						</Badge>
						{post.isPaid && (
							<Badge className="gap-1 border-0 bg-[#c9a958]/90 text-xs uppercase tracking-wider text-[#0c1730] backdrop-blur-sm">
								<Lock className="h-2.5 w-2.5" />
								Mécène
							</Badge>
						)}
					</div>
				</div>
				<div className="flex flex-1 flex-col gap-2 p-4 sm:p-5">
					<h3 className="line-clamp-2 text-base font-bold leading-snug text-foreground transition-colors group-hover:text-[#FF424D] sm:text-lg">
						{post.title ?? "Sans titre"}
					</h3>
					{post.excerpt && (
						<p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
							{post.excerpt}
						</p>
					)}
					<div className="mt-auto flex items-center gap-1.5 border-t border-border/30 pt-3 text-xs text-muted-foreground">
						<Calendar className="h-3.5 w-3.5" aria-hidden="true" />
						{post.publishedAt ? (
							<time dateTime={post.publishedAt}>
								{format(new Date(post.publishedAt), "d MMM yyyy", {
									locale: fr,
								})}
							</time>
						) : (
							<span>—</span>
						)}
					</div>
				</div>
			</article>
		</a>
	);
}