"use client";

import { useMemo } from "react";
import { CommonSpriteIcon } from "@/components/ui/CommonSpriteIcon";
import { Icon } from "@/components/ui/Icon";
import type { SpriteCommonKey } from "@/config/sprites-common";
import { type Formation, ROLE_COLORS, ROLE_LABELS } from "@/lib/formations";
import type { TeamMember } from "@/lib/team-types";
import { cn } from "@/lib/utils";

const ELEMENT_SPRITE: Record<string, SpriteCommonKey> = {
  Fire: "fire",
  Wind: "wind",
  Forest: "forest",
  Mountain: "mountain",
};
const ELEMENT_COLORS: Record<string, string> = {
  Fire: "#ef4444",
  Wind: "#22c55e",
  Forest: "#a855f7",
  Mountain: "#f59e0b",
};
const ELEMENT_LABELS: Record<string, string> = {
  Fire: "Feu",
  Wind: "Vent",
  Forest: "Forêt",
  Mountain: "Montagne",
};

const RARITY_ORDER = ["BASARA", "Héros", "Émérite", "Expérimenté", "Normal"];
const RARITY_COLORS: Record<string, string> = {
  BASARA: "#ec4899",
  Héros: "#f59e0b",
  Émérite: "#8b5cf6",
  Expérimenté: "#3b82f6",
  Normal: "#6b7280",
};

interface TeamStatsProps {
  members: Record<string, TeamMember>;
  formation: Formation;
}

export function TeamStats({ members, formation }: TeamStatsProps) {
  const memberList = useMemo(() => Object.values(members), [members]);
  const totalSlots = 20;
  const filledSlots = memberList.length;
  const percent = Math.round((filledSlots / totalSlots) * 100);

  const elements = useMemo(() => {
    const c: Record<string, number> = { Fire: 0, Wind: 0, Forest: 0, Mountain: 0 };
    for (const m of memberList) if (c[m.element] !== undefined) c[m.element]++;
    return c;
  }, [memberList]);
  const maxElement = Math.max(...Object.values(elements), 1);

  const positionCoverage = useMemo(() => {
    const expected: Record<string, number> = { FW: 0, MF: 0, DF: 0, GK: 0 };
    for (const p of formation.positions) expected[p.role]++;
    const filled: Record<string, number> = { FW: 0, MF: 0, DF: 0, GK: 0 };
    for (const m of memberList) {
      if (m.slot.startsWith("field-") && filled[m.position] !== undefined) filled[m.position]++;
    }
    return Object.entries(expected).map(([role, total]) => ({
      role,
      total,
      filled: filled[role] || 0,
    }));
  }, [memberList, formation.positions]);

  const rarities = useMemo(() => {
    const c: Record<string, number> = {};
    for (const m of memberList) c[m.rarity] = (c[m.rarity] || 0) + 1;
    return RARITY_ORDER.filter((r) => c[r]).map((r) => ({ rarity: r, count: c[r] }));
  }, [memberList]);

  const balance = useMemo(() => {
    const fw = memberList.filter((m) => m.position === "FW").length;
    const df = memberList.filter((m) => m.position === "DF").length;
    if (fw > df + 1) return { label: "Offensif", icon: "trending_up", color: "text-red-500" };
    if (df > fw + 1) return { label: "Défensif", icon: "shield", color: "text-blue-500" };
    return { label: "Équilibré", icon: "balance", color: "text-emerald-500" };
  }, [memberList]);

  const circumference = 2 * Math.PI * 36;
  const strokeDashoffset = circumference - (percent / 100) * circumference;

  if (filledSlots === 0) {
    return (
      <div className="rounded-2xl bg-surface-container p-6 sm:p-8 elevation-1 text-center">
        <Icon name="analytics" size={40} className="text-on-surface-variant/20 mx-auto mb-3" />
        <p className="text-sm font-medium text-on-surface-variant">
          Placez des joueurs pour voir les statistiques
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-surface-container p-4 sm:p-5 elevation-1 space-y-5">
      {/* Top row: ring + balance + rarities */}
      <div className="flex items-center gap-4">
        {/* Completion ring */}
        <div className="relative size-20 shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
            <circle
              cx="40"
              cy="40"
              r="36"
              stroke="currentColor"
              strokeWidth="5"
              fill="none"
              className="text-on-surface/5"
            />
            <circle
              cx="40"
              cy="40"
              r="36"
              stroke="currentColor"
              strokeWidth="5"
              fill="none"
              className="text-primary"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              style={{ transition: "stroke-dashoffset 0.5s ease" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-black text-on-surface">{filledSlots}</span>
            <span className="text-[9px] text-on-surface-variant font-medium">/ {totalSlots}</span>
          </div>
        </div>
        <div className="flex-1 min-w-0 space-y-2.5">
          <div
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-high",
              balance.color,
            )}
          >
            <Icon name={balance.icon} size={16} />
            <span className="text-xs font-bold">{balance.label}</span>
          </div>
          {rarities.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {rarities.map(({ rarity, count }) => (
                <span
                  key={rarity}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-white"
                  style={{ backgroundColor: RARITY_COLORS[rarity] || "#6b7280" }}
                >
                  {count}x {rarity}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Elements */}
      <div>
        <p className="text-xs font-bold text-on-surface-variant mb-2">Éléments</p>
        <div className="space-y-1.5">
          {Object.entries(ELEMENT_LABELS).map(([key, label]) => {
            const count = elements[key] || 0;
            const pct = (count / maxElement) * 100;
            return (
              <div key={key} className="flex items-center gap-2.5">
                <CommonSpriteIcon name={ELEMENT_SPRITE[key]} scale={0.2} />
                <span className="text-xs w-16 text-on-surface-variant">{label}</span>
                <div className="flex-1 h-3 rounded-full bg-on-surface/5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${pct}%`, backgroundColor: ELEMENT_COLORS[key] }}
                  />
                </div>
                <span className="text-xs font-bold text-on-surface w-5 text-right">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Position coverage */}
      <div>
        <p className="text-xs font-bold text-on-surface-variant mb-2">Couverture</p>
        <div className="grid grid-cols-4 gap-2">
          {positionCoverage.map(({ role, total, filled }) => (
            <div key={role} className="text-center p-2 rounded-xl bg-surface-container-high">
              <div className="text-xl font-black" style={{ color: ROLE_COLORS[role] }}>
                {filled}
                <span className="text-xs text-on-surface-variant font-medium">/{total}</span>
              </div>
              <span className="text-[10px] font-bold text-on-surface-variant">
                {ROLE_LABELS[role]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
