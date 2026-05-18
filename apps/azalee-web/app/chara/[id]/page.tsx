export const dynamic = "force-dynamic";

import { ArrowLeftRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CharacterSheetWithLevel } from "@/components/wiki/CharacterSheetWithLevel";
import { HowToObtain } from "@/components/wiki/HowToObtain";
import type { MovesetSkill } from "@/components/wiki/MovesetList";
import { formatDescription, formatJapaneseName } from "@/lib/format-description";
import { wikiService } from "@/lib/wiki-service";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const baseChar =
    (await wikiService.getCharacterByBaseSlug(id)) ||
    (await wikiService.getCharacterBySlug(id)) ||
    (await wikiService.getCharacter(id));

  if (!baseChar) {
    return { title: "Personnage introuvable" };
  }

  const name = baseChar.names.fr || baseChar.names.en || "Personnage";
  const variant = baseChar.variants?.[0];
  const posMap: Record<string, string> = {
    GK: "Gardien",
    DF: "Défenseur",
    MF: "Milieu",
    FW: "Attaquant",
  };
  const elemMap: Record<string, string> = {
    Fire: "Feu",
    Wind: "Vent",
    Forest: "Forêt",
    Mountain: "Montagne",
  };
  const pos = variant?.position ? posMap[variant.position] || variant.position : "";
  const elem = variant?.element ? elemMap[variant.element] || variant.element : "";
  const team = (baseChar as any).teams?.[0]?.names?.fr || "";
  const rarity = variant?.rarity || baseChar.bestRarity || "";

  const parts = [name];
  if (pos) parts.push(pos);
  if (elem) parts.push(elem);
  if (team) parts.push(team);
  if (rarity) parts.push(rarity);

  const charDesc = baseChar.descriptions?.fr || baseChar.descriptions?.en || "";
  const shortDesc = charDesc
    ? `${parts.join(" - ")}. ${charDesc.slice(0, 120)}${charDesc.length > 120 ? "..." : ""}`
    : `${parts.join(" - ")}. Stats, techniques et détails dans Inazuma Eleven: Victory Road.`;

  const ogImageUrl = new URL("/api/og/character", "https://azalee.rosegriffon.fr");
  ogImageUrl.searchParams.set("id", id);
  ogImageUrl.searchParams.set("name", name);
  ogImageUrl.searchParams.set("element", variant?.element || "neutral");
  ogImageUrl.searchParams.set("rarity", rarity);
  if (baseChar.image) ogImageUrl.searchParams.set("image", baseChar.image);

  return {
    title: `${name} | Inazuma Eleven Victory Road - Azalée`,
    description: shortDesc,
    alternates: {
      canonical: `/chara/${id}`,
    },
    openGraph: {
      title: `${name} | Azalée`,
      description: shortDesc,
      url: `/chara/${id}`,
      siteName: "Azalée - Inazuma Eleven Victory Road",
      locale: "fr_FR",
      type: "article",
      images: [
        {
          url: ogImageUrl.toString(),
          width: 1200,
          height: 630,
          alt: `${name} - Fiche personnage Azalée`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${name} | Azalée`,
      description: shortDesc,
      images: [ogImageUrl.toString()],
    },
  };
}

export default async function PlayerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // 1. base_slug (name-c0xxxxx) — canonical static URL
  let baseChar = await wikiService.getCharacterByBaseSlug(id);
  // 2. variant slug fallback (legacy: gamma-0xABCD)
  if (!baseChar) baseChar = await wikiService.getCharacterBySlug(id);
  // 3. raw ID fallback
  if (!baseChar) baseChar = await wikiService.getCharacter(id);

  if (!baseChar) {
    notFound();
  }

  // Find the specific variant matching the ID or use first variant if matched by slug
  const variant = baseChar.variants.find((v) => v.charaParamId === id) || baseChar.variants[0];

  if (!variant) {
    notFound();
  }

  // Merge Base and Variant data
  const player = {
    ...variant,
    names: baseChar.names,
    descriptions: baseChar.descriptions,
    internalCode: baseChar.internalCode,
    constellation: baseChar.constellation || variant.constellation,
    teamName: (baseChar as any).teams?.[0]?.names?.fr || (baseChar as any).teams?.[0]?.names?.en,
    teamId: (baseChar as any).teams?.[0]?.id as string | undefined,
  };

  // Fetch all distinct forms of this character (same chara_id, different pos/elem/rarity)
  const forms = await wikiService.getCharacterForms(baseChar.charaId);

  // Map position to UI expected format
  const positionMap: Record<string, string> = {
    GK: "GAR",
    FW: "ATT",
    MF: "MIL",
    DF: "DEF",
    Coach: "COA",
  };
  const displayPosition = positionMap[player.position] || player.position;

  // Stats brutes du Google Sheet (pas de calcul d'interpolation)
  const stats = player.stats.lv99;

  // --- Detect BASARA & Hero ---
  const _isBasara = player.rarity === "BASARA" || (variant as any).rarityCode >= 20;
  const _isHero = player.rarity === "Héros";

  // --- Hero variant forms (Fire / Black / Pink) ---
  const currentFormEntry = forms?.find(
    (f) => f.id === ((variant as any).charaParamId || id),
  );
  const currentHeroType = currentFormEntry?.heroType;
  const pos = currentFormEntry?.position || player.position;
  const elem = currentFormEntry?.element || player.element;
  const heroForms = forms
    ?.filter((f) =>
      f.rarity === "Héros" && f.heroType
      && f.position === pos && f.element === elem,
    )
    .map((f) => ({ type: f.heroType!, slug: f.slug }))
    .sort((a, b) => {
      const order = ["fire", "black", "pink"];
      return order.indexOf(a.type) - order.indexOf(b.type);
    }) || [];

  // --- Helper: resolve skill names from a string (newline or comma separated) ---
  async function resolveSkillNames(raw: string): Promise<MovesetSkill[]> {
    const separator = raw.includes("\n") ? "\n" : ",";
    const moveNames = raw
      .split(separator)
      .map((s) => s.trim())
      .filter((s) => s && !s.startsWith("#N/A") && !s.startsWith("Mix "));
    const resolved = await Promise.all(moveNames.map((name) => wikiService.getSkill(name)));
    const result: MovesetSkill[] = [];
    for (let index = 0; index < resolved.length; index++) {
      const skill = resolved[index];
      const isPassive = skill?.categoryName?.fr?.toLowerCase() === "talent";
      if (skill) {
        result.push({
          id: (skill as any).skillId || skill.skillID || skill.skillIDStr,
          name: skill.displayName || skill.name_FR || skill.name_EN || "???",
          power: skill.power_min ? `${skill.power_min}` : undefined,
          tension: (skill as any).consumeTp || (skill as any).tension_cost,
          element: skill.elementName?.en?.toLowerCase(),
          isPassive,
          slotNumber: index + 1,
          imageUrl: skill.image,
          videoUrl: (skill as any).videoUrl,
          category: skill.categoryName?.fr || "Spécial",
          growthType: (skill as any).growthType,
        });
      } else {
        // Fallback: try as aura (Keeper's Grit, Burning Overdrive, etc.)
        const aura = await wikiService.findAuraByName(moveNames[index]);
        if (aura) {
          result.push({
            id: aura.id,
            name: aura.name_fr || aura.name_en || moveNames[index],
            slotNumber: index + 1,
            category: "Hyper Technique",
            isPassive: false,
            href: `/aura/${aura.categorySlug || "autres"}/${aura.id}`,
          });
        } else {
          result.push({
            id: `unresolved-${index}`,
            name: moveNames[index],
            slotNumber: index + 1,
            category: "Hyper Technique",
          });
        }
      }
    }
    return result;
  }

  // --- Helper: déduplique les skills et affiche le niveau d'évolution final ---
  // Si "Tornade de Feu" apparaît 3x → une seule ligne "Tornade de Feu 3"
  // 3 types : nombres (2,3), V (V2,V3), N (N2,N3)
  // growthType 1,2 → nombres | growthType 3 → N | growthType 7 → V
  function collapseEvolutions(skills: MovesetSkill[]): MovesetSkill[] {
    const countMap = new Map<string, number>();
    const lastMap = new Map<string, MovesetSkill>();
    for (const skill of skills) {
      const count = (countMap.get(skill.name) || 0) + 1;
      countMap.set(skill.name, count);
      lastMap.set(skill.name, skill);
    }
    const seen = new Set<string>();
    const result: MovesetSkill[] = [];
    let slot = 1;
    for (const skill of skills) {
      if (seen.has(skill.name)) continue;
      seen.add(skill.name);
      const total = countMap.get(skill.name) || 1;
      const entry = { ...lastMap.get(skill.name)!, slotNumber: slot++ };
      if (total > 1) {
        entry.evolutionLevel = total;
        const gt = entry.growthType ?? 0;
        if (gt === 7) {
          entry.evolutionSuffix = `V${total}`;
        } else if (gt === 3) {
          entry.evolutionSuffix = `N${total}`;
        } else {
          entry.evolutionSuffix = `${total}`;
        }
      }
      result.push(entry);
    }
    return result;
  }

  // --- Fetch Skills & Passives ---
  // Approche unifiée : sheetData.moveset/altMoveset pour TOUS (BASARA, Héros, normaux)
  const moveset: MovesetSkill[] = [];
  const altMoveset: MovesetSkill[] = [];

  const movesetRaw = (player as any).sheetData?.moveset as string | undefined;
  const altMovesetRaw = (player as any).sheetData?.altMoveset as string | undefined;

  if (movesetRaw) {
    const resolved = await resolveSkillNames(movesetRaw);
    moveset.push(...collapseEvolutions(resolved));
  }
  if (altMovesetRaw) {
    const resolved = await resolveSkillNames(altMovesetRaw);
    altMoveset.push(...collapseEvolutions(resolved));
  }

  // Fallback: resolve binary skill IDs from chara_param
  // NOTE: mapDbCharacterToBase corrige déjà le mapping inversé du parser :
  //   skillId = hash hex du skill (ex: "0xF9B80F86")
  //   learnLevel = niveau d'apprentissage réel (ex: 1, 13, 20...)
  if (moveset.length === 0) {
    const vAny = variant as any;
    const rawSkills: Array<{ learnLevel: number; skillId: string }> | string[] =
      vAny.skills || vAny.moves || [];

    // Filter out phantom skill IDs (aura-dependent special slot)
    const PHANTOM_IDS = new Set(["0xDBEDB6B8"]);
    const skillList = rawSkills
      .map((s) => {
        if (typeof s === "string") return { skillId: s, learnLevel: 0 };
        return s;
      })
      .filter((s) => !PHANTOM_IDS.has(s.skillId));

    const skillPromises = skillList.map((s) => wikiService.getSkill(s.skillId));
    const fetchedSkills = await Promise.all(skillPromises);

    const unsorted: MovesetSkill[] = [];
    fetchedSkills.forEach((skill, index) => {
      if (!skill) return;
      const learnLevel = skillList[index]?.learnLevel || 0;
      const isPassive =
        skill.categoryName?.en?.toLowerCase() === "passive" ||
        skill.categoryName?.fr?.toLowerCase() === "talent" ||
        (skill as any).skillType === "passive";

      unsorted.push({
        id: (skill as any).skillId || skill.skillID || skill.skillIDStr,
        name: skill.displayName || skill.name_FR || skill.name_EN || "???",
        power: skill.power_min ? `${skill.power_min}` : undefined,
        tension: (skill as any).consumeTp || (skill as any).tension_cost,
        element: skill.elementName?.en?.toLowerCase(),
        isPassive,
        slotNumber: 0,
        learnLevel,
        imageUrl: skill.image,
        videoUrl: (skill as any).videoUrl,
        category: skill.categoryName?.fr || "Spécial",
      });
    });

    // Trier par niveau d'apprentissage (ordre du zukan)
    unsorted.sort((a, b) => (a.learnLevel || 0) - (b.learnLevel || 0));
    unsorted.forEach((s, i) => {
      s.slotNumber = i + 1;
    });
    moveset.push(...unsorted);

    // Fallback alt moveset from firstMoves
    const firstMovesRaw = (player as any).sheetData?.firstMoves as string | undefined;
    if (firstMovesRaw) {
      const resolved = await resolveSkillNames(firstMovesRaw);
      altMoveset.push(...resolved);
    }

    // Last resort: derive alt moveset from first 3 non-passive binary skills
    if (altMoveset.length === 0 && moveset.length > 0) {
      const nonPassive = moveset.filter((s) => !s.isPassive);
      const first3 = nonPassive.slice(0, 3);
      for (let i = 0; i < first3.length; i++) {
        altMoveset.push({ ...first3[i], slotNumber: i + 1 });
      }
    }
  }

  // IEVR : toujours 6 techniques par moveset
  const moveLimit = 6;
  const limitedMoveset = moveset.slice(0, moveLimit);
  const limitedAltMoveset = altMoveset.slice(0, moveLimit);

  const charName = player.names.fr || player.names.en || player.names.ja || "Personnage";

  const POSITION_FR: Record<string, string> = {
    GK: "Gardien",
    DF: "Défenseur",
    MF: "Milieu de terrain",
    FW: "Attaquant",
    Coach: "Entraîneur",
  };
  const ELEMENT_FR: Record<string, string> = {
    Fire: "Feu",
    Wind: "Vent",
    Forest: "Forêt",
    Mountain: "Montagne",
  };

  const skillNames = limitedMoveset.filter((s) => !s.isPassive).map((s) => s.name);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: charName,
    alternateName: [player.names.en, player.names.ja].filter(Boolean),
    description:
      player.descriptions?.fr ||
      player.descriptions?.en ||
      `${charName} est un joueur ${POSITION_FR[player.position] || player.position} de type ${ELEMENT_FR[player.element] || player.element} dans Inazuma Eleven: Victory Road.`,
    url: `https://azalee.rosegriffon.fr/chara/${baseChar.slug || id}`,
    image: baseChar.image || undefined,
    jobTitle: POSITION_FR[player.position] || player.position,
    memberOf: player.teamName ? { "@type": "SportsTeam", name: player.teamName } : undefined,
    knowsAbout: skillNames.length > 0 ? skillNames : undefined,
    additionalType: "https://schema.org/FictionalCharacter",
    isPartOf: {
      "@type": "VideoGame",
      name: "Inazuma Eleven: Victory Road",
      publisher: { "@type": "Organization", name: "Level-5" },
    },
    genre: (baseChar as any).series || undefined,
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: "https://azalee.rosegriffon.fr" },
      {
        "@type": "ListItem",
        position: 2,
        name: "Joueurs",
        item: "https://azalee.rosegriffon.fr/chara",
      },
      { "@type": "ListItem", position: 3, name: charName },
    ],
  };

  return (
    <div className="w-full space-y-4 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      {/* Breadcrumb + Compare link */}
      <div className="flex items-center justify-between">
        <nav
          aria-label="Fil d'Ariane"
          className="flex items-center gap-2 text-sm text-on-surface-variant"
        >
          <Link href="/chara" className="hover:underline">
            Joueurs
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-on-surface" aria-current="page">
            {charName}
          </span>
        </nav>
        <Link
          href={`/tools/compare?char1=${baseChar.slug || id}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant hover:text-primary transition-all"
        >
          <ArrowLeftRight size={16} aria-hidden="true" />
          Comparer
        </Link>
      </div>

      {/* Character Sheet - Game-style UI with level toggle */}
      <CharacterSheetWithLevel
        name={player.names.fr || player.names.en || "Nom inconnu"}
        names={player.names}
        nickname={formatJapaneseName(player.names.ja) || undefined}
        description={formatDescription(player.descriptions?.fr || player.descriptions?.en, "fr")}
        descriptions={player.descriptions}
        position={displayPosition as "ATT" | "MIL" | "DEF" | "GAR"}
        jerseyNumber={10}
        rarity={player.rarity}
        element={player.element}
        series={(baseChar as any).series}
        gender={(baseChar as any).gender === 1 ? "F" : "M"}
        stats={{
          kick: stats.kick,
          control: stats.control,
          technique: stats.technique,
          pressure: stats.pressure,
          physical: stats.physical,
          agility: stats.agility,
          intelligence: stats.intelligence || 0,
        }}
        skills={limitedMoveset}
        altSkills={_isBasara && limitedAltMoveset.length > 0 ? limitedAltMoveset : undefined}
        avatarUrl={(player as any).image || player.internalCode}
        zukanHash={player.zukanHash}
        teamName={player.teamName}
        teamId={player.teamId}
        prevCharacterId={undefined}
        nextCharacterId={undefined}
        sheetData={(player as any).sheetData}
        constellation={player.constellation}
        heroConstellations={(baseChar as any).heroConstellations}
        forms={forms}
        currentFormId={(variant as any).charaParamId || id}
        slug={(variant as any).slug || baseChar.slug || id}
        basaraFormSlug={
          !_isBasara && forms?.find((f) => f.rarity === "BASARA")
            ? forms.find((f) => f.rarity === "BASARA")!.slug
            : undefined
        }
        normalFormSlug={
          _isBasara && forms?.find((f) => f.rarity !== "BASARA" && f.rarity !== "Héros")
            ? forms.find((f) => f.rarity !== "BASARA" && f.rarity !== "Héros")!.slug
            : undefined
        }
        heroForms={heroForms.length > 1 ? heroForms : undefined}
        currentHeroType={currentHeroType}
        isControllable={(player as any).isControllable || (baseChar as any).isControllable}
        statsLv1={player.stats.lv1 ? {
          kick: player.stats.lv1.kick,
          control: player.stats.lv1.control,
          technique: player.stats.lv1.technique,
          pressure: player.stats.lv1.pressure,
          physical: player.stats.lv1.physical,
          agility: player.stats.lv1.agility,
          intelligence: player.stats.lv1.intelligence || 0,
        } : undefined}
      />

      {/* Info Panel — Series, Apparitions */}
      <div className="bg-surface-container-low rounded-[20px] sm:rounded-[24px] border border-outline-variant/30 px-4 py-3 sm:px-6 sm:py-5 space-y-3 sm:space-y-5">
        {/* Series + Control Type */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {(baseChar as any).series && (
            <span className="inline-flex items-center px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-bold bg-secondary-container text-on-secondary-container">
              {(baseChar as any).series}
            </span>
          )}
          {(baseChar as any).controlType && (
            <span className="inline-flex items-center px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-medium bg-tertiary-container text-on-tertiary-container">
              {(baseChar as any).controlType}
            </span>
          )}
          {(baseChar as any).isControllable && (
            <span className="inline-flex items-center px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-medium bg-primary/10 text-primary border border-primary/20">
              Jouable
            </span>
          )}
        </div>

        {/* Game Appearances */}
        {(baseChar as any).gameAppearances && (baseChar as any).gameAppearances.length > 0 && (
          <div>
            <h3 className="text-[10px] sm:text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1.5 sm:mb-2">
              Apparitions
            </h3>
            <div className="flex flex-wrap gap-1 sm:gap-1.5">
              {(baseChar as any).gameAppearances.map((g: string) => {
                const labels: Record<string, string> = {
                  ie1: "IE 1", ie2: "IE 2", ie3: "IE 3",
                  go1: "GO", go2: "Chrono Stone", go3: "Galaxy",
                  ars: "Ares", ori: "Orion", vic: "Victory Road",
                };
                return (
                  <span
                    key={g}
                    className="inline-flex items-center px-2 py-0.5 sm:px-2.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-surface-container-high text-on-surface-variant"
                  >
                    {labels[g] || g}
                  </span>
                );
              })}
            </div>
          </div>
        )}

      </div>

      {/* Wiki Sections (History, Recruitment, etc.) */}
      {(player as any).wikiSections && (player as any).wikiSections.length > 0 && (
        <div className="bg-surface-container-low rounded-[20px] sm:rounded-[24px] border border-outline-variant/30 px-4 py-5 sm:px-8 sm:py-8 space-y-6 sm:space-y-10">
          {(player as any).wikiSections.map((section: any, i: number) => (
            <div key={i} className="space-y-2 sm:space-y-4">
              <h3 className="text-lg sm:text-2xl font-bold font-grade-high text-on-surface border-b-2 border-primary/20 pb-1.5 sm:pb-2 inline-block">
                {section.title}
              </h3>
              <div className="prose prose-sm sm:prose-lg dark:prose-invert max-w-none text-on-surface-variant leading-relaxed whitespace-pre-wrap font-medium">
                {section.content}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* How to Obtain Section */}
      <HowToObtain
        constellation={player.constellation}
        heroConstellations={(baseChar as any).heroConstellations}
        spiritExchange={(baseChar as any).sheetData?.spiritExchange}
      />
    </div>
  );
}
