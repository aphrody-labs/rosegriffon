"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { CommonSpriteIcon } from "@/components/ui/CommonSpriteIcon";
import { Icon } from "@/components/ui/Icon";
import { RarityBadge } from "@/components/ui/rarity-badge";
import { CharacterSearchDialog } from "@/components/wiki/CharacterSearchDialog";
import { StatHeptagon } from "@/components/wiki/StatHeptagon";
import type { SpriteCommonKey } from "@/config/sprites-common";
import {
  getCharacterImageUrl,
  getSkillCategoryIconUrl,
  getSkillElementIconUrl,
} from "@/lib/images";
import { cn } from "@/lib/utils";

// ---------- Types ----------

interface CharacterStats {
  kick: number;
  control: number;
  technique: number;
  pressure: number;
  physical: number;
  agility: number;
  intelligence: number;
}

export interface SkillInfo {
  id: string;
  name: string;
  power?: string;
  element?: string;
  category?: string;
  isPassive?: boolean;
  tension?: number;
}

export interface CompareCharacter {
  slug: string;
  name: string;
  nameJa?: string;
  nameEn?: string;
  image?: string | null;
  internalCode?: string;
  zukanHash?: string;
  position: string;
  element: string;
  rarity: string;
  teamName?: string;
  stats: CharacterStats;
  skills: SkillInfo[];
}

interface CharacterComparatorProps {
  char1?: CompareCharacter | null;
  char2?: CompareCharacter | null;
}

// ---------- Constants ----------

const ELEMENT_SPRITE: Record<string, SpriteCommonKey> = {
  Fire: "fire",
  Forest: "forest",
  Mountain: "mountain",
  Wind: "wind",
};

const ELEMENT_GRADIENTS: Record<string, string> = {
  Fire: "from-red-950 via-orange-900/90 to-amber-800/70",
  Forest: "from-green-950 via-lime-900/90 to-emerald-800/70",
  Mountain: "from-amber-950 via-yellow-900/90 to-orange-800/70",
  Void: "from-slate-950 via-gray-900/90 to-zinc-800/70",
  Wind: "from-emerald-950 via-teal-900/90 to-cyan-800/70",
};

const POS_LABEL: Record<string, string> = { DF: "DEF", FW: "ATT", GK: "GAR", MF: "MIL" };
const POS_COLOR: Record<string, string> = {
  DF: "bg-blue-600",
  FW: "bg-red-600",
  GK: "bg-amber-500",
  MF: "bg-emerald-600",
};

// ---------- Helpers ----------

const STAT_LABELS: Array<{ key: keyof CharacterStats; label: string }> = [
  { key: "kick", label: "Frappe" },
  { key: "control", label: "Controle" },
  { key: "technique", label: "Technique" },
  { key: "pressure", label: "Pression" },
  { key: "physical", label: "Physique" },
  { key: "agility", label: "Agilite" },
  { key: "intelligence", label: "Intelligence" },
];

function totalStats(stats: CharacterStats): number {
  return (
    stats.kick +
    stats.control +
    stats.technique +
    stats.pressure +
    stats.physical +
    stats.agility +
    stats.intelligence
  );
}

/** Prioritize zukanHash (3D render) > image > face icon fallback */
function resolveImageUrl(char: CompareCharacter): string {
  if (char.zukanHash) {
    const cleanHash = char.zukanHash.startsWith("/") ? char.zukanHash.slice(1) : char.zukanHash;
    return `https://dxi4wb638ujep.cloudfront.net/1/${cleanHash}.png`;
  }
  if (char.image) {return char.image;}
  return getCharacterImageUrl(char.internalCode) || "/ievr.webp";
}

// ---------- Compare Card (compact, zukan image + element gradient) ----------

