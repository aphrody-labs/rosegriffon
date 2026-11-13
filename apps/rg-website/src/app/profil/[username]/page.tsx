import type { Tables } from "@rosegriffon/db";
import { createPostgresClient } from "@rosegriffon/db/service";
import { progression, rangDe } from "@rosegriffon/types/experience";
import { CarteJoueur } from "@rosegriffon/ui";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegacyBanner } from "@/components/patreon/LegacyBanner";
import { PatreonConnectionCard } from "@/components/patreon/PatreonConnectionCard";
import { PatreonMembershipCard } from "@/components/patreon/PatreonMembershipCard";
import {
  BreadcrumbSchema,
  ProfileSchema,
} from "@/components/shared/StructuredData";
import { getServerUser } from "@/lib/auth-helpers";
import { getPgPool } from "@/lib/db/pg";
import { absoluteUrl } from "@/lib/site-url";
import { ProfileAbout } from "./_components/profile-about";
import { ProfileActivity } from "./_components/profile-activity";
import { ProfileIdentity } from "./_components/profile-identity";
import { ProfileQuickLinks } from "./_components/profile-quick-links";
import {
  ProfileStats,
  type StatistiquesProfil,
} from "./_components/profile-stats";

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
  const { rows } = await pool.query<
    Pick<Profile, "username" | "avatar_url" | "bio">
  >(
    "SELECT username, avatar_url, bio FROM profiles WHERE username = $1 AND claimed_at IS NOT NULL LIMIT 1",
    [username],
  );
  const profile = rows[0];

  if (!profile) {
    return { title: "Profil introuvable · Rose Griffon" };
  }

  const displayName = profile.username || username;
  const profilePath = `/profil/${encodeURIComponent(displayName)}`;
  const title = `Profil de ${displayName} · Rose Griffon`;
  // Sans bio, on annonce ce que la page EST — « Découvrez le profil de X »
  // répétait le titre juste au-dessus, en aperçu de lien comme en résultat de
  // recherche.
  const description =
    profile.bio || `Profil de ${displayName} sur Rose Griffon.`;
  const image = profile.avatar_url || "/opengraph-image.png";

  return {
    alternates: { canonical: absoluteUrl(profilePath) },
    description,
    openGraph: {
      description,
      images: [{ url: image }],
      title,
      type: "profile",
      url: absoluteUrl(profilePath),
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
			        bio, banner_url, banner_position, poste, claimed_at, twitter_handle, badges
			   FROM profiles WHERE username = $1 AND claimed_at IS NOT NULL LIMIT 1`,
      [username],
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
  let niveauCommunaute: {
    valeur: number;
    restant: number;
    rang: string;
  } | null = null;
  let titreJoueur: string | null = null;
  // Le rôle affiché est celui du DISCORD, pas `profiles.role` : « member » ou
  // « admin » décrit un droit d'accès au site, quand « Joueur Route Victoire »
  // est ce que le membre porte réellement, avec la couleur de son pseudo dans
  // les salons. On prend le rôle de plus haute position, comme Discord.
  let roleDiscord: { nom: string; couleur: number | null } | null = null;
  let classementServeur: { place: number; total: number } | null = null;
  const ficheBase: StatistiquesProfil = {
    inscriptionSite: profile.claimed_at ?? null,
  };
  let fiche: StatistiquesProfil = ficheBase;

  // Toutes ces lectures ne dépendent que de `profile` (discord_id ou id) et sont indépendantes
  // entre elles : on les lance en parallèle. Chacune garde son propre try/catch (le profil doit
  // s'afficher même si une source est indisponible) et retourne sa part de `fiche`, fusionnée
  // après coup — jamais de read-modify-write concurrent sur un objet partagé.
  const discordId = profile.discord_id;
  const [
    rolePart,
    achilleaPart,
    membrePart,
    niveauPart,
    activitiesResult,
    staffResult,
  ] = await Promise.all([
    // Rôle Discord : le premier (position la plus haute) sert d'identité, la liste nourrit la fiche.
    discordId
      ? pool
          .query<{ name: string; color: number | null }>(
            `SELECT r.name, r.color
				   FROM discord_members m
				   JOIN discord_roles r ON r.role_id = ANY(m.roles)
				  WHERE m.discord_id = $1
				  ORDER BY r.position DESC
				  LIMIT 12`,
            [discordId],
          )
          .then(({ rows }) => ({
            roleDiscord: rows[0]
              ? { couleur: rows[0].color || null, nom: rows[0].name }
              : null,
            fiche: {
              roles: rows.map((l) => ({
                couleur: l.color || null,
                nom: l.name,
              })),
            },
          }))
          .catch((error) => {
            console.error("[profil] rôle Discord indisponible", error);
            return null;
          })
      : null,
    // Achilléa vit dans le même Postgres : agrégats de compétition publics, aucune requête au bot.
    discordId
      ? pool
          .query<{
            clan: string | null;
            elo_max: string | number | null;
            parties: string | number | null;
          }>(
            `SELECT max(c.name) AS clan,
				        max(e.elo) AS elo_max,
				        coalesce(sum(e.games_played), 0) AS parties
				   FROM achillea."user" u
				   LEFT JOIN achillea.user_elo e ON e.user_id = u.id
				   LEFT JOIN achillea.clan_member cm ON cm.user_id = u.id
				   LEFT JOIN achillea.clan c ON c.id = cm.clan_id
				  WHERE u.id = $1
				  GROUP BY u.id`,
            [discordId],
          )
          .then(({ rows }) =>
            rows[0]
              ? {
                  fiche: {
                    clanAchillea: rows[0].clan,
                    eloMax: Number(rows[0].elo_max ?? 0) || null,
                    partiesClassees: Number(rows[0].parties ?? 0) || null,
                  },
                }
              : null,
          )
          .catch((error) => {
            console.error("[profil] données Achilléa indisponibles", error);
            return null;
          })
      : null,
    // Arrivée sur le serveur et boost.
    discordId
      ? pool
          .query<{ joined_at: string | null; premium_since: string | null }>(
            `SELECT joined_at, premium_since FROM discord_members WHERE discord_id = $1 LIMIT 1`,
            [discordId],
          )
          .then(({ rows }) =>
            rows[0]
              ? {
                  fiche: {
                    arriveeDiscord: rows[0].joined_at,
                    boostDepuis: rows[0].premium_since,
                  },
                }
              : null,
          )
          .catch((error) => {
            console.error(
              "[profil] arrivée sur le serveur indisponible",
              error,
            );
            return null;
          })
      : null,
    // Niveau de communauté (XP) + classement serveur : la seconde requête dépend de la première,
    // donc elles restent enchaînées, mais le bloc entier tourne en parallèle des autres.
    discordId
      ? (async () => {
          const { rows } = await pool.query<{
            xp: string | number;
            titre: string | null;
            jetons: string | number | null;
            messages_comptes: string | number | null;
            serie_quotidienne: number | null;
          }>(
            `SELECT xp, titre, jetons, messages_comptes, serie_quotidienne
				   FROM bot_profils WHERE discord_id = $1 ORDER BY xp DESC LIMIT 1`,
            [discordId],
          );
          const ligne = rows[0];
          if (!ligne) return null;
          const avancement = progression(Number(ligne.xp) || 0);
          const { rows: rang } = await pool.query<{
            place: string;
            total: string;
          }>(
            `SELECT place, total FROM (
					   SELECT discord_id,
					          rank() OVER (ORDER BY xp DESC) AS place,
					          count(*) OVER () AS total
					     FROM bot_profils
					    WHERE xp > 0
					 ) c WHERE discord_id = $1`,
            [discordId],
          );
          const ligneRang = rang[0];
          return {
            niveauCommunaute: {
              rang: rangDe(avancement.niveau).nom,
              restant: avancement.restant,
              valeur: avancement.niveau,
            },
            titreJoueur: ligne.titre,
            classementServeur: ligneRang
              ? {
                  place: Number(ligneRang.place),
                  total: Number(ligneRang.total),
                }
              : null,
            fiche: {
              jetons: Number(ligne.jetons ?? 0),
              messages: Number(ligne.messages_comptes ?? 0),
              serie: Number(ligne.serie_quotidienne ?? 0),
              xp: Number(ligne.xp) || 0,
            },
          };
        })().catch((error) => {
          // Le profil doit s'afficher même si le bot n'a jamais vu ce membre.
          console.error("[profil] niveau de communauté indisponible", error);
          return null;
        })
      : null,
    // Chroniques publiées de l'auteur.
    pool
      .query<Chronicle>(
        `SELECT id, slug, title, excerpt, created_at
			 FROM chronicles
			 WHERE author_id = $1 AND published = true
			 ORDER BY created_at DESC
			 LIMIT 5`,
        [profile.id],
      )
      .then(({ rows }) => rows)
      .catch((error) => {
        console.error("Error fetching recent chronicles:", error);
        return [] as Chronicle[];
      }),
    // Appartenance staff e-sport.
    discordId
      ? pool
          .query<TeamMemberRow>(
            `SELECT role, team_name FROM team_members
				 WHERE discord_user_id = $1 AND is_active = true
				 LIMIT 1`,
            [discordId],
          )
          .then(({ rows }) =>
            rows[0]
              ? {
                  role: rows[0].role ?? undefined,
                  team_name: rows[0].team_name ?? undefined,
                }
              : null,
          )
          .catch((error) => {
            console.error("Error fetching staff member:", error);
            return null;
          })
      : null,
  ]);

  // Fusion ordonnée : même ordre que les requêtes séquentielles d'origine, dernière valeur gagnante.
  roleDiscord = rolePart?.roleDiscord ?? null;
  niveauCommunaute = niveauPart?.niveauCommunaute ?? null;
  titreJoueur = niveauPart?.titreJoueur ?? null;
  classementServeur = niveauPart?.classementServeur ?? null;
  fiche = {
    ...ficheBase,
    ...rolePart?.fiche,
    ...achilleaPart?.fiche,
    ...membrePart?.fiche,
    ...niveauPart?.fiche,
  };
  const activities: Chronicle[] = activitiesResult;
  const staffMember: StaffMember | null = staffResult;

  let patreonLinked = false;
  let hasPatreonHistory = false;
  if (isOwnProfile) {
    const db = createPostgresClient();
    const [tokensCount, membershipsCount, legacyCount] = await Promise.all([
      db
        .from("patreon_oauth_tokens")
        .select("id", { count: "exact", head: true })
        .eq("user_id", profile.id)
        .eq("is_creator", false),
      db
        .from("patreon_memberships")
        .select("id", { count: "exact", head: true })
        .eq("user_id", profile.id),
      db
        .from("patreon_legacy_members")
        .select("id", { count: "exact", head: true })
        .eq("resolved_user_id", profile.id),
    ]);
    patreonLinked = (tokensCount.count ?? 0) > 0;
    hasPatreonHistory =
      (membershipsCount.count ?? 0) > 0 || (legacyCount.count ?? 0) > 0;
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <BreadcrumbSchema
        items={[
          { item: "/", name: "Accueil" },
          { item: "/profil", name: "Profils" },
          {
            item: `/profil/${encodeURIComponent(profile.username ?? username)}`,
            name: profile.username ?? username,
          },
        ]}
      />
      <ProfileSchema
        name={profile.username || username}
        username={profile.username ?? username}
        image={profile.avatar_url || undefined}
        description={profile.bio || undefined}
        url={absoluteUrl(
          `/profil/${encodeURIComponent(profile.username ?? username)}`,
        )}
        sameAs={
          profile.twitter_handle
            ? [`https://twitter.com/${profile.twitter_handle.replace("@", "")}`]
            : undefined
        }
      />

      {/* Carte de joueur : bannière, portrait, nom, description et éléments
			    dans la composition des fiches du jeu. */}
      <div className="mx-auto w-full max-w-5xl px-4 pt-4 sm:px-6 sm:pt-8 lg:px-8">
        <CarteJoueur
          pseudo={profile.username ?? username}
          titre={titreJoueur}
          description={profile.bio}
          avatarUrl={profile.avatar_url}
          banniereUrl={profile.banner_url}
          banniereCadrage={profile.banner_position}
          poste={profile.poste}
          classement={classementServeur}
          badges={profile.badges}
          role={roleDiscord}
          niveau={niveauCommunaute}
        />

        <ProfileIdentity
          website={profile.website}
          twitterHandle={profile.twitter_handle}
          isOwnProfile={isOwnProfile}
        />

        {isOwnProfile && (
          <section
            aria-label="Mon espace personnel"
            className="mb-10 space-y-6"
          >
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

        <div className="mt-8 mb-12">
          <ProfileStats stats={fiche} />
        </div>
      </div>
    </div>
  );
}
