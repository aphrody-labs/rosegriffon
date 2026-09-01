import { AVAILABLE_BADGES, Badge, Button, Avatar, AvatarFallback, AvatarImage } from "@rosegriffon/ui";
import { Edit, ExternalLink } from "lucide-react";
import Link from "next/link";

import TwitterIcon from "@/shared/icons/twitter";

interface ProfileIdentityProps {
	username: string;
	avatarUrl: string | null;
	bio: string | null;
	role: string | null;
	website: string | null;
	twitterHandle: string | null;
	isOwnProfile: boolean;
	badges?: string[] | null;
}

/**
 * La description des badges vient de `@rosegriffon/ui`, pas d'une table locale.
 *
 * Elle existait ici en double, avec des couleurs Tailwind en dur
 * (`amber-500`, `purple-500`, `blue-500`…) que le thème ne suivait pas : le
 * même badge n'avait donc pas la même couleur dans le formulaire de compte et
 * sur le profil public, et aucune des deux ne respectait la charte. La source
 * unique porte les tokens du design system (`rg-or`, `rg-rose`, `info`,
 * `patreon`, `succes`).
 */
const BADGES = new Map(AVAILABLE_BADGES.map((badge) => [badge.id as string, badge]));

/**
 * Un lien de profil n'est suivi que s'il s'ouvre dans un navigateur.
 *
 * La validation du formulaire refuse désormais les schémas exotiques, mais des
 * lignes plus anciennes peuvent encore porter un `javascript:` accepté à
 * l'époque — et c'est ici, au rendu, que cela deviendrait exécutable.
 */
function lienSuivable(valeur: string | null): string | null {
	if (!valeur) {
		return null;
	}
	try {
		const url = new URL(valeur);
		return url.protocol === "http:" || url.protocol === "https:" ? valeur : null;
	} catch {
		return null;
	}
}

export function ProfileIdentity({
	username,
	avatarUrl,
	bio,
	role,
	website,
	twitterHandle,
	isOwnProfile,
	badges,
}: ProfileIdentityProps) {
	const selectedBadges = badges || [];
	const lienSite = lienSuivable(website);

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
						{username}
					</h1>

					{/* Affichage des badges esthétiques sélectionnés */}
					{selectedBadges.length > 0 && (
						<div className="flex flex-wrap gap-1.5 justify-center md:justify-start">
							{selectedBadges.map((badgeId) => {
								const badge = BADGES.get(badgeId);
								if (!badge) return null;
								const IconComponent = badge.icon;
								return (
									<Badge
										key={badgeId}
										variant="outline"
										className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1 shadow-sm border ${badge.tone}`}
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

				{(lienSite || twitterHandle) && (
					<div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 pt-2 md:justify-start">
						{lienSite && (
							<a
								href={lienSite}
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