function CompareCard({ char, onClick }: { char: CompareCharacter; onClick: () => void }) {
  const imageUrl = resolveImageUrl(char);
  const elSprite = ELEMENT_SPRITE[char.element];
  const total = totalStats(char.stats);
  const gradient = ELEMENT_GRADIENTS[char.element] || ELEMENT_GRADIENTS.Void;

  return (
    <button
      onClick={onClick}
      aria-label={`Changer ${char.name}`}
      className="relative group w-full rounded-xl overflow-hidden elevation-1 hover:elevation-2 transition-all cursor-pointer text-left"
    >
      {/* Image area with element gradient - compact height */}
      <div
        className={cn("relative w-full h-36 sm:h-48 overflow-hidden bg-linear-to-br", gradient)}
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_80%,rgba(255,255,255,0.06),transparent_60%)]" />
        <Image
          src={imageUrl}
          alt={char.name}
          fill
          sizes="(max-width: 640px) 45vw, 300px"
          className="object-contain transition-transform duration-300 group-hover:scale-105"
          unoptimized
        />

        {/* Change overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/40">
          <div className="bg-surface-container/90 p-2 rounded-full shadow-lg">
            <Icon name="compare_arrows" size={18} className="text-primary" />
          </div>
          <span className="text-[10px] font-bold text-white/90 drop-shadow-lg">Changer</span>
        </div>

        {/* Rarity badge top-left */}
        <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2">
          <RarityBadge rarity={char.rarity} size="xs" />
        </div>
      </div>

      {/* Info section */}
      <div className="px-2.5 py-2 sm:px-3 sm:py-2.5 bg-surface-container-low space-y-1">
        <p className="font-bold text-xs sm:text-sm text-on-surface truncate">{char.name}</p>
        <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
          {elSprite && <CommonSpriteIcon name={elSprite} scale={0.25} />}
          <span
            className={cn(
              "px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-black text-white leading-none",
              POS_COLOR[char.position] || "bg-slate-600",
            )}
          >
            {POS_LABEL[char.position] || char.position}
          </span>
          {char.teamName && (
            <span className="text-[9px] sm:text-[10px] text-on-surface-variant truncate max-w-[60px] sm:max-w-[100px]">
              {char.teamName}
            </span>
          )}
          <span className="ml-auto text-xs font-bold text-primary tabular-nums">{total}</span>
        </div>
      </div>
    </button>
  );
}

// ---------- Empty slot ----------

function EmptySlot({ side, onChoose }: { side: 1 | 2; onChoose: () => void }) {
  return (
    <button
      onClick={onChoose}
      aria-label={`Choisir le personnage ${side}`}
      className={cn(
        "relative flex flex-col items-center justify-center gap-3 sm:gap-4 p-6 sm:p-8 rounded-xl",
        "border border-outline-variant/30 bg-surface-container-low state-layer hover:elevation-1",
        "transition-all duration-200 min-h-[180px] sm:min-h-[260px] w-full cursor-pointer group overflow-hidden",
      )}
    >
      <div className="size-14 sm:w-16 sm:h-16 rounded-full bg-primary-container flex items-center justify-center">
        <Icon name="compare_arrows" size={28} className="text-on-primary-container sm:hidden" />
        <Icon
          name="compare_arrows"
          size={32}
          className="text-on-primary-container hidden sm:block"
        />
      </div>
      <span className="type-label-medium text-on-surface-variant/60 group-hover:text-primary/80 transition-colors">
        Personnage {side}
      </span>
    </button>
  );
}

// ---------- Stat comparison bars ----------

