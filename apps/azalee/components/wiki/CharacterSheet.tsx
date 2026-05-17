"use client";

import {
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  FileText,
  Gamepad2,
  PlayCircle,
  Sparkles,
  Star,
  TrendingUp,
} from "lucide-react";
import NextImage from "next/image";
import NextLink from "next/link";
import { useState } from "react";
import { useLanguage } from "@/components/providers/language-provider";
import { CommonSpriteIcon } from "@/components/ui/CommonSpriteIcon";
import { RarityBadge } from "@/components/ui/rarity-badge";
import { SafeImage } from "@/components/ui/SafeImage";
import type { SpriteCommonKey } from "@/config/sprites-common";
import {
  getCharacterFaceUrl,
  getCharacterUniformBackUrl,
  getCharacterUniformUrl,
  getEmblemImageUrl,
  getSkillCategoryIconUrl,
  getSkillElementIconUrl,
} from "@/lib/images";
import { japaneseToRomaji } from "@/lib/japanese-romaji";
import { TEAM_EMBLEM_MAP } from "@/lib/team-emblem-map";
import { cn } from "@/lib/utils";
import { FormSelector } from "./FormSelector";
import type { MovesetSkill } from "./MovesetList";
import { StatHeptagon } from "./StatHeptagon";

// Position badge colors - matching game exactly
const POSITION_COLORS: Record<string, string> = {
  ATT: "bg-[#e53935] text-white",
  MIL: "bg-[#43a047] text-white",
  DEF: "bg-[#1e88e5] text-white",
  GAR: "bg-[#fdd835] text-[#5d4037]",
};

// Element gradient backgrounds for hero header
const ELEMENT_GRADIENTS: Record<string, string> = {
  Fire: "from-red-950 via-orange-900/90 to-amber-800/70",
  Wind: "from-emerald-950 via-teal-900/90 to-cyan-800/70",
  Forest: "from-green-950 via-lime-900/90 to-emerald-800/70",
  Mountain: "from-amber-950 via-yellow-900/90 to-orange-800/70",
  Void: "from-slate-950 via-gray-900/90 to-zinc-800/70",
};

// Element display names FR
const ELEMENT_FR: Record<string, string> = {
  Fire: "Feu",
  Wind: "Vent",
  Forest: "Forêt",
  Mountain: "Montagne",
  Void: "Néant",
};

// Rarity display names
// Rarity display is now handled by RarityBadge component

// Position mapping
const POSITION_MAP: Record<string, string> = {
  FW: "ATT",
  MF: "MIL",
  DF: "DEF",
  GK: "GAR",
  ATT: "ATT",
  MIL: "MIL",
  DEF: "DEF",
  GAR: "GAR",
};

// Position FR full names
const POSITION_FR: Record<string, string> = {
  ATT: "Attaquant",
  MIL: "Milieu",
  DEF: "Défenseur",
  GAR: "Gardien",
};

export interface CharacterSheetStats {
  kick: number;
  control: number;
  technique: number;
  pressure: number;
  physical: number;
  agility: number;
  intelligence: number;
}

export interface SheetData {
  playstyle?: string;
  firstMoves?: string;
  paths?: { main: string; alt: string };
  matchedName?: string;
  heroVariants?: Array<{ playstyle: string; moveset: string[] }>;
}

const PLAYSTYLE_FR: Record<string, string> = {
  Justice: "Justice",
  Bond: "Lien",
  Counter: "Contre",
  Breach: "Brèche",
  Freedom: "Brèche",
  "Rough Play": "Jeu violent",
  Tension: "Tension",
};

// Game-accurate playstyle colors (inline styles — Tailwind can't purge dynamic classes)
const PLAYSTYLE_COLOR: Record<
  string,
  { bg: string; text: string; border: string; gradient?: string }
