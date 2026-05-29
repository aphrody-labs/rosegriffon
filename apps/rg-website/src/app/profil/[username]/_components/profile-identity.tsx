import { Badge, Button, Avatar, AvatarFallback, AvatarImage } from "@rose-griffon/ui";
import { Edit, ExternalLink, Crown, Star, ShieldCheck, Heart, Sparkles } from "lucide-react";
import Link from "next/link";

import TwitterIcon from "@/shared/icons/twitter";

interface ProfileIdentityProps {
	username: string;
	fullName: string | null;
	avatarUrl: string | null;
	bio: string | null;
	role: string | null;
	website: string | null;
	twitterHandle: string | null;
	isOwnProfile: boolean;
	badges?: string[] | null;
}

const BADGE_MAP: Record<string, { label: string; icon: any; color: string }> = {
	founder: {
		label: "Fondateur",
		icon: Crown,
		color: "bg-amber-500/10 text-amber-500 border-amber-500/20",
	},
	vip: {
		label: "VIP",
		icon: Star,
		color: "bg-purple-500/10 text-purple-500 border-purple-500/20",
	},
	beta: {
		label: "Bêta-testeur",
		icon: Sparkles,
		color: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
	},
	patreon: {
		label: "Patreon",
		icon: Heart,
		color: "bg-rose-500/10 text-rose-500 border-rose-500/20",
	},
	staff: {
		label: "Staff",
		icon: ShieldCheck,
		color: "bg-blue-500/10 text-blue-500 border-blue-500/20",
	},
};

export function ProfileIdentity({
	username,
	fullName,
	avatarUrl,
	bio,
	role,
	website,
	twitterHandle,
	isOwnProfile,
	badges,
}: ProfileIdentityProps) {
	const selectedBadges = badges || [];

	return (
		<section
			aria-label="Identité"
			className="relative mb-8 flex flex-col items-center gap-6 md:flex-row md:items-start"
		>
			<Avatar className="size-24 border-2 border-border shadow-md sm:h-32 sm:w-32 md:h-36 md:w-36">
				<AvatarImage src={avatarUrl ?? ""} alt={`Avatar de ${username}`} className="object-cover" />
				<AvatarFallback className="bg-muted text-4xl font-bold text-muted-foreground">
					{username[0]?.toUpperCase()}
				</AvatarFallback>
			</Avatar>

			<div className="flex-1 space-y-2 text-center md:pt-2 md:text-left">
				<div className="flex flex-col items-center gap-3 md:flex-row md:flex-wrap">
					<h1 className="break-words text-2xl font-bold text-foreground sm:text-3xl">
						{fullName || username}
					</h1>

					{/* Affichage des badges esthétiques sélectionnés */}
					{selectedBadges.length > 0 && (
						<div className="flex flex-wrap gap-1.5 justify-center md:justify-start">
							{selectedBadges.map((badgeId) => {
								const badge = BADGE_MAP[badgeId];
								if (!badge) return null;
								const IconComponent = badge.icon;
								return (
									<Badge
										key={badgeId}
										variant="outline"
										className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1 shadow-sm border ${badge.color}`}
									>
										<IconComponent className="size-3" />
										{badge.label}
									</Badge>
								);
							})}
						</div>
					)}

					<div className="flex flex-wrap items-center gap-2">
						{role === "admin" && (
							<Badge className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
								Admin
							</Badge>
						)}
						{role === "staff" && (
							<Badge className="bg-sky-500 text-white hover:bg-sky-500/90">Staff</Badge>
						)}
						{isOwnProfile && (
							<Button asChild variant="outline" size="sm" className="h-9 gap-1.5">
								<Link href="/dashboard/account">
									<Edit className="h-3.5 w-3.5" aria-hidden="true" />
									Modifier mon profil
								</Link>
							</Button>
						)}
					</div>
				</div>

				<p className="text-lg font-medium text-muted-foreground">@{username}</p>

				{bio && <p className="max-w-2xl leading-relaxed text-foreground/85">{bio}</p>}

				{(website || twitterHandle) && (
					<div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 pt-2 md:justify-start">
						{website && (
							<a
								href={website}
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary"
							>
								<ExternalLink className="size-4" aria-hidden="true" />
								Site Web
							</a>
						)}
						{twitterHandle && (
							<a
								href={`https://twitter.com/${twitterHandle.replace("@", "")}`}
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-[#1DA1F2]"
							>
								<TwitterIcon className="size-4" />
								Twitter
							</a>
						)}
					</div>
				)}
			</div>
		</section>
	);
}
