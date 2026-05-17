"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useCallback, useMemo, useRef, useState } from "react";
import { CommonSpriteIcon } from "@/components/ui/CommonSpriteIcon";
import { Icon } from "@/components/ui/Icon";
import { RarityBadge } from "@/components/ui/rarity-badge";
import { SafeImage } from "@/components/ui/SafeImage";
import type { SpriteCommonKey } from "@/config/sprites-common";
import { ROLE_COLORS, ROLE_LABELS } from "@/lib/formations";
import { cn } from "@/lib/utils";

/* ── Types ────────────────────────────────────────────────── */

export interface PickerCharacterStats {
  kick: number;
  control: number;
  technique: number;
  pressure: number;
  physical: number;
  agility: number;
  intelligence: number;
}

export interface PickerCharacter {
  charaId: string;
  name: string;
  position: string;
  element: string;
  rarity: string;
  imageUrl: string;
  slug: string;
  series?: string;
  stats?: PickerCharacterStats;
}

/* ── Constants ────────────────────────────────────────────── */

const ELEMENT_SPRITE: Record<string, SpriteCommonKey> = {
  Fire: "fire",
  Wind: "wind",
  Forest: "forest",
  Mountain: "mountain",
};

const POSITIONS = [
  { value: "FW", label: "ATT" },
  { value: "MF", label: "MIL" },
  { value: "DF", label: "DEF" },
  { value: "GK", label: "GAR" },
];

const ELEMENTS = [
  { value: "Fire", label: "Feu" },
  { value: "Wind", label: "Vent" },
  { value: "Forest", label: "Forêt" },
  { value: "Mountain", label: "Montagne" },
];

const RARITIES = [
  { value: "BASARA", label: "BASARA", color: "#ec4899" },
  { value: "Héros", label: "Héros", color: "#f59e0b" },
  { value: "Émérite", label: "Émérite", color: "#8b5cf6" },
  { value: "Expérimenté", label: "Expé.", color: "#3b82f6" },
  { value: "Normal", label: "Normal", color: "#6b7280" },
];

const PAGE_SIZE = 60;

/* ── Draggable Character Card ─────────────────────────────── */

