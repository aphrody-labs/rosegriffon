import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Crown, Search, ShieldCheck, Sparkles, Zap } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { WikiPagination } from "@/components/shared/WikiPagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { parseSearchParams } from "@/lib/validations";

// --- Types ---

interface DiscordMember {
  discord_id: string;
  username: string;
  display_name: string | null;
  nickname: string | null;
  avatar_url: string | null;
  joined_at: string | null;
  premium_since: string | null;
  roles: string[]; // Stored as jsonb in DB, treated as string[] at runtime
  is_bot: boolean | null;
  updated_at: string | null;
}

// --- Constants ---

const MEDAILLE_ROLE_ID = "1364903623783612498";
const ADMIN_ROLE_ID = "1072993826400124958";
const VICE_ADMIN_ROLE_ID = "1371547071362105374";
const MOD_RESP_ROLE_ID = "1267847004919300096";
const ITEMS_PER_PAGE = 24;

// --- Components ---

function MemberCard({ member }: { member: DiscordMember }) {
  const isMedaille = member.roles?.includes(MEDAILLE_ROLE_ID);
  const isBooster = !!member.premium_since;
  const displayName = member.nickname || member.display_name || member.username;

  return (
    <div
      className={cn(
        "group relative rounded-[24px] p-4 border transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 overflow-hidden",
        isMedaille
          ? "bg-surface-container border-primary/40 shadow-primary/10"
          : "bg-surface-container-low border-outline-variant/10 hover:bg-surface-container shadow-lg"
      )}
    >
      {/* Premium Glow effect for Médaille Azalée */}
      {isMedaille && (
        <>
          <div className="absolute -inset-[2px] bg-linear-to-r from-primary via-secondary to-primary rounded-[26px] opacity-20 group-hover:opacity-100 blur-sm transition-opacity duration-500" />
          <div className="absolute inset-0 bg-surface-container rounded-[24px] m-[1px]" />
          <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-100 transition-opacity">
            <Sparkles className="size-5 text-primary animate-pulse" />
          </div>
        </>
      )}

      {/* Background decoration for boosters */}
      {isBooster && !isMedaille && (
        <div className="absolute inset-0 rounded-[24px] bg-secondary/5 border border-secondary/20 pointer-events-none" />
      )}

      <div className="relative flex flex-col items-center text-center gap-3">
        {/* Avatar with specific ring */}
        <div
          className={cn(
            "relative size-20 md:size-24 rounded-full overflow-hidden border-4 transition-all duration-500 group-hover:scale-105",
            isMedaille
              ? "border-primary ring-4 ring-primary/20 shadow-lg"
              : "border-surface-container-high ring-2 ring-primary/10"
          )}
        >
          <Image
            src={member.avatar_url || "/default-avatar.webp"}
            alt={member.username}
            fill
            className="object-cover"
          />
        </div>

        {/* Info */}
        <div className="space-y-1 w-full">
          <div className="flex items-center justify-center gap-1.5 flex-wrap">
            <h3
              className={cn(
                "font-bold text-on-surface truncate max-w-[150px]",
                isMedaille && "text-primary text-lg"
              )}
              title={displayName}
            >
              {displayName}
            </h3>
            {isMedaille && (
              <span title="Équipe Azalée">
                <ShieldCheck className="size-4 text-primary" />
              </span>
            )}
            {isBooster && (
              <span title="Booster">
                <Zap className="size-4 text-secondary fill-secondary" />
              </span>
            )}
          </div>
          <p className="text-xs text-on-surface-variant/70 truncate">@{member.username}</p>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap justify-center gap-1.5 mt-1">
          {isMedaille && (
            <Badge className="bg-primary text-on-primary text-[10px] py-0 px-2 rounded-full border-none shadow-sm pointer-events-none uppercase tracking-wider font-black">
              Azalée Team
            </Badge>
          )}
          {isBooster && (
            <Badge className="bg-secondary text-on-secondary text-[10px] py-0 px-2 rounded-full border-none shadow-sm pointer-events-none">
              BOOSTER
            </Badge>
          )}
          {member.joined_at && (
            <span className="text-[10px] text-on-surface-variant/50 w-full mt-1">
              Depuis {formatDistanceToNow(new Date(member.joined_at), { locale: fr })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionTitle({
  title,
  icon: Icon,
  colorClass = "text-primary",
}: {
  title: string;
  icon: React.ElementType;
  colorClass?: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-8">
      <div className={`p-2.5 rounded-2xl bg-surface-container-high ${colorClass}`}>
        <Icon className="size-6" />
      </div>
      <h2 className="text-2xl font-bold font-outfit text-on-surface tracking-tight">{title}</h2>
      <div className="h-px flex-1 bg-outline-variant/20 ml-4" />
    </div>
  );
}

// --- Main Page ---

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q : "";
  const { page: currentPage } = parseSearchParams(params);

  const supabase = await createClient();

  // 0. Fetch Roles for hierarchy
  const { data: rolesData } = await supabase.from("discord_roles").select("role_id, position");
  const roleMap = new Map<string, number>();

  // Default priorities if DB is empty or missing roles
  roleMap.set(ADMIN_ROLE_ID, 10000);
  roleMap.set(VICE_ADMIN_ROLE_ID, 9000);
  roleMap.set(MOD_RESP_ROLE_ID, 8000);
  roleMap.set(MEDAILLE_ROLE_ID, 5000);

  if (rolesData) {
    rolesData.forEach((r: { role_id: string; position: number }) =>
      roleMap.set(r.role_id, r.position)
    );
  }

  // 1. Fetch ALL members
  let mainQuery = supabase.from("discord_members").select("*").eq("is_bot", false);

  if (query) {
    mainQuery = mainQuery.or(
      `username.ilike.%${query}%,display_name.ilike.%${query}%,nickname.ilike.%${query}%`
    );
  }

  const { data: allMembersRaw } = await mainQuery;
  const allMembers = (allMembersRaw || []) as unknown as DiscordMember[];

  // 2. Sort by Highest Role Position
  const getHighestRole = (m: DiscordMember) => {
    if (!m.roles || m.roles.length === 0) return 0;
    return Math.max(...m.roles.map((r) => roleMap.get(r) || 0));
  };

  allMembers.sort((a, b) => {
    const rankA = getHighestRole(a);
    const rankB = getHighestRole(b);

    if (rankA !== rankB) return rankB - rankA; // Descending (Higher position = Higher rank)

    // Secondary sort: Joined At
    return new Date(b.joined_at || 0).getTime() - new Date(a.joined_at || 0).getTime();
  });

  const totalMembers = allMembers.length;

  // 3. Derived Sections (Only on first page and no search)
  let adminsData: DiscordMember[] = [];
  let modsData: DiscordMember[] = [];
  let medailleData: DiscordMember[] = [];
  let boostersData: DiscordMember[] = [];

  if (currentPage === 1 && !query) {
    adminsData = allMembers.filter((m) =>
      m.roles?.some((r) => r === ADMIN_ROLE_ID || r === VICE_ADMIN_ROLE_ID)
    );
    modsData = allMembers.filter((m) => m.roles?.includes(MOD_RESP_ROLE_ID));
    medailleData = allMembers.filter((m) => m.roles?.includes(MEDAILLE_ROLE_ID)); // Already sorted by role/join
    boostersData = allMembers
      .filter((m) => !!m.premium_since)
      .sort((a, b) => new Date(b.premium_since!).getTime() - new Date(a.premium_since!).getTime())
      .slice(0, 12);
  }

  // 4. Paginate
  const paginatedMembers = allMembers.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header Section */}
      <div className="bg-surface-container-low border-b border-outline-variant/10">
        <div className="container mx-auto px-4 md:px-8 py-16 md:py-20 lg:py-24">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary font-bold text-sm mb-6">
              <Crown className="size-4" />
              L&apos;Information la plus précise
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-7xl font-bold font-outfit text-on-surface mb-6 tracking-tight">
              La Communauté <span className="text-primary italic">Rose Griffon</span>
            </h1>
            <p className="text-lg md:text-xl text-on-surface-variant leading-relaxed mb-10">
              Rejoignez plus de <span className="text-on-surface font-bold">2 000 coachs</span>{" "}
              passionnés. Retrouvez ici les acteurs qui font vivre l&apos;écosystème.
            </p>

            {/* Search Bar */}
            <form action="/community" className="max-w-xl mx-auto relative group">
              <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                <Search className="size-5 text-on-surface-variant/50 group-focus-within:text-primary transition-colors" />
              </div>
              <Input
                name="q"
                defaultValue={query}
                placeholder="Chercher un membre par son nom..."
                className="h-14 pl-14 pr-6 rounded-full bg-surface-container-high border-outline-variant/30 focus:border-primary focus:ring-4 focus:ring-primary/10 text-lg transition-all"
              />
            </form>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 md:px-8 py-12">
        {/* Admin Section */}
        {adminsData.length > 0 && (
          <section className="mb-20">
            <SectionTitle title="Administration" icon={ShieldCheck} />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
              {adminsData.map((member: DiscordMember) => (
                <MemberCard key={member.discord_id} member={member} />
              ))}
            </div>
          </section>
        )}

        {/* Mod Section */}
        {modsData.length > 0 && (
          <section className="mb-20">
            <SectionTitle title="Modération" icon={ShieldCheck} />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
              {modsData.map((member: DiscordMember) => (
                <MemberCard key={member.discord_id} member={member} />
              ))}
            </div>
          </section>
        )}

        {/* Médaille Azalée Section (Team Azalée) */}
        {medailleData.length > 0 && (
          <section className="mb-20">
            <SectionTitle title="Équipe Azalée" icon={ShieldCheck} />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
              {medailleData.map((member: DiscordMember) => (
                <MemberCard key={member.discord_id} member={member} />
              ))}
            </div>
          </section>
        )}

        {/* Dash Section (Static spacer if needed) */}
        {(adminsData.length > 0 || modsData.length > 0) && <div className="my-12 opacity-10" />}

        {/* Boosters Section */}
        {boostersData.length > 0 && (
          <section className="mb-20">
            <SectionTitle title="Boosters de Légende" icon={Zap} colorClass="text-secondary" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
              {boostersData.map((member: DiscordMember) => (
                <MemberCard key={member.discord_id} member={member} />
              ))}
            </div>
            <div className="mt-8 flex justify-center">
              <p className="text-sm text-on-surface-variant italic">
                Merci à tous ceux qui soutiennent le serveur Discord ! 🌸
              </p>
            </div>
          </section>
        )}

        {/* All Members List */}
        <section>
          <SectionTitle
            title={query ? `Résultats pour "${query}"` : "Tous les Membres (Par Rang)"}
            icon={Search}
            colorClass="text-on-surface-variant"
          />

          {paginatedMembers.length > 0 ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                {paginatedMembers.map((member: DiscordMember) => (
                  <MemberCard key={member.discord_id} member={member} />
                ))}
              </div>

              <div className="mt-16">
                <WikiPagination
                  totalItems={totalMembers}
                  itemsPerPage={ITEMS_PER_PAGE}
                  currentPage={currentPage}
                />
              </div>
            </>
          ) : (
            <div className="py-24 text-center rounded-[40px] border-2 border-dashed border-outline-variant/30 bg-surface-container-lowest">
              <p className="text-lg text-on-surface-variant">
                Aucun membre trouvé pour cette recherche.
              </p>
              <Button variant="link" asChild className="mt-2 text-primary">
                <Link href="/community">Voir tous les membres</Link>
              </Button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
