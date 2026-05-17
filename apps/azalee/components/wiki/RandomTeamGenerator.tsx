"use client";

import type { BaseCharacter } from "@rosegriffon/inagle";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CommonSpriteIcon } from "@/components/ui/CommonSpriteIcon";
import { Icon } from "@/components/ui/Icon";
import { RarityBadge } from "@/components/ui/rarity-badge";
import { SafeImage } from "@/components/ui/SafeImage";
import type { SpriteCommonKey } from "@/config/sprites-common";
import { getCharacterImageUrl } from "@/lib/images";
import { cn } from "@/lib/utils";

// ---------- Constants ----------

const ELEMENT_SPRITE: Record<string, SpriteCommonKey> = {
  Fire: "fire",
  Wind: "wind",
  Forest: "forest",
  Mountain: "mountain",
};

const POS_LABEL: Record<string, string> = { FW: "ATT", MF: "MIL", DF: "DEF", GK: "GAR" };
const POS_COLOR: Record<string, string> = {
  FW: "bg-red-600",
  MF: "bg-emerald-600",
  DF: "bg-blue-600",
  GK: "bg-amber-500",
};

const PLAYSTYLE_SPRITE: Record<string, SpriteCommonKey> = {
  Bond: "lien",
  Justice: "justice",
  Breach: "breche",
  Tension: "tension",
  "Rough Play": "jeu_violent",
  Counter: "contre",
};

const PLAYSTYLES = [
  { key: "Bond", label: "Lien" },
  { key: "Justice", label: "Justice" },
  { key: "Breach", label: "Percée" },
  { key: "Tension", label: "Tension" },
  { key: "Rough Play", label: "Jeu violent" },
  { key: "Counter", label: "Contre" },
];

const ELEMENTS = [
  { value: "Fire", label: "Feu" },
  { value: "Wind", label: "Vent" },
  { value: "Forest", label: "Forêt" },
  { value: "Mountain", label: "Montagne" },
];

interface Formation {
  name: string;
  layout: string;
  df: number;
  mf: number;
  fw: number;
  off: number;
  def: number;
}

// Formations dédupliquées par distribution de joueurs (df-mf-fw)
// Le GK (toujours 1) n'est pas compté dans le layout
const FORMATIONS: Formation[] = [
  { name: "4-4-2", layout: "4-4-2", df: 4, mf: 4, fw: 2, off: 3, def: 3 },
  { name: "4-3-3", layout: "4-3-3", df: 4, mf: 3, fw: 3, off: 4, def: 2 },
  { name: "3-4-3", layout: "3-4-3", df: 3, mf: 4, fw: 3, off: 4, def: 2 },
  { name: "3-5-2", layout: "3-5-2", df: 3, mf: 5, fw: 2, off: 3, def: 3 },
  { name: "4-5-1", layout: "4-5-1", df: 4, mf: 5, fw: 1, off: 2, def: 4 },
  { name: "3-6-1", layout: "3-6-1", df: 3, mf: 6, fw: 1, off: 3, def: 3 },
  { name: "5-4-1", layout: "5-4-1", df: 5, mf: 4, fw: 1, off: 2, def: 4 },
  { name: "2-4-4", layout: "2-4-4", df: 2, mf: 4, fw: 4, off: 5, def: 1 },
  { name: "2-5-3", layout: "2-5-3", df: 2, mf: 5, fw: 3, off: 4, def: 2 },
  { name: "5-1-4", layout: "5-1-4", df: 5, mf: 1, fw: 4, off: 2, def: 4 },
  { name: "3-3-4", layout: "3-3-4", df: 3, mf: 3, fw: 4, off: 1, def: 5 },
  { name: "5-3-2", layout: "5-3-2", df: 5, mf: 3, fw: 2, off: 3, def: 3 },
];

// ---------- Helpers ----------

function pickRandom<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const result: T[] = [];
  for (let i = 0; i < n && copy.length > 0; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    result.push(copy.splice(idx, 1)[0]);
  }
  return result;
}

