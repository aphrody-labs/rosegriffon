"use client";

import { Badge, Card, CardContent } from "@rosegriffon/ui";
import { Check, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { PublicClan } from "@/lib/achillea/unified-clans";

interface ClanCardProps {
	clan: PublicClan;
	className?: string;
}

export function ClanCard({ clan, className }: ClanCardProps) {
	return (
		<Link href={`/achillea/clans/${clan.id}`} className="block group">
			<Card
				className={`border border-outline/20 hover:border-primary/50 transition-colors bg-surface ${className ?? ""}`}
			>
				<CardContent className="p-4 sm:p-5 flex gap-4 items-start">
					<div className="relative shrink-0 size-20 sm:size-24 rounded-xl overflow-hidden border border-outline/30 bg-surface-variant">
						{clan.avatarUrl ? (
							<Image
								src={clan.avatarUrl}
								alt={`Logo ${clan.name}`}
								fill
								unoptimized
								className="object-cover"
							/>
						) : (
							<div className="size-full flex items-center justify-center font-black text-xl text-on-surface-variant">
								{clan.shortName}
							</div>
						)}
					</div>
					<div className="min-w-0 space-y-2">
						<h3 className="text-base sm:text-lg font-black text-on-surface group-hover:text-primary">
							<span className="text-primary mr-1">[{clan.shortName}]</span>
							{clan.name}
						</h3>
						{clan.biography && (
							<p className="text-sm text-on-surface-variant line-clamp-2">
								{clan.biography}
							</p>
						)}
						<p className="text-sm text-on-surface-variant">
							Notoriété : {clan.fame}
						</p>
						{clan.isRecruiting ? (
							<Badge
								variant="default"
								className="gap-1 bg-green-600 text-white"
							>
								<Check className="size-3" />
								Recrute
							</Badge>
						) : (
							<Badge variant="secondary" className="gap-1">
								<X className="size-3" />
								{clan.membersLimit ? "Complet" : "Recrutement fermé"}
							</Badge>
						)}
					</div>
				</CardContent>
			</Card>
		</Link>
	);
}
