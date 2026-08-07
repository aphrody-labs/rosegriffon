import { notFound } from "next/navigation";

import { LegacyBanner } from "@/components/patreon/LegacyBanner";
import { PatreonConnectionCard } from "@/components/patreon/PatreonConnectionCard";
import { PatreonMembershipCard } from "@/components/patreon/PatreonMembershipCard";
import { BreadcrumbSchema, ProfileSchema } from "@/components/shared/StructuredData";
import { getServerUser } from "@/lib/auth-helpers";
import { getPgPool } from "@/lib/db/pg";
import { createAdminClient } from "@/lib/supabase/server";

import { ProfileAbout } from "./_components/profile-about";
import { ProfileActivity } from "./_components/profile-activity";
import { ProfileBanner } from "./_components/profile-banner";
import { ProfileIdentity } from "./_components/profile-identity";
import { ProfileQuickLinks } from "./_components/profile-quick-links";

import type { Tables } from "@rose-griffon/db";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

type Profile = Tables<"profiles">;
type Chronicle = Pick<
	Tables<"chronicles">,
	"id" | "slug" | "title" | "excerpt" | "created_at"
>;
type TeamMemberRow = Pick<Tables<"team_members">, "role" | "team_name">;
interface StaffMember {
	role?: string;
	team_name?: string;
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ username: string }>;
}): Promise<Metadata> {
	const { username } = await params;
	const pool = getPgPool();
	const { rows } = await pool.query<
		Pick<Profile, "full_name" | "username" | "avatar_url" | "bio">
	>(
		"SELECT full_name, username, avatar_url, bio FROM profiles WHERE username = $1 LIMIT 1",
		[username]
	);
	const profile = rows[0];

	if (!profile) {
		return { title: "Profil introuvable · Rose Griffon" };
	}

	const displayName = profile.full_name || profile.username || username;
	const title = `Profil de ${displayName} · Rose Griffon`;
	const description = profile.bio || `Découvrez le profil de ${displayName} sur Rose Griffon.`;
	const image = profile.avatar_url || "/opengraph-image.png";

	return {
		description,
		openGraph: {
			description,
			images: [{ url: image }],
			title,
			type: "profile",
			url: `https://rosegriffon.fr/profil/${username}`,
		},
		title,
		twitter: {
			card: "summary",
			description,
			images: [image],
			title,
		},
	};
}

export default async function UserProfilePage({
	params,
}: {
	params: Promise<{ username: string }>;
}) {
	const { username } = await params;
	const pool = getPgPool();
	const user = await getServerUser();

	let profile: Profile | null = null;
	try {
		const { rows } = await pool.query<Profile>(
			"SELECT * FROM profiles WHERE username = $1 LIMIT 1",
			[username]
		);
		profile = rows[0] ?? null;
	} catch (error) {
		console.error("Error fetching profile:", error);
	}

	if (!profile) {
		notFound();
	}

	const isOwnProfile = user?.id === profile.id;

	let activities: Chronicle[] = [];
	try {
		const { rows } = await pool.query<Chronicle>(
			`SELECT id, slug, title, excerpt, created_at
			 FROM chronicles
			 WHERE author_id = $1 AND published = true
			 ORDER BY created_at DESC
			 LIMIT 5`,
			[profile.id]
		);
		activities = rows;
	} catch (error) {
		console.error("Error fetching recent chronicles:", error);
	}

	let staffMember: StaffMember | null = null;
	if (profile.discord_id) {
		try {
			const { rows } = await pool.query<TeamMemberRow>(
				`SELECT role, team_name FROM team_members
				 WHERE discord_user_id = $1 AND is_active = true
				 LIMIT 1`,
				[profile.discord_id]
			);
			const row = rows[0];
			staffMember = row
				? { role: row.role ?? undefined, team_name: row.team_name ?? undefined }
				: null;
		} catch (error) {
			console.error("Error fetching staff member:", error);
		}
	}

	let patreonLinked = false;
	let hasPatreonHistory = false;
	if (isOwnProfile) {
		const admin = createAdminClient();
		if (admin) {
			const [tokensCount, membershipsCount, legacyCount] = await Promise.all([
				admin
					.from("patreon_oauth_tokens")
					.select("id", { count: "exact", head: true })
					.eq("user_id", profile.id)
					.eq("is_creator", false),
				admin
					.from("patreon_memberships")
					.select("id", { count: "exact", head: true })
					.eq("user_id", profile.id),
				admin
					.from("patreon_legacy_members")
					.select("id", { count: "exact", head: true })
					.eq("resolved_user_id", profile.id),
			]);
			patreonLinked = (tokensCount.count ?? 0) > 0;
			hasPatreonHistory = (membershipsCount.count ?? 0) > 0 || (legacyCount.count ?? 0) > 0;
		}
	}

	return (
		<div className="min-h-screen bg-background pb-20">
			<BreadcrumbSchema
				items={[
					{ item: "/", name: "Accueil" },
					{ item: "/profil", name: "Profils" },
					{ item: `/profil/${username}`, name: profile.username ?? username },
				]}
			/>
			<ProfileSchema
				name={profile.full_name || profile.username || username}
				username={profile.username ?? username}
				image={profile.avatar_url || undefined}
				description={profile.bio || undefined}
				url={`https://rosegriffon.fr/profil/${username}`}
				sameAs={
					profile.twitter_handle
						? [`https://twitter.com/${profile.twitter_handle.replace("@", "")}`]
						: undefined
				}
			/>

			{/* Bannière de profil personnalisé */}
			<ProfileBanner src={profile.banner_url} />

			<div className="container mx-auto px-4 pt-8 sm:px-6 sm:pt-10 lg:px-8">
				<ProfileIdentity
					username={profile.username ?? username}
					fullName={profile.full_name}
					avatarUrl={profile.avatar_url}
					bio={profile.bio}
					role={profile.role}
					website={profile.website}
					twitterHandle={profile.twitter_handle}
					isOwnProfile={isOwnProfile}
					badges={profile.badges}
				/>

				{isOwnProfile && (
					<section aria-label="Mon espace personnel" className="mb-10 space-y-6">
						<LegacyBanner userId={profile.id} />
						{hasPatreonHistory ? (
							<PatreonMembershipCard userId={profile.id} />
						) : (
							<PatreonConnectionCard
								isLinked={patreonLinked}
								hasDiscord={Boolean(profile.discord_id)}
							/>
						)}
						<ProfileQuickLinks />
					</section>
				)}

				<div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-3">
					<aside className="md:col-span-1">
						<ProfileAbout
							role={profile.role}
							country={profile.country}
							updatedAt={profile.updated_at}
							staffMember={staffMember}
						/>
					</aside>
					<div className="md:col-span-2">
						<ProfileActivity activities={activities} />
					</div>
				</div>
			</div>
		</div>
	);
}
