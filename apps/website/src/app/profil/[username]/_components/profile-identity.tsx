import { Badge, Button } from "@rosegriffon/ui";
import { Edit, ExternalLink } from "lucide-react";
import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@rosegriffon/ui";

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
}

export function ProfileIdentity({
	username,
	fullName,
	avatarUrl,
	bio,
	role,
	website,
	twitterHandle,
	isOwnProfile,
}: ProfileIdentityProps) {
	return (
		<section
			aria-label="Identité"
			className="relative mb-8 flex flex-col items-center gap-6 md:flex-row md:items-start"
		>
			<Avatar className="size-24 border-2 border-border shadow-md sm:h-32 sm:w-32 md:h-36 md:w-36">
				<AvatarImage
					src={avatarUrl ?? ""}
					alt={`Avatar de ${username}`}
					className="object-cover"
				/>
				<AvatarFallback className="bg-muted text-4xl font-bold text-muted-foreground">
					{username[0]?.toUpperCase()}
				</AvatarFallback>
			</Avatar>

			<div className="flex-1 space-y-2 text-center md:pt-2 md:text-left">
				<div className="flex flex-col items-center gap-3 md:flex-row md:flex-wrap">
					<h1 className="break-words text-2xl font-bold text-foreground sm:text-3xl">
						{fullName || username}
					</h1>
					<div className="flex flex-wrap items-center gap-2">
						{role === "admin" && (
							<Badge className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
								Admin
							</Badge>
						)}
						{role === "staff" && (
							<Badge className="bg-sky-500 text-white hover:bg-sky-500/90">
								Staff
							</Badge>
						)}
						{isOwnProfile && (
							<Button
								asChild
								variant="outline"
								size="sm"
								className="h-9 gap-1.5"
							>
								<Link href="/dashboard/account">
									<Edit className="h-3.5 w-3.5" aria-hidden="true" />
									Modifier
								</Link>
							</Button>
						)}
					</div>
				</div>

				<p className="text-lg font-medium text-muted-foreground">@{username}</p>

				{bio && (
					<p className="max-w-2xl leading-relaxed text-foreground/85">{bio}</p>
				)}

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