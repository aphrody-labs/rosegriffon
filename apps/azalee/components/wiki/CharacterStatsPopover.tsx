"use client";

import type { GameCharacterStats } from "@rosegriffon/inagle";
import { BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface CharacterStatsPopoverProps {
  stats: GameCharacterStats;
  name: string;
}

const STAT_LABELS = {
  kick: { fr: "Frappe", color: "bg-red-500" },
  control: { fr: "Maîtrise", color: "bg-blue-500" },
  technique: { fr: "Technique", color: "bg-green-500" },
  pressure: { fr: "Défense", color: "bg-purple-500" }, // "Block" / Pressure
  physical: { fr: "Physique", color: "bg-orange-500" },
  agility: { fr: "Vitesse", color: "bg-cyan-500" },
  intelligence: { fr: "Intelligence", color: "bg-indigo-500" },
};

const MAX_STAT = 250; // Estimated max for lv50 visual scaling

export function CharacterStatsPopover({ stats, name }: CharacterStatsPopoverProps) {
  if (!stats) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-on-surface-variant hover:text-primary"
        >
          <BarChart3 className="size-4" />
          <span className="sr-only">Stats de {name}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-4 bg-surface-container-high border-outline-variant"
        align="end"
      >
        <div className="space-y-4">
          <h4 className="font-medium text-on-surface flex items-center justify-between">
            <span>Stats (Niv. 50)</span>
            <span className="text-xs font-normal text-on-surface-variant">Max estimé</span>
          </h4>

          <div className="space-y-3">
            {Object.entries(stats).map(([key, value]) => {
              const config = STAT_LABELS[key as keyof typeof STAT_LABELS];
              if (!config) return null;

              const percentage = Math.min((value / MAX_STAT) * 100, 100);

              return (
                <div key={key} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-on-surface-variant">{config.fr}</span>
                    <span className="font-medium text-on-surface font-mono">{value}</span>
                  </div>
                  <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        config.color,
                      )}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-2 border-t border-outline-variant/30 flex justify-between items-center text-xs text-on-surface-variant">
            <span>Total</span>
            <span className="font-medium text-on-surface font-mono text-sm">
              {Object.values(stats).reduce((a, b) => a + b, 0)}
            </span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