> = {
  Justice: { bg: "rgba(217,119,6,0.15)", text: "#fbbf24", border: "rgba(217,119,6,0.35)" },
  Bond: { bg: "rgba(234,179,8,0.15)", text: "#fde047", border: "rgba(234,179,8,0.35)" },
  Counter: { bg: "rgba(148,163,184,0.12)", text: "#cbd5e1", border: "rgba(148,163,184,0.30)" },
  Breach: {
    bg: "transparent",
    text: "#e2e8f0",
    border: "rgba(168,85,247,0.30)",
    gradient:
      "linear-gradient(135deg, rgba(239,68,68,0.12), rgba(245,158,11,0.12), rgba(234,179,8,0.12), rgba(16,185,129,0.12), rgba(59,130,246,0.12), rgba(139,92,246,0.12))",
  },
  Freedom: {
    bg: "transparent",
    text: "#e2e8f0",
    border: "rgba(168,85,247,0.30)",
    gradient:
      "linear-gradient(135deg, rgba(239,68,68,0.12), rgba(245,158,11,0.12), rgba(234,179,8,0.12), rgba(16,185,129,0.12), rgba(59,130,246,0.12), rgba(139,92,246,0.12))",
  },
  "Rough Play": { bg: "rgba(16,185,129,0.15)", text: "#6ee7b7", border: "rgba(16,185,129,0.35)" },
  Tension: { bg: "rgba(239,68,68,0.15)", text: "#fca5a5", border: "rgba(239,68,68,0.35)" },
};

const PLAYSTYLE_SPRITE: Record<string, SpriteCommonKey> = {
  Justice: "justice",
  Bond: "lien",
  Counter: "contre",
  Breach: "breche",
  Freedom: "breche",
  "Rough Play": "jeu_violent",
  Tension: "tension",
};

const PATH_TYPE_FR: Record<string, string> = {
  Keep: "Arrêt",
  Shoot: "Tir",
  Offense: "Attaque",
  Defense: "Défense",
  Dribble: "Dribble",
};

const HERO_LABELS: Record<string, string> = { fire: "Feu", black: "Ombre", pink: "Rose" };
const HERO_GRADIENTS: Record<string, string> = {
  fire: "from-red-500 to-orange-400",
  black: "from-gray-700 to-gray-900",
  pink: "from-pink-400 to-rose-300",
};
const HERO_HOVER: Record<string, string> = {
  fire: "text-red-300/70 hover:text-red-200 hover:bg-red-500/20",
  black: "text-gray-300/70 hover:text-gray-200 hover:bg-gray-500/20",
  pink: "text-pink-300/70 hover:text-pink-200 hover:bg-pink-500/20",
};

function HeroTypeSelector({
  heroForms,
  currentHeroType,
}: {
  heroForms: Array<{ type: string; slug: string }>;
  currentHeroType?: string;
}) {
  return (
    <div className="flex rounded-full p-0.5 border border-amber-500/30 bg-amber-950/20">
      {heroForms.map((hf) => {
        const isCurrent = hf.type === currentHeroType;
        return isCurrent ? (
          <span
            key={hf.type}
            className={cn(
              "px-3 py-1 rounded-full text-[11px] font-bold bg-linear-to-r text-white shadow-sm",
              HERO_GRADIENTS[hf.type],
            )}
          >
            {HERO_LABELS[hf.type] || hf.type}
          </span>
        ) : (
          <NextLink
            key={hf.type}
            href={`/chara/${hf.slug}`}
            prefetch
            className={cn(
              "px-3 py-1 rounded-full text-[11px] font-bold transition-all",
              HERO_HOVER[hf.type],
            )}
          >
            {HERO_LABELS[hf.type] || hf.type}
          </NextLink>
        );
      })}
    </div>
  );
}

export interface CharacterSheetProps {
  name: string;
  nickname?: string;
  description?: string;
  position: "ATT" | "MIL" | "DEF" | "GAR" | "FW" | "MF" | "DF" | "GK";
  jerseyNumber?: number;
  rarity: string;
  element: string;
  series?: string;
  stats: CharacterSheetStats;
  skills?: MovesetSkill[];
  altSkills?: MovesetSkill[];
  avatarUrl?: string;
  zukanHash?: string;
  teamName?: string;
  teamId?: string;
  gender?: string;
  className?: string;
  prevCharacterHref?: string;
  nextCharacterHref?: string;
  sheetData?: SheetData;
  constellation?: { index: number; names: { fr?: string; en?: string; ja?: string } };
  heroConstellations?: Array<{ name: string; index: number }>;
  forms?: Array<{
    id: string;
    slug: string;
    position: string;
    element: string;
    rarity: string;
    zukanHash?: string;
    internalCode?: string;
    heroType?: string;
  }>;
  currentFormId?: string;
  slug?: string;
  basaraFormSlug?: string;
  normalFormSlug?: string;
  heroForms?: Array<{ type: string; slug: string }>;
  currentHeroType?: string;
  isControllable?: boolean;
  statsLv1?: CharacterSheetStats;
}