function StatComparisonBars({
  stats1,
  stats2,
  name1,
  name2,
}: {
  stats1: CharacterStats;
  stats2: CharacterStats;
  name1: string;
  name2: string;
}) {
  const maxStat = 999;

  const wins = STAT_LABELS.reduce(
    (acc, { key }) => {
      const diff = stats1[key] - stats2[key];
      if (diff > 0) {acc.char1++;}
      else if (diff < 0) {acc.char2++;}
      return acc;
    },
    { char1: 0, char2: 0 },
  );

  return (
    <div className="w-full space-y-2 sm:space-y-3">
      <div className="flex items-center justify-between mb-2 sm:mb-4">
        <h3 className="type-title-small text-on-surface">Statistiques</h3>
        <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-bold tabular-nums">
          <span className="text-[var(--md-sys-color-primary)]">{wins.char1}</span>
          <span className="text-on-surface-variant/40">-</span>
          <span className="text-[var(--md-sys-color-tertiary)]">{wins.char2}</span>
        </div>
      </div>

      <div className="flex items-center justify-center gap-4 mb-1 sm:mb-2">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[var(--md-sys-color-primary)]" />
          <span className="text-[10px] sm:text-xs text-on-surface-variant truncate max-w-[80px] sm:max-w-none">
            {name1}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[var(--md-sys-color-tertiary)]" />
          <span className="text-[10px] sm:text-xs text-on-surface-variant truncate max-w-[80px] sm:max-w-none">
            {name2}
          </span>
        </div>
      </div>

      {STAT_LABELS.map(({ key, label }) => {
        const v1 = stats1[key];
        const v2 = stats2[key];
        const delta = v2 - v1;
        const pct1 = Math.min(100, (v1 / maxStat) * 100);
        const pct2 = Math.min(100, (v2 / maxStat) * 100);

        return (
          <div key={key} className="space-y-0.5 sm:space-y-1">
            <div className="flex items-center justify-between text-[11px] sm:text-xs">
              <span className="font-semibold text-on-surface-variant uppercase tracking-wide w-16 sm:w-24 truncate">
                {label}
              </span>
              <div className="flex items-center gap-1 sm:gap-2 flex-1 justify-end">
                <span
                  className={cn(
                    "font-bold w-8 sm:w-10 text-right tabular-nums",
                    delta < 0
                      ? "text-on-surface"
                      : (delta > 0
                        ? "text-on-surface/60"
                        : "text-on-surface"),
                  )}
                >
                  {v1}
                </span>
                <span className="text-on-surface-variant text-[10px] sm:text-xs">vs</span>
                <span
                  className={cn(
                    "font-bold w-8 sm:w-10 tabular-nums",
                    delta > 0
                      ? "text-on-surface"
                      : (delta < 0
                        ? "text-on-surface/60"
                        : "text-on-surface"),
                  )}
                >
                  {v2}
                </span>
                <span
                  className={cn(
                    "text-[11px] sm:text-xs font-bold w-10 sm:w-14 text-right tabular-nums",
                    delta > 0 && "text-green-500",
                    delta < 0 && "text-red-500",
                    delta === 0 && "text-on-surface-variant/50",
                  )}
                >
                  {delta > 0 ? `+${delta}` : (delta === 0 ? "=" : delta)}
                </span>
              </div>
            </div>
            <div className="flex gap-0.5 sm:gap-1 h-2 sm:h-2.5">
              <div className="flex-1 bg-surface-container-high rounded-full overflow-hidden flex justify-end">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    delta <= 0
                      ? "bg-[var(--md-sys-color-primary)]"
                      : "bg-[var(--md-sys-color-primary)]/50",
                  )}
                  style={{ width: `${pct1}%` }}
                />
              </div>
              <div className="flex-1 bg-surface-container-high rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    delta >= 0
                      ? "bg-[var(--md-sys-color-tertiary)]"
                      : "bg-[var(--md-sys-color-tertiary)]/50",
                  )}
                  style={{ width: `${pct2}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}

      <div className="flex items-center justify-between pt-2 sm:pt-3 border-t border-outline-variant/30">
        <span className="text-xs sm:text-sm font-bold text-on-surface uppercase tracking-wide">
          Total
        </span>
        <div className="flex items-center gap-1 sm:gap-2">
          <span className="font-bold text-on-surface tabular-nums text-xs sm:text-sm">
            {totalStats(stats1)}
          </span>
          <span className="text-on-surface-variant text-[10px] sm:text-xs">vs</span>
          <span className="font-bold text-on-surface tabular-nums text-xs sm:text-sm">
            {totalStats(stats2)}
          </span>
          {(() => {
            const d = totalStats(stats2) - totalStats(stats1);
            return (
              <span
                className={cn(
                  "text-xs sm:text-sm font-bold w-10 sm:w-14 text-right tabular-nums",
                  d > 0 && "text-green-500",
                  d < 0 && "text-red-500",
                  d === 0 && "text-on-surface-variant/50",
                )}
              >
                {d > 0 ? `+${d}` : (d === 0 ? "=" : d)}
              </span>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

// ---------- Skill card (MovesetList style) ----------

function SkillRow({ skill, isCommon }: { skill: SkillInfo; isCommon: boolean }) {
  const catIcon = skill.category ? getSkillCategoryIconUrl(skill.category) : null;
  const elemIcon = skill.element ? getSkillElementIconUrl(skill.element) : null;

  return (
    <Link
      href={skill.id ? `/skill/${skill.id}` : "#"}
      className={cn(
        "group relative flex items-center gap-1.5 sm:gap-2 h-10 sm:h-11 rounded-r-xl border-l-[5px] border border-outline-variant/20 overflow-hidden transition-all hover:translate-x-0.5",
        skill.isPassive
          ? "bg-linear-to-r from-purple-500/10 to-surface-container border-l-purple-500"
          : "bg-linear-to-r from-surface-container-high to-surface-container border-l-lime-500",
        isCommon && "ring-1 ring-primary/30",
      )}
    >
      {/* Category icon */}
      <div className="w-8 sm:w-9 h-full flex items-center justify-center bg-surface-dim shrink-0">
        {catIcon ? (
          <Image src={catIcon} alt="" width={16} height={16} className="object-contain" />
        ) : (skill.isPassive ? (
          <Icon name="auto_awesome" size={15} className="text-outline-variant" />
        ) : (
          <Icon name="blur_on" size={15} className="text-outline-variant" />
        ))}
      </div>

      {/* Name */}
      <div className="flex-1 min-w-0 px-0.5 sm:px-1">
        <span
          className={cn(
            "text-[11px] sm:text-xs font-bold truncate block transition-colors leading-tight",
            skill.isPassive
              ? "text-purple-600 dark:text-purple-400"
              : "text-on-surface group-hover:text-lime-600",
          )}
        >
          {skill.name}
        </span>
        {skill.isPassive && (
          <span className="text-[7px] sm:text-[8px] font-bold text-purple-400 uppercase tracking-wider">
            Talent
          </span>
        )}
      </div>

      {/* Element + Power + Tension */}
      <div className="flex items-center gap-1 sm:gap-1.5 pr-1.5 sm:pr-2 shrink-0">
        {elemIcon && (
          <Image src={elemIcon} alt="" width={12} height={12} className="object-contain" />
        )}
        {skill.power && !skill.isPassive && (
          <span className="text-xs sm:text-sm font-black text-lime-600 dark:text-lime-400 tabular-nums leading-none">
            {skill.power}
          </span>
        )}
        {skill.tension != null && !skill.isPassive && (
          <span className="text-[8px] sm:text-[9px] font-bold text-on-surface-variant/60 leading-none">
            {skill.tension}T
          </span>
        )}
        {isCommon && <Icon name="link" size={11} className="text-primary shrink-0" />}
      </div>
    </Link>
  );
}

// ---------- Skills comparison ----------

function SkillsComparison({
  skills1,
  skills2,
  name1,
  name2,
}: {
  skills1: SkillInfo[];
  skills2: SkillInfo[];
  name1: string;
  name2: string;
}) {
  const commonSkillNames = useMemo(() => {
    const set1 = new Set(skills1.map((s) => s.name.toLowerCase()));
    return new Set(
      skills2.filter((s) => set1.has(s.name.toLowerCase())).map((s) => s.name.toLowerCase()),
    );
  }, [skills1, skills2]);

  const renderSkillList = (skills: SkillInfo[], label: string) => (
    <div className="space-y-1.5 sm:space-y-2">
      <h4 className="text-[10px] sm:text-xs font-bold text-on-surface-variant uppercase tracking-wider">
        {label}
      </h4>
      {skills.length === 0 ? (
        <p className="text-[10px] sm:text-xs text-on-surface-variant/50 italic">Aucune technique</p>
      ) : (
        <div className="space-y-1 sm:space-y-1.5">
          {skills.map((skill, i) => (
            <SkillRow
              key={skill.id || i}
              skill={skill}
              isCommon={commonSkillNames.has(skill.name.toLowerCase())}
            />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-3 sm:space-y-4">
      <h3 className="type-title-small text-on-surface">
        Techniques
        {commonSkillNames.size > 0 && (
          <span className="ml-1.5 sm:ml-2 text-primary font-normal normal-case text-[11px] sm:text-sm">
            ({commonSkillNames.size} en commun)
          </span>
        )}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        {renderSkillList(skills1, name1)}
        {renderSkillList(skills2, name2)}
      </div>
    </div>
  );
}

// ---------- Main component ----------

export function CharacterComparator({ char1, char2 }: CharacterComparatorProps) {
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTarget, setSearchTarget] = useState<1 | 2>(1);
  const [copied, setCopied] = useState(false);

  const openSearch = (target: 1 | 2) => {
    setSearchTarget(target);
    setSearchOpen(true);
  };

  const handleSelect = useCallback(
    (slug: string, _name: string) => {
      const params = new URLSearchParams();
      if (searchTarget === 1) {
        params.set("char1", slug);
        if (char2) {params.set("char2", char2.slug);}
      } else {
        if (char1) {params.set("char1", char1.slug);}
        params.set("char2", slug);
      }
      router.push(`/tools/compare?${params.toString()}`);
    },
    [searchTarget, char1, char2, router],
  );

  const handleSwap = useCallback(() => {
    if (!char1 && !char2) {return;}
    const params = new URLSearchParams();
    if (char2) {params.set("char1", char2.slug);}
    if (char1) {params.set("char2", char1.slug);}
    router.push(`/tools/compare?${params.toString()}`);
  }, [char1, char2, router]);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback silencieux
    }
  }, []);

  const bothSelected = char1 && char2;
  const anySelected = char1 || char2;

  return (
    <div className="w-full space-y-5 sm:space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="font-[BradBunR] text-xl sm:text-2xl md:text-3xl text-on-surface tracking-wide">
            Comparateur
          </h1>
          <p className="type-body-small text-on-surface-variant mt-1">
            Comparez deux personnages cote a cote
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {anySelected && (
            <button
              onClick={handleCopyLink}
              className="p-2.5 rounded-full bg-surface-container-high state-layer relative overflow-hidden text-on-surface-variant transition-all"
              aria-label="Copier le lien de partage"
              title="Copier le lien"
            >
              {copied ? (
                <Icon name="check" size={18} className="text-green-500" />
              ) : (
                <Icon name="content_copy" size={18} />
              )}
            </button>
          )}
          {bothSelected && (
            <button
              onClick={() => router.push("/tools/compare")}
              aria-label="Reinitialiser la comparaison"
              className="type-label-large text-primary px-3 py-2 rounded-full state-layer relative overflow-hidden"
            >
              Reinitialiser
            </button>
          )}
        </div>
      </div>

      {/* Character Cards */}
      <div className="relative grid grid-cols-2 gap-3 sm:gap-6">
        <div className="transition-all duration-300">
          {char1 ? (
            <CompareCard char={char1} onClick={() => openSearch(1)} />
          ) : (
            <EmptySlot side={1} onChoose={() => openSearch(1)} />
          )}
        </div>

        {/* Swap button */}
        {anySelected && (
          <button
            onClick={handleSwap}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 bg-primary-container text-on-primary-container p-2 sm:p-2.5 rounded-full elevation-2 hover:elevation-3 transition-all duration-200 hover:scale-110 active:scale-95"
            aria-label="Intervertir les personnages"
            title="Intervertir les personnages"
          >
            <Icon name="swap_horiz" size={16} className="sm:hidden" />
            <Icon name="swap_horiz" size={20} className="hidden sm:block" />
          </button>
        )}

        <div className="transition-all duration-300">
          {char2 ? (
            <CompareCard char={char2} onClick={() => openSearch(2)} />
          ) : (
            <EmptySlot side={2} onChoose={() => openSearch(2)} />
          )}
        </div>
      </div>

      {/* Comparison sections */}
      {bothSelected && (
        <div className="space-y-5 sm:space-y-8 animate-in fade-in slide-in-from-bottom-3 duration-500">
          {/* Radar charts */}
          <div className="bg-surface-container rounded-xl elevation-1 p-3 sm:p-6">
            <h3 className="type-title-small text-on-surface mb-3 sm:mb-4">Radar des stats</h3>
            <div className="flex items-center justify-center gap-3 sm:gap-4 mb-2 sm:mb-3 flex-wrap">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[var(--md-sys-color-primary)]" />
                <span className="text-[11px] sm:text-xs font-medium truncate max-w-[100px] sm:max-w-none">
                  {char1.name}
                </span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[var(--md-sys-color-tertiary)]" />
                <span className="text-[11px] sm:text-xs font-medium truncate max-w-[100px] sm:max-w-none">
                  {char2.name}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:gap-4 justify-items-center">
              <StatHeptagon stats={char1.stats} size={160} />
              <StatHeptagon stats={char2.stats} size={160} />
            </div>
          </div>

          {/* Stat bars */}
          <div className="bg-surface-container rounded-xl elevation-1 p-3 sm:p-6">
            <StatComparisonBars
              stats1={char1.stats}
              stats2={char2.stats}
              name1={char1.name}
              name2={char2.name}
            />
          </div>

          {/* Skills */}
          <div className="bg-surface-container rounded-xl elevation-1 p-3 sm:p-6">
            <SkillsComparison
              skills1={char1.skills}
              skills2={char2.skills}
              name1={char1.name}
              name2={char2.name}
            />
          </div>
        </div>
      )}

      {/* Search dialog */}
      <CharacterSearchDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onSelect={handleSelect}
      />
    </div>
  );
}