function resolveImageUrl(char: BaseCharacter): string {
  const charAny = char as any;
  const variant = char.variants?.[0] as any;
  const zukanHash = charAny.zukanHash || variant?.zukanHash;
  if (zukanHash) {
    const clean = zukanHash.startsWith("/") ? zukanHash.substring(1) : zukanHash;
    return `https://dxi4wb638ujep.cloudfront.net/1/${clean}.png`;
  }
  return getCharacterImageUrl(char.internalCode);
}

function getCharHref(char: BaseCharacter): string {
  const charAny = char as any;
  const variant = char.variants?.[0] as any;
  return `/chara/${charAny.slug || variant?.slug || variant?.charaParamId || char.charaId}`;
}

function getCharName(char: BaseCharacter): string {
  return char.names?.fr || char.names?.en || char.names?.ja || "?";
}

// ---------- Types ----------

interface Coordinator {
  id: number;
  name_localised: string;
  name_romaji: string;
  name_kanji?: string;
  role: string;
  playstyle?: string;
  element?: string;
  image?: string;
}

interface RandomTeamGeneratorProps {
  pools: {
    gk: BaseCharacter[];
    df: BaseCharacter[];
    mf: BaseCharacter[];
    fw: BaseCharacter[];
  };
  coordinators: {
    coaches: Coordinator[];
    managers: Coordinator[];
  };
}

interface GeneratedTeam {
  gk: BaseCharacter[];
  df: BaseCharacter[];
  mf: BaseCharacter[];
  fw: BaseCharacter[];
  coach: Coordinator | null;
  managers: Coordinator[];
}

// ---------- Sub-components ----------

function PlayerCard({
  player,
  locked,
  onToggleLock,
  animDelay,
  animating,
}: {
  player: BaseCharacter;
  locked: boolean;
  onToggleLock: () => void;
  animDelay: number;
  animating: boolean;
}) {
  const charAny = player as any;
  const variant = player.variants?.[0] as any;
  const position = variant?.position || charAny.position || "MF";
  const element = variant?.element || charAny.element || "Void";
  const rarity = charAny.bestRarity || variant?.rarity || "Normal";
  const imageUrl = resolveImageUrl(player);
  const name = getCharName(player);
  const href = getCharHref(player);
  const elSprite = ELEMENT_SPRITE[element];

  return (
    <div
      className={cn(
        "relative group w-full transition-all",
        animating ? "opacity-0 scale-95" : "opacity-100 scale-100",
      )}
      style={{
        transitionDuration: "300ms",
        transitionDelay: animating ? "0ms" : `${animDelay}ms`,
      }}
    >
      <Link
        href={href}
        className="block w-full rounded-lg sm:rounded-xl overflow-hidden border border-outline-variant/20 hover:border-primary/40 bg-neutral-950 transition-all"
      >
        <div className="relative w-full aspect-square overflow-hidden">
          <SafeImage
            src={imageUrl}
            alt={name}
            fill
            sizes="(max-width: 640px) 20vw, 140px"
            className="object-cover"
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

          {/* Rarity */}
          <div className="absolute top-0.5 left-0.5 sm:top-1.5 sm:left-1.5">
            <RarityBadge rarity={rarity} size="xs" />
          </div>

          {/* Element + Position */}
          <div className="absolute bottom-5 sm:bottom-8 left-0.5 sm:left-1.5 flex items-center gap-0.5">
            {elSprite && <CommonSpriteIcon name={elSprite} scale={0.2} className="sm:scale-125" />}
            <span
              className={cn(
                "px-0.5 sm:px-1 py-px rounded text-[7px] sm:text-[9px] font-black text-white leading-none",
                POS_COLOR[position] || "bg-slate-600",
              )}
            >
              {POS_LABEL[position] || position}
            </span>
          </div>

          {/* Name */}
          <div className="absolute bottom-0 inset-x-0 px-1 sm:px-2 pb-0.5 sm:pb-1.5">
            <p className="text-white font-bold text-[8px] sm:text-xs truncate drop-shadow-lg">
              {name}
            </p>
          </div>
        </div>
      </Link>

      {/* Lock toggle */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggleLock();
        }}
        className={cn(
          "absolute top-0.5 right-0.5 sm:top-1.5 sm:right-1.5 z-10 p-0.5 sm:p-1 rounded-full transition-all",
          locked
            ? "bg-primary text-on-primary elevation-1"
            : "bg-black/40 text-white/60 opacity-0 group-hover:opacity-100 hover:bg-black/60",
        )}
        aria-label={locked ? `Débloquer ${name}` : `Bloquer ${name}`}
        aria-pressed={locked}
        title={locked ? "Débloquer" : "Bloquer ce joueur"}
      >
        {locked ? (
          <Icon name="lock" size={10} className="sm:w-3 sm:h-3" />
        ) : (
          <Icon name="lock_open" size={10} className="sm:w-3 sm:h-3" />
        )}
      </button>
    </div>
  );
}

