import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Database, FolderTree, Sparkles, Trophy, Users, Zap } from "lucide-react";
import { AnimatedSection } from "@/components/home/AnimatedSection";
import { LandingHero } from "@/components/home/LandingHero";
import { LatestNewsSection } from "@/components/home/LatestNewsSection";
import { NetworkSection } from "@/components/home/NetworkSection";
import { WikiCarousel } from "@/components/home/WikiCarousel";
import type { WikiSectionStats } from "@/components/home/WikiCarousel";
import { getInaglePgPool, getPgPool } from "@rosegriffon/db/pg";
import { absoluteUrl, SITE_URL } from "@/lib/site-url";
import { withDefaultOgImage } from "@/lib/seo";
import { getCharacterImageUrl } from "@rosegriffon/azalee/images";

export const metadata: Metadata = {
  alternates: { canonical: absoluteUrl("/wiki") },
  description: "L'information la plus précise autour d'Inazuma Eleven. Stats, techniques, et actualités en français.",
  openGraph: withDefaultOgImage({
    title: "Azalée - Inazuma Eleven: Victory Road",
    description: "L'information la plus précise autour d'Inazuma Eleven. Stats, techniques, et actualités en français.",
    url: absoluteUrl("/wiki"),
    siteName: "Azalée",
    locale: "fr_FR",
    type: "website",
  }),
  title: "Azalée - Inazuma Eleven: Victory Road",
  twitter: {
    card: "summary_large_image",
    creator: "@Azalee_IE",
    description: "L'information la plus précise autour d'Inazuma Eleven.",
    site: "@Azalee_IE",
    title: "Azalée - Inazuma Eleven: Victory Road",
  },
};

export const dynamic = "force-dynamic";

type WikiCountRow = { key: keyof WikiSectionStats; count: number };

interface FeaturedCharacterRow {
  id: string;
  chara_id: string | null;
  internal_code: string | null;
  name_fr: string | null;
  name_en: string | null;
  element: string | null;
  position: string | null;
  pos_code: string | null;
  rarity: string | null;
  rarity_code: number | null;
  stat_total: number | null;
  image_url: string | null;
}

interface FeaturedSkillRow {
  id: string;
  name_fr: string | null;
  name_en: string | null;
  element: string | null;
  category: string | null;
  power_max: number | null;
  tp_cost: number | null;
  tension_cost: number | null;
  thumbnail_url: string | null;
}

interface VfsStatsRow {
  total_vfs: number;
  total_archives: number;
  total_lua: number;
}

function formatPosition(posCode: string | null, rawPos: string | null): string {
  const code = (posCode || rawPos || "").toUpperCase();
  if (code.includes("GK") || code.includes("GARDIEN")) return "Gardien";
  if (code.includes("FW") || code.includes("ATTAQUANT")) return "Attaquant";
  if (code.includes("MF") || code.includes("MILIEU")) return "Milieu";
  if (code.includes("DF") || code.includes("DÉFENSEUR") || code.includes("DEFENSEUR")) return "Défenseur";
  return rawPos && rawPos !== "Inconnu" ? rawPos : "Joueur";
}

function getElementBadgeClass(element: string | null): string {
  const el = (element || "").toLowerCase();
  if (el.includes("feu") || el.includes("fire")) {
    return "bg-red-500/10 text-red-500 border-red-500/20";
  }
  if (el.includes("vent") || el.includes("wind")) {
    return "bg-sky-500/10 text-sky-400 border-sky-500/20";
  }
  if (el.includes("montagne") || el.includes("mountain") || el.includes("terre")) {
    return "bg-amber-500/10 text-amber-400 border-amber-500/20";
  }
  if (el.includes("forêt") || el.includes("foret") || el.includes("forest") || el.includes("bois")) {
    return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
  }
  return "bg-surface-container text-on-surface-variant border-outline-variant/20";
}