function DraggableCharaCard({
  char,
  isPlaced,
  isSelected,
  onTap,
}: {
  char: PickerCharacter;
  isPlaced: boolean;
  isSelected?: boolean;
  onTap?: (char: PickerCharacter) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `roster-${char.charaId}`,
    data: {
      type: "player",
      character: char,
      origin: "roster",
    },
    disabled: isPlaced,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.3 : isPlaced ? 0.4 : 1,
  };

  const elSprite = ELEMENT_SPRITE[char.element];
  const roleColor = ROLE_COLORS[char.position] || ROLE_COLORS.MF;
  const roleLabel = ROLE_LABELS[char.position] || char.position;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      role="listitem"
      aria-label={`${char.name} — ${ROLE_LABELS[char.position] || char.position}, ${char.element}, ${char.rarity}${isPlaced ? " (déjà placé)" : ""}`}
      onClick={(e) => {
        if (!isPlaced && onTap) {
          e.preventDefault();
          e.stopPropagation();
          onTap(char);
        }
      }}
      className={cn(
        "relative w-full rounded-lg overflow-hidden bg-neutral-900 transition-all",
        isPlaced
          ? "cursor-not-allowed grayscale"
          : "cursor-pointer sm:cursor-grab sm:active:cursor-grabbing hover:ring-1 hover:ring-primary/50",
        isDragging && "z-50 ring-2 ring-primary",
        isSelected && "ring-2 ring-primary scale-95",
      )}
    >
      <div className="relative w-full aspect-square overflow-hidden">
        <SafeImage
          src={char.imageUrl}
          alt={char.name}
          fill
          sizes="(max-width: 640px) 20vw, 80px"
          className="object-cover"
          unoptimized
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

        {/* Rarity */}
        <div className="absolute top-0.5 left-0.5">
          <RarityBadge rarity={char.rarity} size="xs" />
        </div>

        {/* Element + Position */}
        <div className="absolute bottom-5 left-0.5 flex items-center gap-0.5">
          {elSprite && <CommonSpriteIcon name={elSprite} scale={0.18} />}
          <span
            className="px-0.5 py-px rounded text-[6px] sm:text-[7px] font-black text-white leading-none"
            style={{ backgroundColor: roleColor }}
          >
            {roleLabel}
          </span>
        </div>

        {/* Name */}
        <p className="absolute bottom-0 inset-x-0 px-0.5 pb-0.5 text-white font-bold text-[7px] sm:text-[8px] truncate drop-shadow-lg text-center">
          {char.name}
        </p>

        {/* Placed indicator */}
        {isPlaced && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <Icon name="check_circle" size={20} className="text-primary" />
          </div>
        )}
        {/* Selected indicator (tap-to-place) */}
        {isSelected && !isPlaced && (
          <div className="absolute inset-0 flex items-center justify-center bg-primary/20 border-2 border-primary rounded-lg">
            <Icon name="touch_app" size={20} className="text-primary" />
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Character Picker Panel ───────────────────────────────── */

interface CharacterPickerProps {
  characters: PickerCharacter[];
  placedIds: Set<string>;
  selectedCharaId?: string | null;
  onCharaTap?: (char: PickerCharacter) => void;
}

export function CharacterPicker({
  characters,
  placedIds,
  selectedCharaId,
  onCharaTap,
}: CharacterPickerProps) {
  const [search, setSearch] = useState("");
  const [filterPosition, setFilterPosition] = useState<string | null>(null);
  const [filterElement, setFilterElement] = useState<string | null>(null);
  const [filterRarity, setFilterRarity] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const scrollRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    let list = characters;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q));
    }
    if (filterPosition) {
      list = list.filter((c) => c.position === filterPosition);
    }
    if (filterElement) {
      list = list.filter((c) => c.element === filterElement);
    }
    if (filterRarity) {
      list = list.filter((c) => c.rarity === filterRarity);
    }
    return list;
  }, [characters, search, filterPosition, filterElement, filterRarity]);

  const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 200) {
      setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, filtered.length));
    }
  }, [filtered.length]);

  const hasActiveFilters = !!filterPosition || !!filterElement || !!filterRarity || !!search;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Search */}
      <div className="px-3 pt-3 pb-2">
        <div className="relative">
          <Icon
            name="search"
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setVisibleCount(PAGE_SIZE);
            }}
            placeholder="Rechercher un joueur..."
            aria-label="Rechercher un joueur par nom"
            className="w-full h-11 pl-10 pr-3 rounded-2xl bg-surface-container-high border-none text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="px-3 pb-2 space-y-1.5">
        {/* Position */}
        <div className="flex gap-1.5" role="group" aria-label="Filtrer par position">
          {POSITIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => {
                setFilterPosition((prev) => (prev === value ? null : value));
                setVisibleCount(PAGE_SIZE);
              }}
              aria-pressed={filterPosition === value}
              aria-label={`Filtrer par position ${label}`}
              className={cn(
                "flex-1 h-8 rounded-xl text-xs font-bold transition-all",
                filterPosition === value
                  ? "text-white elevation-1"
                  : "border border-outline/30 text-on-surface-variant hover:bg-on-surface/[0.08]",
              )}
              style={filterPosition === value ? { backgroundColor: ROLE_COLORS[value] } : undefined}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Element + clear */}
        <div className="flex gap-1.5" role="group" aria-label="Filtrer par élément">
          {ELEMENTS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => {
                setFilterElement((prev) => (prev === value ? null : value));
                setVisibleCount(PAGE_SIZE);
              }}
              aria-pressed={filterElement === value}
              aria-label={`Filtrer par élément ${label}`}
              className={cn(
                "flex-1 inline-flex items-center justify-center gap-1 h-8 rounded-xl text-xs font-bold transition-all",
                filterElement === value
                  ? "bg-secondary-container text-on-secondary-container elevation-1"
                  : "border border-outline/30 text-on-surface-variant hover:bg-on-surface/[0.08]",
              )}
            >
              <CommonSpriteIcon name={ELEMENT_SPRITE[value]} scale={0.15} />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
          {hasActiveFilters && (
            <button
              onClick={() => {
                setSearch("");
                setFilterPosition(null);
                setFilterElement(null);
                setFilterRarity(null);
                setVisibleCount(PAGE_SIZE);
              }}
              className="h-8 px-3 rounded-xl text-xs text-primary font-bold hover:bg-primary/10 transition-colors"
              aria-label="Réinitialiser les filtres"
            >
              <Icon name="filter_alt_off" size={16} />
            </button>
          )}
        </div>

        {/* Rarity */}
        <div className="flex gap-1 overflow-x-auto scrollbar-hide">
          {RARITIES.map(({ value, label, color }) => (
            <button
              key={value}
              onClick={() => {
                setFilterRarity((prev) => (prev === value ? null : value));
                setVisibleCount(PAGE_SIZE);
              }}
              className={cn(
                "h-7 px-2 rounded-lg text-[10px] font-bold transition-all shrink-0",
                filterRarity === value
                  ? "text-white elevation-1"
                  : "border border-outline/30 text-on-surface-variant hover:bg-on-surface/[0.08]",
              )}
              style={filterRarity === value ? { backgroundColor: color } : undefined}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Count */}
      <div className="px-3 pb-1.5 flex items-center justify-between">
        <p className="text-[10px] text-on-surface-variant">
          {filtered.length} joueur{filtered.length > 1 ? "s" : ""}
        </p>
        {placedIds.size > 0 && (
          <p className="text-[10px] text-primary font-bold">
            {placedIds.size} placé{placedIds.size > 1 ? "s" : ""}
          </p>
        )}
      </div>

      {/* Character Grid */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto px-3 pb-3"
      >
        <div
          className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-4 gap-2"
          role="list"
          aria-label="Liste des joueurs disponibles"
        >
          {visible.map((char) => (
            <DraggableCharaCard
              key={char.charaId}
              char={char}
              isPlaced={placedIds.has(char.charaId)}
              isSelected={selectedCharaId === char.charaId}
              onTap={onCharaTap}
            />
          ))}
        </div>
        {visibleCount < filtered.length && (
          <button
            onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
            className="w-full mt-3 py-3 text-sm text-primary font-bold rounded-2xl bg-surface-container-high hover:bg-surface-container-highest transition-colors"
          >
            Charger plus ({filtered.length - visibleCount} restants)
          </button>
        )}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center py-12 text-on-surface-variant">
            <Icon name="search_off" size={40} className="mb-3 opacity-30" />
            <p className="text-sm font-medium">Aucun résultat</p>
            <p className="text-xs opacity-60 mt-1">Essayez un autre filtre</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Export overlay version for DragOverlay ────────────────── */

export function CharacterPickerOverlay({ char }: { char: PickerCharacter }) {
  const roleColor = ROLE_COLORS[char.position] || ROLE_COLORS.MF;
  const roleLabel = ROLE_LABELS[char.position] || char.position;

  return (
    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden bg-neutral-900 shadow-2xl ring-2 ring-primary pointer-events-none">
      <div className="relative w-full h-full">
        <SafeImage
          src={char.imageUrl}
          alt={char.name}
          fill
          sizes="80px"
          className="object-cover"
          unoptimized
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        <span
          className="absolute top-0.5 left-0.5 text-[7px] font-black px-1 py-px rounded text-white"
          style={{ backgroundColor: roleColor }}
        >
          {roleLabel}
        </span>
        <p className="absolute bottom-0 inset-x-0 px-0.5 pb-0.5 text-white font-bold text-[7px] truncate text-center">
          {char.name}
        </p>
      </div>
    </div>
  );
}
