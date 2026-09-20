"use client";

import Link from "next/link";
import Image from "next/image";
import type { ClanDTO } from "@rosegriffon/achillea-types";
import { Card, CardContent, Badge, Button } from "@rosegriffon/ui";
import { Users, Check, X, Globe, Crown } from "lucide-react";
import { FaXTwitter, FaTiktok, FaInstagram, FaTwitch } from "react-icons/fa6";

interface ClanCardProps {
	clan: ClanDTO;
	className?: string;
}

const COUNTRY_NAMES: Record<string, string> = {
	fr: "Français",
	en: "Anglais",
	de: "Allemand",
	it: "Italien",
	es: "Espagnol",
	pt: "Portugais",
	jp: "Japonais",
};

export function ClanCard({ clan, className }: ClanCardProps) {
	return (
		<Link href={`/achillea/clans/${clan.id}`} className="block group">
			<Card
				className={`relative overflow-hidden border border-outline/20 hover:border-primary/50 transition-all duration-300 hover:shadow-lg bg-surface ${
					className ?? ""
				}`}
			>
				<CardContent className="p-4 sm:p-5 flex gap-4 items-start">
					{/* Clan Logo / Avatar avec badge niveau */}
					<div className="relative shrink-0 size-20 sm:size-24 rounded-xl overflow-hidden border-2 border-outline/30 bg-surface-variant p-0.5 shadow-sm group-hover:scale-105 transition-transform duration-300">
						{clan.clanAvatarUrl ? (
							<Image
								src={clan.clanAvatarUrl}
								alt={`Logo ${clan.name}`}
								fill
								unoptimized
								className="object-cover rounded-lg"
							/>
						) : (
							<div className="size-full flex items-center justify-center font-black text-xl text-on-surface-variant">
								{clan.shortenedName}
							</div>
						)}
						{/* Level overlay badge */}
						<div className="absolute bottom-0 right-0 bg-primary text-on-primary text-[10px] sm:text-xs font-black px-1.5 py-0.5 rounded-tl-md shadow">
							Niv. {clan.experience?.currentLevel ?? 1}
						</div>
					</div>

					{/* Body content */}
					<div className="flex-1 min-w-0 space-y-2">
						<div className="flex items-center justify-between gap-2">
							<h3 className="text-base sm:text-lg font-black truncate text-on-surface group-hover:text-primary transition-colors">
								<span className="text-primary mr-1">[{clan.shortenedName}]</span>
								{clan.name}
							</h3>

							{/* Social buttons */}
							<div
								className="flex items-center gap-1 shrink-0"
								onClick={(e) => e.stopPropagation()}
							>
								{clan.xUrl && (
									<a
										href={clan.xUrl}
										target="_blank"
										rel="noopener noreferrer"
										className="text-on-surface-variant hover:text-primary p-1 transition-colors"
										aria-label="Twitter"
									>
										<FaXTwitter className="size-3.5" />
									</a>
								)}
								{clan.instagramUrl && (
									<a
										href={clan.instagramUrl}
										target="_blank"
										rel="noopener noreferrer"
										className="text-on-surface-variant hover:text-primary p-1 transition-colors"
										aria-label="Instagram"
									>
										<FaInstagram className="size-3.5" />
									</a>
								)}
								{clan.tiktokUrl && (
									<a
										href={clan.tiktokUrl}
										target="_blank"
										rel="noopener noreferrer"
										className="text-on-surface-variant hover:text-primary p-1 transition-colors"
										aria-label="TikTok"
									>
										<FaTiktok className="size-3.5" />
									</a>
								)}
							</div>
						</div>

						{/* Infos président & membres */}
						<div className="text-xs text-on-surface-variant space-y-0.5">
							<div className="flex items-center gap-1.5 truncate">
								<Crown className="size-3 text-amber-500 shrink-0" />
								<span>
									Président :{" "}
									<strong className="text-on-surface font-semibold">
										{clan.president?.username ?? "Inconnu"}
									</strong>
								</span>
							</div>
							<div className="flex items-center gap-1.5">
								<Users className="size-3 shrink-0" />
								<span>
									{clan.membersCount ?? 0} membre
									{(clan.membersCount ?? 0) > 1 ? "s" : ""}
								</span>
							</div>
						</div>

						{/* Tags recrutement & langues */}
						<div className="flex flex-wrap gap-1.5 pt-1">
							{clan.isRecruiting ? (
								<Badge variant="default" className="text-[10px] px-2 py-0.5 gap-1 bg-green-600 hover:bg-green-700 text-white border-none">
									<Check className="size-2.5" />
									Recrute
								</Badge>
							) : (
								<Badge variant="secondary" className="text-[10px] px-2 py-0.5 gap-1 opacity-70">
									<X className="size-2.5" />
									Complet
								</Badge>
							)}

							{clan.languages?.map((lang) => (
								<Badge
									key={lang}
									variant="outline"
									className="text-[10px] px-2 py-0.5 gap-1 text-on-surface-variant border-outline/40"
								>
									<Globe className="size-2.5" />
									{COUNTRY_NAMES[lang.toLowerCase()] ?? lang.toUpperCase()}
								</Badge>
							))}
						</div>
					</div>
				</CardContent>
			</Card>
		</Link>
	);
}
