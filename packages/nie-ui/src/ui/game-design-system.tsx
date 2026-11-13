// SPDX-License-Identifier: Apache-2.0
import type React from "react";

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * Authentic Level-5 Inazuma Eleven Element Types.
 */
export type GameAffinity = "wind" | "fire" | "forest" | "mountain" | "void";

export const AFFINITY_CONFIG: Record<
  GameAffinity,
  { label: string; color: string; border: string; bg: string; iconSvg: string }
> = {
  wind: {
    label: "Vent",
    color: "#00FFFF",
    border: "border-cyan-400/50",
    bg: "bg-cyan-950/40",
    iconSvg: "M12 3v18m0-18l-4 4m4-4l4 4m-8 6h16",
  },
  fire: {
    label: "Feu",
    color: "#FF3B30",
    border: "border-red-500/50",
    bg: "bg-red-950/40",
    iconSvg: "M12 2c1.5 3 4 5.5 4 9a6 6 0 11-12 0c0-3.5 2.5-6 4-9z",
  },
  forest: {
    label: "Bois",
    color: "#34C759",
    border: "border-emerald-500/50",
    bg: "bg-emerald-950/40",
    iconSvg: "M12 2l7 12H5l7-12zm0 12v8",
  },
  mountain: {
    label: "Terre",
    color: "#FF9500",
    border: "border-amber-500/50",
    bg: "bg-amber-950/40",
    iconSvg: "M3 20l7-14 4 8 3-5 4 11H3z",
  },
  void: {
    label: "Neutre",
    color: "#A0A0B0",
    border: "border-slate-500/50",
    bg: "bg-slate-900/40",
    iconSvg: "M12 2a10 10 0 100 20 10 10 0 000-20z",
  },
};

/**
 * Elemental Affinity Chip with Level-5 styling, angled pill, and glowing border.
 */
export function AffinityChip({
  affinity,
  className,
  showLabel = true,
}: {
  affinity: GameAffinity;
  className?: string;
  showLabel?: boolean;
}) {
  const cfg = AFFINITY_CONFIG[affinity] ?? AFFINITY_CONFIG.void;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider rounded-sm border backdrop-blur-md transition-all select-none",
        cfg.border,
        cfg.bg,
        className,
      )}
      style={{ color: cfg.color }}
    >
      <svg
        className="w-3.5 h-3.5 stroke-current fill-none stroke-[2]"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d={cfg.iconSvg} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {showLabel && <span>{cfg.label}</span>}
    </span>
  );
}

/**
 * Authentic -10 degree skewed container with un-skewed internal content.
 */
export function SlantedContainer({
  children,
  className,
  contentClassName,
  glowColor = "#00FFFF",
}: {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  glowColor?: string;
}) {
  return (
    <div
      className={cn(
        "relative transform -skew-x-[10deg] border border-cyan-500/30 bg-[#061126]/90 backdrop-blur-md shadow-2xl transition-transform",
        className,
      )}
      style={{
        boxShadow: `0 0 20px -5px ${glowColor}33`,
      }}
    >
      <div className={cn("transform skew-x-[10deg]", contentClassName)}>
        {children}
      </div>
    </div>
  );
}

/**
 * High-performance Game Immersive Wallpaper Background Component.
 * Supports Stadium Night, Cyber Arena, and Match Pitch backdrops with optional scanlines.
 */
export function GameImmersiveBackground({
  variant = "stadium",
  showScanlines = true,
  children,
  className,
}: {
  variant?: "stadium" | "cyber" | "pitch";
  showScanlines?: boolean;
  children?: React.ReactNode;
  className?: string;
}) {
  const backgrounds = {
    stadium:
      "radial-gradient(ellipse at 50% 15%, rgba(8, 116, 255, 0.35) 0%, rgba(5, 14, 32, 0.95) 75%), linear-gradient(180deg, #030814 0%, #06152D 100%)",
    cyber:
      "radial-gradient(circle at 80% 20%, rgba(0, 255, 255, 0.25) 0%, rgba(8, 20, 48, 0.9) 60%), linear-gradient(135deg, #040915 0%, #0C1A38 100%)",
    pitch:
      "radial-gradient(circle at 50% 100%, rgba(52, 199, 89, 0.2) 0%, rgba(6, 17, 38, 0.95) 80%), linear-gradient(180deg, #020712 0%, #05141D 100%)",
  };

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden text-slate-100",
        className,
      )}
      style={{ background: backgrounds[variant] }}
    >
      {/* Stadium Floodlight Accents */}
      <div
        className="pointer-events-none absolute -top-40 left-1/4 h-96 w-96 rounded-full bg-cyan-400/10 blur-[120px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -top-40 right-1/4 h-96 w-96 rounded-full bg-blue-600/15 blur-[140px]"
        aria-hidden="true"
      />

      {/* Retro Arcade Scanline Texture */}
      {showScanlines && (
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.035] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.5)_50%)] bg-[length:100%_4px]"
          aria-hidden="true"
        />
      )}

      {/* Cyber Hex Grid Overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03] bg-[radial-gradient(#00FFFF_1px,transparent_1px)] [background-size:24px_24px]"
        aria-hidden="true"
      />

      <div className="relative z-10">{children}</div>
    </div>
  );
}