export default async function HomePage() {
  const pool = getPgPool();
  const inaglePool = getInaglePgPool();

  const [
    { rows: pinnedArticles },
    { rows: latestArticles },
    { rows: latestTweets },
    wikiCountsRes,
    featuredCharsRes,
    featuredSkillsRes,
    vfsStatsRes,
  ] = await Promise.all([
    pool
      .query(
        `SELECT * FROM articles
         WHERE status = $1 AND app = $2
         ORDER BY published_at DESC
         LIMIT 1`,
        ["published", "azalee"],
      )
      .catch(() => ({ rows: [] })),
    pool
      .query(
        `SELECT * FROM articles
         WHERE status = $1 AND app = $2
         ORDER BY published_at DESC
         LIMIT 3 OFFSET 1`,
        ["published", "azalee"],
      )
      .catch(() => ({ rows: [] })),
    pool
      .query(
        `SELECT id, text, translation, created_at, author_username, author_name, media
         FROM tweets
         WHERE author_username = $1
         ORDER BY created_at DESC
         LIMIT 6`,
        ["Azalee_IE"],
      )
      .catch(() => ({ rows: [] })),
    inaglePool
      .query<WikiCountRow>(
        `SELECT 'characters'::text AS key, COUNT(*)::int AS count FROM public.inagle_characters
         UNION ALL SELECT 'skills', COUNT(*)::int FROM public.inagle_skills
         UNION ALL SELECT 'items', COUNT(*)::int FROM public.inagle_items
         UNION ALL SELECT 'keshins', COUNT(*)::int FROM public.inagle_keshins_clean
         UNION ALL SELECT 'souls', COUNT(*)::int FROM public.inagle_souls_clean
         UNION ALL SELECT 'passives', COUNT(*)::int FROM public.inagle_passives`,
      )
      .catch(() => ({
        rows: [
          { key: "characters" as const, count: 6111 },
          { key: "skills" as const, count: 1004 },
          { key: "items" as const, count: 1834 },
          { key: "keshins" as const, count: 107 },
          { key: "souls" as const, count: 56 },
          { key: "passives" as const, count: 1844 },
        ],
      })),
    inaglePool
      .query<FeaturedCharacterRow>(
        `SELECT DISTINCT ON (c.name_fr)
           c.id, c.chara_id, c.internal_code, c.name_fr, c.name_en, c.element, c.position,
           c.data->>'position' AS pos_code,
           c.rarity, c.rarity_code, c.stat_total, c.image_url
         FROM public.inagle_characters c
         WHERE c.name_fr IN (
           'Mark Evans', 'Axel Blaze', 'Jude Sharp', 'Shawn Froste', 'Nathan Swift',
           'Xavier Foster', 'Arion Sherwind', 'Victor Blade', 'Riccardo Di Rigo', 'Bailong', 'Sol Daystar', 'Zanark Avalonic'
         )
         ORDER BY c.name_fr, c.rarity_code DESC NULLS LAST
         LIMIT 12`,
      )
      .catch(() => ({ rows: [] })),
    inaglePool
      .query<FeaturedSkillRow>(
        `SELECT id, name_fr, name_en, element, category, power_max, tp_cost, tension_cost, thumbnail_url
         FROM public.inagle_skills
         WHERE name_fr IN (
           'Tornade de feu', 'Main céleste', 'Flèche céleste', 'Tornade du dragon',
           'Tornade noire', 'Tornade inversée', 'Triangle Z', 'Morsure sauvage'
         ) OR power_max >= 360
         ORDER BY power_max DESC NULLS LAST, name_fr ASC
         LIMIT 8`,
      )
      .catch(() => ({ rows: [] })),
    inaglePool
      .query<VfsStatsRow>(
        `SELECT 
           (SELECT COUNT(*)::int FROM nie.vfs_file) AS total_vfs,
           (SELECT COUNT(*)::int FROM nie.vfs_archive) AS total_archives,
           (SELECT COUNT(*)::int FROM nie.lua_script) AS total_lua`,
      )
      .catch(() => ({
        rows: [{ total_vfs: 255308, total_archives: 937, total_lua: 666 }],
      })),
  ]);

  const pinned = (pinnedArticles || []) as any[];
  const latest = (latestArticles || []) as any[];
  const standardNews = [...pinned, ...latest].slice(0, 3);
  const recentTweets = (latestTweets || []) as any[];

  const wikiStats: WikiSectionStats = {
    characters: 6111,
    items: 1834,
    keshins: 107,
    passives: 1844,
    skills: 1004,
    souls: 56,
  };
  for (const { key, count } of wikiCountsRes.rows) {
    wikiStats[key] = count;
  }

  const featuredCharacters = featuredCharsRes.rows;
  const featuredSkills = featuredSkillsRes.rows;
  const vfsMetrics = vfsStatsRes.rows[0] ?? { total_vfs: 255308, total_archives: 937, total_lua: 666 };

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      alternateName: "Azalee Inazuma Eleven Wiki",
      description:
        "Base de données complète Inazuma Eleven: Victory Road. Personnages, techniques, objets et actualités en français.",
      inLanguage: "fr",
      name: "Azalée",
      potentialAction: {
        "@type": "SearchAction",
        "query-input": "required name=search_term_string",
        target: {
          "@type": "EntryPoint",
          urlTemplate: absoluteUrl("/search?q={search_term_string}"),
        },
      },
      publisher: {
        "@type": "Organization",
        logo: {
          "@type": "ImageObject",
          url: absoluteUrl("/icon.webp"),
        },
        name: "Rose Griffon",
        url: SITE_URL,
        founder: {
          "@type": "Person",
          name: "yoyo",
          alternateName: "yoyo",
          url: "https://x.com/yoyo__goat",
          sameAs: ["https://x.com/yoyo__goat"],
        },
      },
      url: absoluteUrl("/wiki"),
    },
    {
      "@context": "https://schema.org",
      "@type": "VideoGame",
      alternateName: ["Inazuma Eleven: Heroes' Great Road", "Inazuma Eleven: Eiyuutachi no Great Road"],
      applicationCategory: "Game",
      description:
        "Jeu de football RPG développé par Level-5. Recrutez des joueurs, maîtrisez les techniques spéciales et menez votre équipe à la victoire.",
      developer: {
        "@type": "Organization",
        name: "Level-5",
      },
      gamePlatform: ["Nintendo Switch", "PlayStation 4", "PlayStation 5"],
      genre: ["Sports", "RPG", "Football"],
      inLanguage: ["ja", "en", "fr", "de", "it", "es", "pt", "zh"],
      name: "Inazuma Eleven: Victory Road",
      publisher: {
        "@type": "Organization",
        name: "Level-5",
        url: "https://www.level5.co.jp/",
      },
      url: "https://www.inazuma.jp/",
    },
  ];

  return (
    <div className="animate-in fade-in duration-700">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Dynamic Landing Hero */}
      <LandingHero stats={wikiStats} />

      {/* Main Content Anchor */}
      <div
        id="home-content"
        className="space-y-8 md:space-y-16 pb-20 mt-8 md:mt-16 max-w-[1800px] mx-auto scroll-mt-24 px-4 md:px-8 lg:px-12"
      >
        {/* Sovereign Database & VFS Metrics Banner */}
        <AnimatedSection direction="up">
          <section className="rounded-3xl border border-outline-variant/15 bg-surface-container/60 backdrop-blur-md p-6 md:p-8">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="flex size-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold uppercase tracking-wider text-primary">
                    Moteur de Connaissance Souverain & VFS
                  </span>
                </div>
                <h2 className="text-xl md:text-2xl font-black text-on-surface tracking-tight">
                  Base de Données Inazuma Eleven: Victory Road
                </h2>
                <p className="text-sm text-on-surface-variant/80 mt-1 max-w-2xl">
                  Catalogue décompressé et indexé en direct : modèles 3D, fichiers audio, animations cut-in,
                  techniques et scripts Lua décodés.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full lg:w-auto">
                <Link
                  href="/wiki/chara"
                  className="p-3.5 rounded-2xl bg-surface-container border border-outline-variant/10 hover:border-primary/40 transition group"
                >
                  <div className="flex items-center gap-1.5 text-xs text-on-surface-variant font-medium">
                    <Users className="size-3.5 text-primary" /> Joueurs
                  </div>
                  <div className="text-lg md:text-xl font-black text-on-surface mt-0.5 group-hover:text-primary transition-colors">
                    {wikiStats.characters.toLocaleString("fr-FR")}
                  </div>
                </Link>

                <Link
                  href="/wiki/skill"
                  className="p-3.5 rounded-2xl bg-surface-container border border-outline-variant/10 hover:border-primary/40 transition group"
                >
                  <div className="flex items-center gap-1.5 text-xs text-on-surface-variant font-medium">
                    <Zap className="size-3.5 text-amber-500" /> Techniques
                  </div>
                  <div className="text-lg md:text-xl font-black text-on-surface mt-0.5 group-hover:text-amber-500 transition-colors">
                    {wikiStats.skills.toLocaleString("fr-FR")}
                  </div>
                </Link>

                <Link
                  href="/wiki/item"
                  className="p-3.5 rounded-2xl bg-surface-container border border-outline-variant/10 hover:border-primary/40 transition group"
                >
                  <div className="flex items-center gap-1.5 text-xs text-on-surface-variant font-medium">
                    <Trophy className="size-3.5 text-emerald-500" /> Objets
                  </div>
                  <div className="text-lg md:text-xl font-black text-on-surface mt-0.5 group-hover:text-emerald-500 transition-colors">
                    {wikiStats.items.toLocaleString("fr-FR")}
                  </div>
                </Link>

                <div className="p-3.5 rounded-2xl bg-surface-container border border-outline-variant/10">
                  <div className="flex items-center gap-1.5 text-xs text-on-surface-variant font-medium">
                    <FolderTree className="size-3.5 text-sky-400" /> Fichiers VFS
                  </div>
                  <div className="text-lg md:text-xl font-black text-on-surface mt-0.5">
                    {vfsMetrics.total_vfs.toLocaleString("fr-FR")}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </AnimatedSection>

        {/* Featured Iconic Characters Showcase */}
        {featuredCharacters.length > 0 && (
          <AnimatedSection direction="up" delay={0.05}>
            <section>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl md:text-2xl font-black text-on-surface tracking-tight flex items-center gap-2">
                    <Sparkles className="size-5 text-amber-500" />
                    Joueurs Emblématiques
                  </h2>
                  <p className="text-xs md:text-sm text-on-surface-variant mt-1">
                    Explorez les fiches détaillées, modèles 3D, animations et statistiques des personnages légendaires
                  </p>
                </div>
                <Link
                  href="/wiki/chara"
                  className="inline-flex items-center gap-1.5 text-xs md:text-sm font-bold text-primary hover:underline group"
                >
                  Voir tous les joueurs ({wikiStats.characters.toLocaleString("fr-FR")})
                  <ArrowRight className="size-4 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5 md:gap-4">
                {featuredCharacters.map(char => {
                  const avatarUrl = char.internal_code
                    ? getCharacterImageUrl(char.internal_code)
                    : char.image_url || "/images/placeholder-character.svg";
                  const posLabel = formatPosition(char.pos_code, char.position);
                  const elBadge = getElementBadgeClass(char.element);

                  return (
                    <Link
                      key={char.id}
                      href={`/wiki/chara/${char.id}`}
                      className="group flex flex-col rounded-2xl border border-outline-variant/15 bg-surface-container p-3.5 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg relative overflow-hidden"
                    >
                      <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-surface-container-high/60 mb-3 flex items-center justify-center">
                        <Image
                          src={avatarUrl}
                          alt={char.name_fr || "Joueur"}
                          fill
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"
                          className="object-contain p-1 transition-transform duration-300 group-hover:scale-110"
                        />
                      </div>

                      <div className="flex-1 flex flex-col justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-on-surface leading-tight group-hover:text-primary transition-colors line-clamp-1">
                            {char.name_fr || char.name_en || "Joueur Inconnu"}
                          </h3>
                          {char.name_en && char.name_en !== char.name_fr && (
                            <p className="text-[10px] text-on-surface-variant/70 line-clamp-1 mt-0.5">
                              {char.name_en}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 mt-2.5">
                          {char.element && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${elBadge}`}>
                              {char.element}
                            </span>
                          )}
                          <span className="text-[10px] font-medium text-on-surface-variant/80 bg-surface-container-highest px-1.5 py-0.5 rounded-md">
                            {posLabel}
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          </AnimatedSection>
        )}

        {/* Featured Skills & Hissatsu Showcase */}
        {featuredSkills.length > 0 && (
          <AnimatedSection direction="up" delay={0.08}>
            <section>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl md:text-2xl font-black text-on-surface tracking-tight flex items-center gap-2">
                    <Zap className="size-5 text-amber-500" />
                    Techniques Spéciales & Hissatsu
                  </h2>
                  <p className="text-xs md:text-sm text-on-surface-variant mt-1">
                    Tirs destructeurs, arrêts divins, dribbles fulgurants et super-techniques
                  </p>
                </div>
                <Link
                  href="/wiki/skill"
                  className="inline-flex items-center gap-1.5 text-xs md:text-sm font-bold text-primary hover:underline group"
                >
                  Voir toutes les techniques ({wikiStats.skills.toLocaleString("fr-FR")})
                  <ArrowRight className="size-4 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {featuredSkills.map(skill => {
                  const elBadge = getElementBadgeClass(skill.element);

                  return (
                    <Link
                      key={skill.id}
                      href={`/wiki/skill/${skill.id}`}
                      className="group flex flex-col rounded-2xl border border-outline-variant/15 bg-surface-container overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg"
                    >
                      {skill.thumbnail_url ? (
                        <div className="relative aspect-[16/9] w-full overflow-hidden bg-black/40">
                          <Image
                            src={skill.thumbnail_url}
                            alt={skill.name_fr || "Technique"}
                            fill
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent" />
                          <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
                            {skill.category && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-white border border-white/10">
                                {skill.category}
                              </span>
                            )}
                            {skill.element && (
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${elBadge} backdrop-blur-md`}>
                                {skill.element}
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="h-2 w-full bg-linear-to-r from-amber-500 to-red-500" />
                      )}

                      <div className="p-4 flex flex-1 flex-col justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-on-surface group-hover:text-primary transition-colors line-clamp-1">
                            {skill.name_fr || skill.name_en || "Technique"}
                          </h3>
                        </div>

                        <div className="flex items-center justify-between text-xs text-on-surface-variant/80 mt-3 pt-2.5 border-t border-outline-variant/10">
                          <div className="flex items-center gap-1">
                            <span className="font-medium">Puissance :</span>
                            <span className="font-bold text-amber-500">{skill.power_max ?? "—"}</span>
                          </div>
                          {skill.tp_cost !== null && skill.tp_cost > 0 && (
                            <div className="flex items-center gap-1">
                              <span className="font-medium">PT :</span>
                              <span className="font-bold text-sky-400">{skill.tp_cost}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          </AnimatedSection>
        )}

        {/* Latest News (3 items) */}
        <AnimatedSection direction="up">
          <section>
            <Suspense fallback={<div className="h-96 animate-pulse bg-surface-container rounded-3xl" />}>
              <LatestNewsSection articles={standardNews} tweets={recentTweets} />
            </Suspense>
          </section>
        </AnimatedSection>

        {/* Section Divider */}
        <div className="flex items-center gap-4 px-8 md:hidden" aria-hidden="true">
          <div className="flex-1 h-px bg-outline-variant/20" />
          <Image src="/logo.webp" alt="" width={20} height={20} className="size-5 opacity-30" />
          <div className="flex-1 h-px bg-outline-variant/20" />
        </div>

        {/* Wiki Carousel */}
        <AnimatedSection direction="scale" delay={0.1}>
          <WikiCarousel stats={wikiStats} />
        </AnimatedSection>

        {/* Réseau Rose Griffon : association (site principal) + Achilléa (compétitif) */}
        <AnimatedSection direction="up" delay={0.05}>
          <NetworkSection />
        </AnimatedSection>
      </div>
    </div>
  );
}
