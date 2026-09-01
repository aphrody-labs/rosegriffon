import { notFound } from "next/navigation";

import { CarteJoueur } from "@rosegriffon/ui";
import { progression, rangDe } from "@rosegriffon/types/experience";
import { libelleRole } from "@rosegriffon/types/roles";

import { LegacyBanner } from "@/components/patreon/LegacyBanner";
import { PatreonConnectionCard } from "@/components/patreon/PatreonConnectionCard";
import { PatreonMembershipCard } from "@/components/patreon/PatreonMembershipCard";
import { BreadcrumbSchema, ProfileSchema } from "@/components/shared/StructuredData";
import { getServerUser } from "@/lib/auth-helpers";
import { getPgPool } from "@/lib/db/pg";
import { createAdminClient } from "@/lib/supabase/server";

import { ProfileAbout } from "./_components/profile-about";
import { ProfileActivity } from "./_components/profile-activity";
import { ProfileIdentity } from "./_components/profile-identity";
import { ProfileQuickLinks } from "./_components/profile-quick-links";

import type { Tables } from "@rosegriffon/db";
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
	// Le nom réel et le pays sont hors de la liste blanche publique depuis la
	// fermeture PII du 11/8/2026. Cette page lit pourtant la base avec le rôle
	// propriétaire (`getPgPool`), qui contourne à la fois la RLS et les droits
	// par colonne : la restriction doit donc être appliquée ici, dans la requête.
	const { rows } = await pool.query<Pick<Profile, "username" | "avatar_url" | "bio">>(
		"SELECT username, avatar_url, bio FROM profiles WHERE username = $1 AND claimed_at IS NOT NULL LIMIT 1",
		[username]
	);
	const profile = rows[0];

	if (!profile) {
		return { title: "Profil introuvable · Rose Griffon" };
	}

	const displayName = profile.username || username;
	const title = `Profil de ${displayName} · Rose Griffon`;
	// Sans bio, on annonce ce que la page EST — « Découvrez le profil de X »
	// répétait le titre juste au-dessus, en aperçu de lien comme en résultat de
	// recherche.
	const description = profile.bio || `Profil de ${displayName} sur Rose Griffon.`;
	const image = profile.avatar_url || "/opengraph-image.png";

	return {
		alternates: { canonical: `https://rosegriffon.fr/profil/${username}` },
		description,
		openGraph: {
			description,
			images: [{ url: image }],
			title,
			type: "profile",
			url: `https://rosegriffon.fr/profil/${username}`,
		},
		// Même politique que sur le wiki Azalée : la fiche publie la biographie
		// d'un membre sans que son indexation ait jamais été demandée.
		robots: { follow: true, index: false },
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
		// Projection explicite sur les colonnes publiques : un `SELECT *` remontait
		// aussi l'e-mail, le nom réel, l'adresse postale et l'identifiant Patreon,
		// dont deux étaient rendus sur cette page sans authentification.
		const { rows } = await pool.query<Profile>(
			`SELECT id, updated_at, username, avatar_url, role, website, discord_id,
			        bio, banner_url, twitter_handle, badges
			   FROM profiles WHERE username = $1 AND claimed_at IS NOT NULL LIMIT 1`,
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

	// Niveau de communauté : l'XP réellement gagnée sur le Discord, via le compte
	// lié. Un profil sans `discord_id` (inscription Google, compte non réclamé)
	// n'a pas de niveau — la carte n'affiche alors pas le bloc plutôt que
	// d'inventer un « niveau 1 » que personne n'a joué.
	let niveauCommunaute: { valeur: number; restant: number; rang: string } | null = null;
	let titreJoueur: string | null = null;
	if (profile.discord_id) {
		try {
			const { rows } = await pool.query<{ xp: string | number; titre: string | null }>(
				`SELECT xp, titre FROM bot_profils WHERE discord_id = $1 ORDER BY xp DESC LIMIT 1`,
				[profile.discord_id]
			);
			const ligne = rows[0];
			if (ligne) {
				const avancement = progression(Number(ligne.xp) || 0);
				niveauCommunaute = {
					rang: rangDe(avancement.niveau).nom,
					restant: avancement.restant,
					valeur: avancement.niveau,
				};
				titreJoueur = ligne.titre;
			}
		} catch (error) {
			// Le profil doit s'afficher même si le bot n'a jamais vu ce membre.
			console.error("[profil] niveau de communauté indisponible", error);
		}
	}

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
				name={profile.username || username}
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

			{/* Carte de joueur : bannière, portrait, nom, description et éléments
			    dans la composition des fiches du jeu. */}
			<div className="container mx-auto px-4 pt-6 sm:px-6 sm:pt-8 lg:px-8">
				<CarteJoueur
					pseudo={profile.username ?? username}
					titre={titreJoueur}
					description={profile.bio}
					avatarUrl={profile.avatar_url}
					banniereUrl={profile.banner_url}
					badges={profile.badges}
					role={libelleRole(profile.role)}
					niveau={niveauCommunaute}
				/>

				<ProfileIdentity
					website={profile.website}
					twitterHandle={profile.twitter_handle}
					isOwnProfile={isOwnProfile}
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