export function CharacterSheet({
  name,
  nickname,
  description,
  position,
  rarity,
  element,
  series,
  stats,
  skills = [],
  altSkills,
  avatarUrl,
  zukanHash,
  teamName,
  teamId,
  gender,
  className,
  prevCharacterHref,
  nextCharacterHref,
  sheetData,
  constellation,
  heroConstellations,
  forms,
  currentFormId,
  slug,
  basaraFormSlug,
  normalFormSlug,
  heroForms,
  currentHeroType,
  isControllable,
  statsLv1,
}: CharacterSheetProps) {
  const displayPosition = POSITION_MAP[position] || "MIL";
  const { t: _t } = useLanguage();
  const [activeMoveset, setActiveMoveset] = useState<"default" | "alt">("default");
  const [uniformSide, setUniformSide] = useState<"front" | "back">("front");
  const [uniformError, setUniformError] = useState(false);

  // IEVR : toujours 6 techniques par moveset
  const isHero = rarity === "Héros";
  const moveLimit = 6;
  const allSkills = activeMoveset === "alt" && altSkills ? altSkills : skills;
  const currentSkills = allSkills.slice(0, moveLimit);

  // Robust image URL selection — zukanHash prioritaire
  let characterImageUrl = "/ievr.png";
  if (zukanHash) {
    characterImageUrl = `https://dxi4wb638ujep.cloudfront.net/1/${zukanHash}.png`;
  } else if (avatarUrl && (avatarUrl.startsWith("/") || avatarUrl.startsWith("http"))) {
    characterImageUrl = avatarUrl;
  } else if (avatarUrl) {
    characterImageUrl = getCharacterFaceUrl(avatarUrl);
  }
  const finalImageSrc =
    characterImageUrl && characterImageUrl.length > 0 ? characterImageUrl : "/ievr.webp";

  // Position icon
  const positionCategoryMap: Record<string, string> = {
    ATT: "tir",
    MIL: "dribble",
    DEF: "defense",
    GAR: "gardien",
  };
  const positionIcon = positionCategoryMap[displayPosition]
    ? getSkillCategoryIconUrl(positionCategoryMap[displayPosition])
    : null;

  // Team emblem
  const emblemCode = teamId ? TEAM_EMBLEM_MAP[teamId] : undefined;
  const emblemUrl = emblemCode ? getEmblemImageUrl(emblemCode) : null;

  // Gender icon — via sprite sheet
  const genderSprite = gender ? ((gender === "F" ? "girl" : "boy") as SpriteCommonKey) : null;

  // Uniform URLs
  const internalCode =
    avatarUrl && !avatarUrl.startsWith("/") && !avatarUrl.startsWith("http") ? avatarUrl : null;
  const uniformFrontUrl = internalCode ? getCharacterUniformUrl(internalCode) : null;
  const uniformBackUrl = internalCode ? getCharacterUniformBackUrl(internalCode) : null;
  const uniformUrl = uniformSide === "back" ? uniformBackUrl : uniformFrontUrl;

  // Total stats
  const totalStats =
    stats.kick +
    stats.control +
    stats.technique +
    stats.pressure +
    stats.physical +
    stats.agility +
    (stats.intelligence || 0);

  return (
    <div className={cn("w-full max-w-7xl mx-auto space-y-6", className)}>
      {/* ═══════════════════════════════════════════════════
          HERO HEADER - Inspired by Victory Road character screen
          ═══════════════════════════════════════════════════ */}
      <section className="relative rounded-[28px] sm:rounded-[32px] overflow-hidden shadow-lg">
        {/* Background gradient based on element */}
        <div
          className={cn(
            "absolute inset-0 bg-linear-to-br",
            ELEMENT_GRADIENTS[element] || ELEMENT_GRADIENTS.Void,
          )}
        />
        {/* Subtle radial highlight */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_80%,rgba(255,255,255,0.06),transparent_60%)]" />

        <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-end gap-3 sm:gap-6 p-4 sm:p-8 pb-5 sm:pb-8">
          {/* Portrait */}
          <div className="relative size-28 sm:w-44 sm:h-44 lg:w-52 lg:h-52 rounded-[20px] sm:rounded-[28px] overflow-hidden border-[3px] border-white/20 shadow-2xl shrink-0 bg-black/30">
            <SafeImage
              src={finalImageSrc}
              zukanHash={zukanHash}
              alt={name}
              fill
              unoptimized
              className="object-contain"
            />
          </div>

          {/* Character Info */}
          <div className="flex-1 min-w-0 text-center sm:text-left space-y-2 sm:space-y-3">
            {/* Name */}
            <div className="space-y-0.5">
              <div className="flex items-center justify-center sm:justify-start gap-2 sm:gap-3">
                <h1 className="text-xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-white tracking-tight drop-shadow-lg leading-tight">
                  {name}
                </h1>
                {genderSprite && (
                  <div className="shrink-0 drop-shadow-md">
                    <CommonSpriteIcon name={genderSprite} scale={0.4} />
                  </div>
                )}
              </div>
              {nickname && (
                <p className="text-sm sm:text-base lg:text-lg text-white/60 italic font-medium">
                  {nickname}
                  {(() => {
                    const r = japaneseToRomaji(nickname);
                    return r ? ` (${r})` : "";
                  })()}
                </p>
              )}
            </div>

            {/* Badges Row */}
            <div className="flex flex-wrap items-center gap-1 sm:gap-2 justify-center sm:justify-start">
              {/* Position */}
              <span
                className={cn(
                  "inline-flex items-center gap-1 sm:gap-1.5 px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-[10px] sm:text-xs font-black shadow-md",
                  POSITION_COLORS[displayPosition] || POSITION_COLORS.MIL,
                )}
              >
                {positionIcon && (
                  <NextImage
                    src={positionIcon}
                    alt=""
                    width={14}
                    height={14}
                    className="size-3 sm:size-3.5 object-contain brightness-0 invert"
                  />
                )}
                {POSITION_FR[displayPosition] || displayPosition}
              </span>

              {/* Element */}
              {element && (
                <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 py-0.5 sm:px-3 sm:py-1 rounded-full bg-white/15 text-white text-[10px] sm:text-xs font-bold backdrop-blur-sm">
                  {getSkillElementIconUrl(element) && (
                    <NextImage
                      src={getSkillElementIconUrl(element)}
                      alt=""
                      width={14}
                      height={14}
                      className="size-3 sm:size-3.5 object-contain"
                    />
                  )}
                  {ELEMENT_FR[element] || element}
                </span>
              )}

              {/* Rarity */}
              <RarityBadge rarity={rarity} size="md" className="backdrop-blur-sm text-[10px] sm:text-xs" />

              {/* Controllable (playable in story mode) */}
              {isControllable && (
                <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 py-0.5 sm:px-3 sm:py-1 rounded-full bg-emerald-500/20 text-emerald-200 text-[10px] sm:text-xs font-bold backdrop-blur-sm border border-emerald-400/30">
                  <Gamepad2 size={12} className="sm:size-[14px]" aria-hidden="true" />
                  Jouable
                </span>
              )}

              {/* Team */}
              {teamName && (
                <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 py-0.5 sm:px-3 sm:py-1 rounded-full bg-white/15 text-white text-[10px] sm:text-xs font-bold backdrop-blur-sm">
                  {emblemUrl && (
                    <NextImage
                      src={emblemUrl}
                      alt=""
                      width={14}
                      height={14}
                      className="size-3 sm:size-3.5 object-contain"
                      unoptimized
                    />
                  )}
                  {teamName}
                </span>
              )}

              {/* Series */}
              {series && (
                <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 py-0.5 sm:px-3 sm:py-1 rounded-full bg-white/10 text-white/80 text-[10px] sm:text-xs font-bold backdrop-blur-sm border border-white/10">
                  {series}
                </span>
              )}

              {/* Constellations — heroes may appear in multiple constellations */}
              {isHero && heroConstellations && heroConstellations.length > 0
                ? heroConstellations.map((hc) => (
                    <span
                      key={hc.name}
                      className="inline-flex items-center gap-1 sm:gap-1.5 px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold backdrop-blur-sm"
                      style={{
                        backgroundColor: "rgba(168,85,247,0.2)",
                        color: "white",
                      }}
                    >
                      <Star size={12} className="sm:size-[14px]" aria-hidden="true" />
                      {hc.name}
                    </span>
                  ))
                : constellation?.names?.fr
                  ? (() => {
                      const psColor = sheetData?.playstyle
                        ? PLAYSTYLE_COLOR[sheetData.playstyle]
                        : undefined;
                      return (
                        <span
                          className="inline-flex items-center gap-1 sm:gap-1.5 px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold backdrop-blur-sm"
                          style={
                            psColor
                              ? {
                                  background: psColor.gradient || psColor.bg,
                                  color: psColor.text,
                                  borderWidth: "1px",
                                  borderColor: psColor.border,
                                }
                              : {
                                  backgroundColor: "rgba(168,85,247,0.2)",
                                  color: "white",
                                }
                          }
                        >
                          <Star size={12} className="sm:size-[14px]" aria-hidden="true" />
                          {constellation.names.fr}
                        </span>
                      );
                    })()
                  : null}
            </div>

            {/* Form selector — visual thumbnails of all variants */}
            {forms && forms.length > 1 && (
              <FormSelector forms={forms} currentFormId={currentFormId} />
            )}

            {/* Bottom row: Navigation + Compare */}
            <div className="flex items-center gap-2 justify-center sm:justify-start pt-1">
              {prevCharacterHref && (
                <NextLink
                  href={prevCharacterHref}
                  className="flex items-center justify-center size-8 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white/80"
                  title="Précédent"
                >
                  <ChevronLeft size={18} aria-hidden="true" />
                </NextLink>
              )}

              {nextCharacterHref && (
                <NextLink
                  href={nextCharacterHref}
                  className="flex items-center justify-center size-8 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white/80"
                  title="Suivant"
                >
                  <ChevronRight size={18} aria-hidden="true" />
                </NextLink>
              )}

              {slug && (
                <NextLink
                  href={`/tools/compare?char1=${slug}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white/80 hover:text-white text-xs font-bold ml-auto"
                  title="Comparer avec un autre personnage"
                >
                  <ArrowLeftRight size={16} aria-hidden="true" />
                  Comparer
                </NextLink>
              )}
            </div>
          </div>

          {/* Uniform — small on mobile (beside portrait area), larger on desktop */}
          {uniformUrl && !uniformError && (
            <div className="flex flex-col items-center gap-1.5 sm:gap-2 shrink-0">
              <div className="relative w-12 h-16 sm:w-20 sm:h-28 rounded-xl sm:rounded-2xl overflow-hidden bg-black/20 border border-white/10 shadow-lg">
                <NextImage
                  src={uniformUrl}
                  alt={`Uniforme de ${name}`}
                  fill
                  unoptimized
                  className="object-contain"
                  onError={() => setUniformError(true)}
                />
              </div>
              <div className="flex bg-black/30 rounded-full p-0.5 backdrop-blur-sm">
                <button
                  onClick={() => setUniformSide("front")}
                  className={cn(
                    "px-1.5 py-0.5 sm:px-2 rounded-full text-[8px] sm:text-[10px] font-bold transition-all",
                    uniformSide === "front"
                      ? "bg-white text-slate-900"
                      : "text-white/60 hover:text-white/90",
                  )}
                >
                  Devant
                </button>
                <button
                  onClick={() => setUniformSide("back")}
                  className={cn(
                    "px-1.5 py-0.5 sm:px-2 rounded-full text-[8px] sm:text-[10px] font-bold transition-all",
                    uniformSide === "back"
                      ? "bg-white text-slate-900"
                      : "text-white/60 hover:text-white/90",
                  )}
                >
                  Dos
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          STATS + MOVESET - Split view like Victory Road
          ═══════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Stats Panel */}
        <section className="bg-surface-container-lowest rounded-[24px] sm:rounded-[32px] border border-outline-variant/30 overflow-hidden shadow-sm">
          <div className="bg-surface-container-low px-4 sm:px-8 py-3 sm:py-4 border-b border-outline-variant/20 flex items-center justify-between">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <TrendingUp size={20} className="sm:size-6 text-primary" aria-hidden="true" />
              <h2 className="text-xs sm:text-sm font-black uppercase tracking-widest text-on-surface">
                Statistiques
              </h2>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">
                Total
              </span>
              <span className="text-base sm:text-lg font-black text-primary tabular-nums">{totalStats}</span>
            </div>
          </div>
          <div className="p-3 sm:p-6 flex flex-col items-center">
            <StatHeptagon stats={stats} size={280} showLabels />
            {/* Stats lv1 comparison */}
            {statsLv1 && (
              <div className="mt-4 w-full max-w-xs">
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50 text-center mb-2">Stats Niv. 1</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  {([
                    ["Frappe", statsLv1.kick, stats.kick],
                    ["Controle", statsLv1.control, stats.control],
                    ["Technique", statsLv1.technique, stats.technique],
                    ["Pression", statsLv1.pressure, stats.pressure],
                    ["Physique", statsLv1.physical, stats.physical],
                    ["Agilite", statsLv1.agility, stats.agility],
                    ["Intel.", statsLv1.intelligence, stats.intelligence],
                  ] as Array<[string, number, number]>).map(([label, lv1, lv99]) => (
                    <div key={label} className="flex justify-between text-on-surface-variant/70">
                      <span className="font-medium">{label}</span>
                      <span className="tabular-nums">
                        <span className="text-on-surface-variant/40">{lv1}</span>
                        <span className="mx-0.5 text-on-surface-variant/20">/</span>
                        <span className="font-bold text-on-surface">{lv99}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Moveset Panel */}
        <section className="bg-surface-container-lowest rounded-[24px] sm:rounded-[32px] border border-outline-variant/30 overflow-hidden shadow-sm flex flex-col">
          <div className="bg-surface-container-low px-4 sm:px-8 py-2.5 sm:py-4 border-b border-outline-variant/20 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <CircleDot size={20} className="sm:size-6 text-primary" aria-hidden="true" />
                <h2 className="text-xs sm:text-sm font-black uppercase tracking-widest text-on-surface">
                  Techniques
                </h2>
              </div>

              {/* BASARA / Normal variant toggle */}
              {(basaraFormSlug || normalFormSlug) && (
                <div className="flex rounded-full p-0.5 border border-purple-500/30 bg-purple-950/20">
                  {normalFormSlug ? (
                    <NextLink
                      href={`/chara/${normalFormSlug}`}
                      prefetch
                      className="px-3 py-1 rounded-full text-[11px] font-bold text-white/60 hover:text-white/90 hover:bg-white/10 transition-all"
                    >
                      Normal
                    </NextLink>
                  ) : (
                    <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-surface-container-highest text-on-surface shadow-sm">
                      Normal
                    </span>
                  )}
                  {basaraFormSlug ? (
                    <NextLink
                      href={`/chara/${basaraFormSlug}`}
                      prefetch
                      className="px-3 py-1 rounded-full text-[11px] font-bold text-purple-300/70 hover:text-purple-200 hover:bg-purple-500/20 transition-all"
                    >
                      BASARA
                    </NextLink>
                  ) : (
                    <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-linear-to-r from-[#4facfe] via-[#7367f0] to-[#9733ee] text-white shadow-sm shadow-purple-500/30">
                      BASARA
                    </span>
                  )}
                </div>
              )}

              {/* Hero type selector (Fire / Black / Pink) */}
              {heroForms && heroForms.length > 0 && (
                <HeroTypeSelector
                  heroForms={heroForms}
                  currentHeroType={currentHeroType}
                />
              )}
            </div>

            {/* Principal / Alternatif moveset toggle */}
            {altSkills && altSkills.length > 0 && (
              <div className="flex bg-surface-container-high rounded-full p-1 border border-outline-variant/20 self-end">
                <button
                  onClick={() => setActiveMoveset("default")}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-xs font-bold transition-all",
                    activeMoveset === "default"
                      ? "bg-primary text-on-primary shadow-sm"
                      : "text-on-surface-variant hover:bg-surface-container-highest",
                  )}
                >
                  Principal
                </button>
                <button
                  onClick={() => setActiveMoveset("alt")}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-xs font-bold transition-all",
                    activeMoveset === "alt"
                      ? "bg-primary text-on-primary shadow-sm"
                      : "text-on-surface-variant hover:bg-surface-container-highest",
                  )}
                >
                  Alternatif
                </button>
              </div>
            )}
          </div>
          <div className="divide-y divide-outline-variant/15 flex-1">
            {currentSkills.map((skill, i) => {
              const cat = (skill as any).category || (skill.isPassive ? "Talent" : "Special");
              const catIcon = getSkillCategoryIconUrl(cat);
              const hasLink = !!(skill.href || skill.id);
              const Wrapper = hasLink ? NextLink : "div";
              const wrapperProps = hasLink ? { href: skill.href || `/skill/${skill.id}` } : {};
              return (
                <Wrapper
                  key={skill.id || i}
                  {...(wrapperProps as any)}
                  className="flex items-center gap-2 sm:gap-3 px-3 sm:px-6 py-2 sm:py-3 hover:bg-on-surface/[0.04] transition-colors group"
                >
                  {/* Category icon */}
                  <div className="size-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-surface-container-high flex items-center justify-center shrink-0 border border-outline-variant/15">
                    {catIcon ? (
                      <NextImage
                        src={catIcon}
                        alt=""
                        width={18}
                        height={18}
                        className="size-3.5 sm:size-[18px] object-contain"
                      />
                    ) : skill.isPassive ? (
                      <Sparkles
                        size={14}
                        aria-hidden="true"
                        className="sm:size-[18px] text-on-surface-variant/60"
                      />
                    ) : (
                      <CircleDot
                        size={14}
                        aria-hidden="true"
                        className="sm:size-[18px] text-on-surface-variant/60"
                      />
                    )}
                  </div>

                  {/* Slot number badge */}
                  <span className="size-5 sm:w-6 sm:h-6 rounded-md sm:rounded-lg bg-surface-container-highest flex items-center justify-center text-[10px] sm:text-[11px] font-black text-on-surface-variant shrink-0">
                    {skill.slotNumber ?? i + 1}
                  </span>

                  {/* Name + Evolution */}
                  <div className="flex-1 min-w-0 flex items-center gap-1.5 sm:gap-2">
                    <span className="text-xs sm:text-sm font-bold text-on-surface group-hover:text-primary transition-colors truncate">
                      {skill.name}
                    </span>
                    {skill.evolutionSuffix && (
                      <span className="text-[10px] sm:text-[11px] font-black text-amber-400 shrink-0">
                        {skill.evolutionSuffix}
                      </span>
                    )}
                    {skill.element && (
                      <div className="size-3 sm:w-3.5 sm:h-3.5 relative shrink-0 opacity-80">
                        <NextImage
                          src={getSkillElementIconUrl(skill.element)}
                          alt=""
                          fill
                          className="object-contain"
                        />
                      </div>
                    )}
                    {skill.videoUrl && (
                      <PlayCircle
                        size={12}
                        aria-hidden="true"
                        className="sm:size-[14px] text-primary animate-pulse"
                      />
                    )}
                  </div>

                  {/* Power & TP — labels hidden on mobile */}
                  <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    {!skill.isPassive && skill.power && (
                      <div className="flex flex-col items-end">
                        <span className="hidden sm:block text-[10px] font-black text-on-surface-variant/40 leading-none uppercase">
                          Pui.
                        </span>
                        <span className="text-[10px] sm:text-xs font-black text-primary tabular-nums">
                          {skill.power}
                        </span>
                      </div>
                    )}
                    {!skill.isPassive && skill.tension != null && (
                      <div className="flex flex-col items-end">
                        <span className="hidden sm:block text-[10px] font-black text-on-surface-variant/40 leading-none uppercase">
                          Tens.
                        </span>
                        <span className="text-[10px] sm:text-xs font-black text-on-surface-variant tabular-nums">
                          {skill.tension}
                        </span>
                      </div>
                    )}
                    {skill.learnLevel != null && skill.learnLevel > 0 && (
                      <div className="flex flex-col items-end">
                        <span className="hidden sm:block text-[10px] font-black text-on-surface-variant/40 leading-none uppercase">
                          Niv
                        </span>
                        <span className="text-[10px] sm:text-xs font-bold text-on-surface-variant/60 tabular-nums">
                          {skill.learnLevel}
                        </span>
                      </div>
                    )}
                  </div>

                  {hasLink && (
                    <ChevronRight
                      size={14}
                      aria-hidden="true"
                      className="sm:size-4 text-on-surface-variant/30 group-hover:text-primary transition-colors shrink-0 ml-0.5 sm:ml-1"
                    />
                  )}
                </Wrapper>
              );
            })}
            {currentSkills.length === 0 && (
              <div className="px-6 py-8 text-center text-on-surface-variant/60 italic text-sm">
                Aucune technique connue.
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ═══════════════════════════════════════════════════
          PROFILE & DETAILS
          ═══════════════════════════════════════════════════ */}
      <section className="bg-surface-container-lowest rounded-[24px] sm:rounded-[32px] border border-outline-variant/30 overflow-hidden shadow-sm">
        <div className="bg-surface-container-low px-4 sm:px-8 py-3 sm:py-4 border-b border-outline-variant/20 flex items-center gap-1.5 sm:gap-2">
          <FileText size={20} className="sm:size-6 text-primary" aria-hidden="true" />
          <h2 className="text-xs sm:text-sm font-black uppercase tracking-widest text-on-surface">Profil</h2>
        </div>
        <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
          {/* Description */}
          <p className="text-sm sm:text-lg text-on-surface-variant leading-relaxed font-medium italic border-l-4 border-primary/30 pl-3 sm:pl-6 py-1.5 sm:py-2 whitespace-pre-wrap">
            {description || "Aucune information supplementaire disponible."}
          </p>

          {/* Playstyle & Progression */}
          {sheetData && !sheetData.playstyle?.startsWith("#") && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {sheetData.heroVariants && sheetData.heroVariants.length > 1 ? (
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60 px-1">
                    Styles de jeu
                  </span>
                  {sheetData.heroVariants.map((v) => {
                    const color = PLAYSTYLE_COLOR[v.playstyle];
                    return (
                      <div
                        key={v.playstyle}
                        className="rounded-2xl p-4 border transition-colors"
                        style={
                          color
                            ? {
                                background: color.gradient || color.bg,
                                borderColor: color.border,
                              }
                            : undefined
                        }
                      >
                        <span
                          className="text-lg font-bold flex items-center gap-2"
                          style={color ? { color: color.text } : undefined}
                        >
                          {PLAYSTYLE_SPRITE[v.playstyle] && (
                            <CommonSpriteIcon name={PLAYSTYLE_SPRITE[v.playstyle]} scale={0.5} />
                          )}
                          {PLAYSTYLE_FR[v.playstyle] || v.playstyle}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : sheetData.playstyle ? (
                (() => {
                  const color = PLAYSTYLE_COLOR[sheetData.playstyle];
                  return (
                    <div
                      className="rounded-2xl p-4 border transition-colors"
                      style={
                        color
                          ? {
                              background: color.gradient || color.bg,
                              borderColor: color.border,
                            }
                          : undefined
                      }
                    >
                      <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60 block mb-1.5">
                        Style de jeu
                      </span>
                      <span
                        className="text-lg font-bold flex items-center gap-2"
                        style={color ? { color: color.text } : undefined}
                      >
                        {PLAYSTYLE_SPRITE[sheetData.playstyle] && (
                          <CommonSpriteIcon
                            name={PLAYSTYLE_SPRITE[sheetData.playstyle]}
                            scale={0.5}
                          />
                        )}
                        {PLAYSTYLE_FR[sheetData.playstyle] || sheetData.playstyle}
                      </span>
                    </div>
                  );
                })()
              ) : null}
              {sheetData.paths?.main && (
                <div className="bg-surface-container rounded-2xl p-4 border border-outline-variant/20 group hover:border-primary/30 transition-colors">
                  <span className="text-[10px] font-black uppercase tracking-widest text-primary block mb-1.5">
                    Progression
                  </span>
                  <span className="text-sm font-bold text-on-surface leading-tight">
                    {sheetData.paths.main.replaceAll(
                      /Keep|Shoot|Offense|Defense|Dribble/g,
                      (m) => PATH_TYPE_FR[m] || m,
                    )}
                  </span>
                  {sheetData.paths.alt && (
                    <span className="text-xs text-on-surface-variant mt-1.5 block leading-tight">
                      {sheetData.paths.alt
                        .replaceAll(/Keep|Shoot|Offense|Defense|Dribble/g, (m) => PATH_TYPE_FR[m] || m)
                        .split("\n")
                        .join(" / ")}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

        </div>
      </section>

      {/* Technical Footer */}
      <div className="px-6 py-3 rounded-2xl bg-surface-container-high/30 border border-outline-variant/10 flex flex-col gap-1 text-[10px] font-mono text-on-surface-variant/40">
        <span className="uppercase tracking-widest font-black opacity-40">
          Identifiants techniques
        </span>
        <span>ID: {avatarUrl}</span>
        {zukanHash && <span>Zukan: {zukanHash}</span>}
      </div>
    </div>
  );
}
