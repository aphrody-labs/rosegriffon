import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ArrowRight, Eye, FileText } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface RecentArticle {
	id: string;
	title: string;
	slug: string;
	status: string | null;
	published_at: string | null;
	updated_at: string | null;
	view_count: number | null;
}

export function RecentArticles({ articles }: { articles: RecentArticle[] }) {
	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between space-y-0">
				<CardTitle className="text-base">Articles récents</CardTitle>
				<Link
					href="/admin/chroniques"
					className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
				>
					Tout voir
					<ArrowRight className="h-3 w-3" aria-hidden="true" />
				</Link>
			</CardHeader>
			<CardContent>
				{articles.length === 0 ? (
					<p className="text-sm text-muted-foreground">Aucun article.</p>
				) : (
					<ul className="divide-y divide-border">
						{articles.map((a) => {
							const date = a.published_at ?? a.updated_at;
							const isDraft = a.status !== "published";
							return (
								<li key={a.id} className="py-3 first:pt-0 last:pb-0">
									<div className="flex items-start gap-3">
										<div
											className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400"
											aria-hidden="true"
										>
											<FileText className="h-4 w-4" />
										</div>
										<div className="min-w-0 flex-1">
											<div className="flex items-start justify-between gap-2">
												<p className="line-clamp-1 text-sm font-medium text-foreground">
													{a.title}
												</p>
												{isDraft && (
													<Badge
														variant="outline"
														className="flex-shrink-0 text-xs"
													>
														Brouillon
													</Badge>
												)}
											</div>
											<p className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
												{date && (
													<span>
														{format(new Date(date), "d MMM yyyy", {
															locale: fr,
														})}
													</span>
												)}
												{typeof a.view_count === "number" && (
													<span className="flex items-center gap-1">
														<Eye className="h-3 w-3" aria-hidden="true" />
														{a.view_count}
													</span>
												)}
											</p>
										</div>
									</div>
								</li>
							);
						})}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