function resolveCoordinatorImage(person: Coordinator): string | null {
  if (!person.image) return null;
  const clean = person.image.startsWith("/") ? person.image.substring(1) : person.image;
  return `https://dxi4wb638ujep.cloudfront.net/1/${clean}.png`;
}

function StaffSlot({ person, role }: { person: Coordinator; role: string }) {
  const imageUrl = resolveCoordinatorImage(person);

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-xl bg-surface-container elevation-1">
      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-surface-container-high flex items-center justify-center shrink-0 overflow-hidden">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={person.name_localised || person.name_romaji}
            width={40}
            height={40}
            className="object-cover w-full h-full"
            unoptimized
          />
        ) : (
          <Icon
            name={role === "Coach" ? "sports" : "person"}
            size={18}
            className="text-on-surface-variant"
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] sm:text-sm font-bold text-on-surface truncate">
          {person.name_localised || person.name_romaji}
        </p>
        <p className="text-[10px] sm:text-[11px] text-on-surface-variant truncate">
          {role === "Coach" ? "Coach" : "Manageuse"}
          {person.playstyle
            ? ` · ${PLAYSTYLES.find((p) => p.key === person.playstyle)?.label || person.playstyle}`
            : ""}
        </p>
      </div>
    </div>
  );
}

// ---------- Formation Picker (mobile: select, desktop: chips) ----------

function FormationPicker({
  formations,
  selectedIdx,
  onSelect,
}: {
  formations: Formation[];
  selectedIdx: number;
  onSelect: (idx: number) => void;
}) {
  const selected = formations[selectedIdx];

  return (
    <div>
      <p className="type-label-medium text-on-surface-variant mb-1.5">Formation</p>

      {/* Mobile: native select */}
      <div className="sm:hidden">
        <div className="relative">
          <select
            value={selectedIdx}
            onChange={(e) => onSelect(Number(e.target.value))}
            className="w-full appearance-none rounded-xl bg-surface-container border border-outline-variant/30 px-3 py-2.5 pr-8 text-sm font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            {formations.map((f, i) => (
              <option key={i} value={i}>
                {f.name} ({f.layout})
              </option>
            ))}
          </select>
          <Icon
            name="expand_more"
            size={16}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
          />
        </div>
        <div className="flex items-center gap-2 mt-1.5 px-1">
          <span className="text-[10px] text-on-surface-variant">{selected.layout}</span>
          <span className="text-[10px] text-on-surface-variant">
            ATT {"★".repeat(selected.off)}
            {"☆".repeat(5 - selected.off)}
          </span>
          <span className="text-[10px] text-on-surface-variant">
            DEF {"★".repeat(selected.def)}
            {"☆".repeat(5 - selected.def)}
          </span>
        </div>
      </div>

      {/* Desktop: chip grid — Filter Chips MD3 */}
      <div className="hidden sm:flex flex-wrap gap-1.5">
        {formations.map((f, i) => {
          const isActive = i === selectedIdx;
          return (
            <button
              key={`${f.name}-${i}`}
              onClick={() => onSelect(i)}
              aria-label={`Formation ${f.name}`}
              aria-pressed={isActive}
              className={cn(
                "inline-flex items-center gap-1 h-8 px-3 rounded-lg text-xs font-bold transition-all",
                isActive
                  ? "bg-secondary-container text-on-secondary-container elevation-1"
                  : "border border-outline text-on-surface-variant hover:bg-on-surface/[0.08]",
              )}
            >
              {isActive && <Icon name="check" size={16} />}
              <span>{f.name}</span>
              <span
                className={cn(
                  "text-[10px] font-normal opacity-70",
                  isActive ? "text-on-secondary-container/70" : "",
                )}
              >
                {f.layout}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Main component ----------

export function RandomTeamGenerator({ pools, coordinators }: RandomTeamGeneratorProps) {
  const [selectedPlaystyles, setSelectedPlaystyles] = useState<string[]>([]);
  const [selectedElement, setSelectedElement] = useState<string | undefined>();
  const [formationIdx, setFormationIdx] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const formation = FORMATIONS[formationIdx];

  // Filtered pools based on playstyle + element
  const filteredPools = useCallback(() => {
    const filterPool = (arr: BaseCharacter[], minCount: number) => {
      let filtered = arr;

      if (selectedPlaystyles.length > 0) {
        const psFiltered = arr.filter((c) => {
          const ps = (c as any).sheetData?.playstyle || (c as any).playstyle;
          return ps && selectedPlaystyles.includes(ps);
        });
        if (psFiltered.length >= minCount) filtered = psFiltered;
      }

      if (selectedElement) {
        const elFiltered = filtered.filter((c) => {
          const variant = c.variants?.[0] as any;
          const el = variant?.element || (c as any).element;
          return el === selectedElement;
        });
        if (elFiltered.length >= minCount) filtered = elFiltered;
      }

      return filtered;
    };

    return {
      gk: filterPool(pools.gk, 1),
      df: filterPool(pools.df, formation.df),
      mf: filterPool(pools.mf, formation.mf),
      fw: filterPool(pools.fw, formation.fw),
    };
  }, [pools, selectedPlaystyles, selectedElement, formation]);

  const generate = useCallback((): GeneratedTeam => {
    const p = filteredPools();
    return {
      gk: pickRandom(p.gk, 1),
      df: pickRandom(p.df, formation.df),
      mf: pickRandom(p.mf, formation.mf),
      fw: pickRandom(p.fw, formation.fw),
      coach: pickRandom(coordinators.coaches, 1)[0] || null,
      managers: pickRandom(coordinators.managers, 3),
    };
  }, [filteredPools, formation, coordinators]);

  const [team, setTeam] = useState<GeneratedTeam>(() => generate());

  // Auto-regenerate when formation or filters change
  const prevFormationRef = useRef(formationIdx);
  const prevElementRef = useRef(selectedElement);
  const prevPlaystyleRef = useRef(selectedPlaystyles);
  useEffect(() => {
    if (
      prevFormationRef.current !== formationIdx ||
      prevElementRef.current !== selectedElement ||
      prevPlaystyleRef.current !== selectedPlaystyles
    ) {
      prevFormationRef.current = formationIdx;
      prevElementRef.current = selectedElement;
      prevPlaystyleRef.current = selectedPlaystyles;
      setAnimating(true);
      setTimeout(() => {
        setTeam(generate());
        setAnimating(false);
      }, 200);
    }
  }, [formationIdx, selectedElement, selectedPlaystyles, generate]);

  // Locked players
  const [locked, setLocked] = useState<Set<string>>(new Set());

  const toggleLock = useCallback((key: string) => {
    setLocked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const regenerate = useCallback(() => {
    setAnimating(true);
    setTimeout(() => {
      setTeam((prev) => {
        const fresh = generate();
        const mergePosition = (
          position: "gk" | "df" | "mf" | "fw",
          freshArr: BaseCharacter[],
        ): BaseCharacter[] => {
          return freshArr.map((freshPlayer, i) => {
            const key = `${position}-${i}`;
            if (locked.has(key) && prev[position][i]) {
              return prev[position][i];
            }
            return freshPlayer;
          });
        };
        return {
          ...fresh,
          gk: mergePosition("gk", fresh.gk),
          df: mergePosition("df", fresh.df),
          mf: mergePosition("mf", fresh.mf),
          fw: mergePosition("fw", fresh.fw),
        };
      });
      setAnimating(false);
    }, 300);
  }, [generate, locked]);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* silent */
    }
  }, []);

  const togglePlaystyle = (key: string) => {
    setSelectedPlaystyles((prev) => {
      if (prev.includes(key)) return prev.filter((p) => p !== key);
      if (prev.length >= 2) return [prev[1], key];
      return [...prev, key];
    });
  };

  const hasLocked = locked.size > 0;
  const hasActiveFilters = selectedPlaystyles.length > 0 || !!selectedElement;

  // Staggered animation delay counter
  let slotIndex = 0;

  const renderRow = (position: "gk" | "df" | "mf" | "fw", players: BaseCharacter[]) =>
    players.map((p, i) => {
      const key = `${position}-${i}`;
      const delay = slotIndex++ * 30;
      return (
        <PlayerCard
          key={`${key}-${p.charaId}`}
          player={p}
          locked={locked.has(key)}
          onToggleLock={() => toggleLock(key)}
          animDelay={delay}
          animating={animating}
        />
      );
    });

  return (
    <div className="w-full space-y-4 sm:space-y-6">
      {/* Header: title + actions */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="font-[BradBunR] text-lg sm:text-2xl md:text-3xl text-on-surface tracking-wide truncate">
            Équipe aléatoire
          </h1>
          <p className="text-[11px] sm:text-sm text-on-surface-variant mt-0.5 truncate">
            {formation.name} · {formation.layout}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {hasLocked && (
            <button
              onClick={() => setLocked(new Set())}
              className="p-2.5 rounded-full bg-surface-container-high state-layer relative overflow-hidden text-on-surface-variant transition-all"
              aria-label="Débloquer tous les joueurs"
              title="Tout débloquer"
            >
              <Icon name="lock_open" size={18} />
            </button>
          )}
          <button
            onClick={handleCopyLink}
            className="p-2.5 rounded-full bg-surface-container-high state-layer relative overflow-hidden text-on-surface-variant transition-all"
            aria-label="Copier le lien"
            title="Copier le lien"
          >
            {copied ? (
              <Icon name="check" size={18} className="text-green-500" />
            ) : (
              <Icon name="content_copy" size={18} />
            )}
          </button>
          {/* Extended FAB — Régénérer */}
          <button
            onClick={regenerate}
            disabled={animating}
            aria-label="Régénérer l'équipe"
            className="inline-flex items-center gap-2 h-14 px-4 rounded-2xl bg-primary-container text-on-primary-container font-bold text-sm elevation-3 hover:elevation-4 active:elevation-2 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            <Icon name="casino" size={20} />
            <span className="hidden sm:inline">Régénérer</span>
          </button>
        </div>
      </div>

      {/* Formation picker */}
      <FormationPicker
        formations={FORMATIONS}
        selectedIdx={formationIdx}
        onSelect={(i) => {
          setFormationIdx(i);
          setLocked(new Set());
        }}
      />

      {/* Filters toggle (mobile: collapsible) */}
      <div>
        <button
          onClick={() => setFiltersOpen(!filtersOpen)}
          className="sm:hidden flex items-center gap-1.5 type-label-medium text-on-surface-variant"
        >
          Filtres
          {hasActiveFilters ? ` (${selectedPlaystyles.length + (selectedElement ? 1 : 0)})` : ""}
          <Icon name={filtersOpen ? "expand_less" : "expand_more"} size={16} />
        </button>

        <div
          className={cn(
            "space-y-3 sm:space-y-3",
            // Mobile: collapsible
            "sm:block",
            filtersOpen ? "block mt-2" : "hidden",
          )}
        >
          {/* Element filter — Filter Chips MD3 */}
          <div>
            <p className="type-label-medium text-on-surface-variant mb-1.5">Élément</p>
            <div className="flex flex-wrap gap-1.5">
              {ELEMENTS.map(({ value, label }) => {
                const isActive = selectedElement === value;
                return (
                  <button
                    key={value}
                    onClick={() =>
                      setSelectedElement((prev) => (prev === value ? undefined : value))
                    }
                    aria-label={`Filtrer par élément ${label}`}
                    aria-pressed={isActive}
                    className={cn(
                      "inline-flex items-center gap-1 h-8 px-3 rounded-lg text-xs font-bold transition-all",
                      isActive
                        ? "bg-secondary-container text-on-secondary-container elevation-1"
                        : "border border-outline text-on-surface-variant hover:bg-on-surface/[0.08]",
                    )}
                  >
                    {isActive && <Icon name="check" size={16} />}
                    <CommonSpriteIcon name={ELEMENT_SPRITE[value]} scale={0.25} />
                    {label}
                  </button>
                );
              })}
              {selectedElement && (
                <button
                  onClick={() => setSelectedElement(undefined)}
                  className="type-label-large text-primary px-3 py-2 rounded-full state-layer relative overflow-hidden"
                >
                  Effacer
                </button>
              )}
            </div>
          </div>

          {/* Playstyle filter — Filter Chips MD3 */}
          <div>
            <p className="type-label-medium text-on-surface-variant mb-1.5">Style de jeu (max 2)</p>
            <div className="flex flex-wrap gap-1.5">
              {PLAYSTYLES.map((ps) => {
                const active = selectedPlaystyles.includes(ps.key);
                const sprite = PLAYSTYLE_SPRITE[ps.key];
                return (
                  <button
                    key={ps.key}
                    onClick={() => togglePlaystyle(ps.key)}
                    aria-label={`Filtrer par style ${ps.label}`}
                    aria-pressed={active}
                    className={cn(
                      "inline-flex items-center gap-1 h-8 px-3 rounded-lg text-xs font-bold transition-all",
                      active
                        ? "bg-secondary-container text-on-secondary-container elevation-1"
                        : "border border-outline text-on-surface-variant hover:bg-on-surface/[0.08]",
                    )}
                  >
                    {active && <Icon name="check" size={16} />}
                    {sprite && <CommonSpriteIcon name={sprite} scale={0.25} />}
                    {ps.label}
                  </button>
                );
              })}
              {selectedPlaystyles.length > 0 && (
                <button
                  onClick={() => setSelectedPlaystyles([])}
                  className="type-label-large text-primary px-3 py-2 rounded-full state-layer relative overflow-hidden"
                >
                  Effacer
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Formation field */}
      <div className="bg-surface-container rounded-xl elevation-1 p-1.5 sm:p-4 lg:p-6">
        {/* FW */}
        {team.fw.length > 0 && (
          <div
            className="mx-auto mb-1 sm:mb-3 gap-1 sm:gap-2 grid"
            style={{
              gridTemplateColumns: `repeat(${formation.fw}, 1fr)`,
              maxWidth: `${Math.min(100, formation.fw * 22)}%`,
            }}
          >
            {renderRow("fw", team.fw)}
          </div>
        )}

        {/* MF */}
        <div
          className="mx-auto mb-1 sm:mb-3 gap-1 sm:gap-2 grid"
          style={{
            gridTemplateColumns: `repeat(${formation.mf}, 1fr)`,
            maxWidth: `${Math.min(100, formation.mf * 20)}%`,
          }}
        >
          {renderRow("mf", team.mf)}
        </div>

        {/* DF */}
        <div
          className="mx-auto mb-1 sm:mb-3 gap-1 sm:gap-2 grid"
          style={{
            gridTemplateColumns: `repeat(${formation.df}, 1fr)`,
            maxWidth: `${Math.min(100, formation.df * 20)}%`,
          }}
        >
          {renderRow("df", team.df)}
        </div>

        {/* GK */}
        <div className="w-[18%] sm:w-1/6 mx-auto">{renderRow("gk", team.gk)}</div>

        {/* Formation label */}
        <div className="text-center mt-1.5 sm:mt-3 space-y-0.5">
          <span className="block text-[10px] sm:text-xs font-bold text-on-surface-variant/80">
            {formation.name}
          </span>
          <span className="block text-[9px] sm:text-[10px] text-on-surface-variant/50 tracking-widest">
            {formation.layout} · ATT {formation.off} · DEF {formation.def}
          </span>
        </div>
      </div>

      {/* Staff */}
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2">
        {team.coach && <StaffSlot person={team.coach} role="Coach" />}
        {team.managers.map((m) => (
          <StaffSlot key={m.id} person={m} role="Manager" />
        ))}
      </div>
    </div>
  );
}
