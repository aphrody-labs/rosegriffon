export const dynamic = "force-dynamic";

import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CommonSpriteIcon } from "@/components/ui/CommonSpriteIcon";
import type { SpriteCommonKey } from "@/config/sprites-common";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Hyper Techniques - Azalée",
  description: "Explorez les Esprits Guerriers, Totems, Miximax et autres pouvoirs spéciaux.",
};

const CATEGORIES = [
  {
    id: "esprits-guerriers",
    title: "Esprits Guerriers",
    description: "Invocations puissantes qui combattent aux côtés des joueurs.",
    icon: "swords",
    sprite: "keshin" as SpriteCommonKey,
    color: "bg-amber-500/10 text-amber-600",
  },
  {
    id: "totems",
    title: "Totems",
    description: "La transformation de l'âme du joueur en créature.",
    icon: "pets",
    sprite: "soul" as SpriteCommonKey,
    color: "bg-emerald-500/10 text-emerald-600",
  },
  {
    id: "miximax",
    title: "Miximax",
    description: "Fusion de l'aura de deux êtres pour décupler la puissance.",
    icon: "group_add",
    sprite: "miximax" as SpriteCommonKey,
    color: "bg-pink-500/10 text-pink-600",
  },
  {
    id: "eveil",
    title: "Éveil",
    description: "Libération du potentiel caché d'un joueur.",
    icon: "bolt",
    sprite: "eveil" as SpriteCommonKey,
    color: "bg-blue-500/10 text-blue-600",
  },
  {
    id: "changement-mode",
    title: "Changement de Mode",
    description: "Altération tactique des capacités en cours de match.",
    icon: "change_circle",
    sprite: "mode_change" as SpriteCommonKey,
    color: "bg-purple-500/10 text-purple-600",
  },
];

export default function AuraHubPage() {
  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="type-headline-small text-on-surface">Hyper Techniques</h1>
        <p className="type-body-medium text-on-surface-variant mt-1">
          Les pouvoirs spéciaux d&apos;Inazuma Eleven: Victory Road.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {CATEGORIES.map((cat) => (
          <Link
            key={cat.id}
            href={`/aura/${cat.id}`}
            className="group flex items-center gap-4 p-4 rounded-2xl bg-surface-container border border-outline-variant/20 hover:border-primary/40 hover:bg-surface-container-high transition-all duration-200 active:scale-[0.98]"
          >
            <div
              className={cn(
                "size-14 rounded-2xl flex items-center justify-center shrink-0",
                cat.color,
              )}
            >
              <CommonSpriteIcon name={cat.sprite} scale={0.6} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="type-title-medium text-on-surface group-hover:text-primary transition-colors">
                {cat.title}
              </h2>
              <p className="type-body-small text-on-surface-variant line-clamp-2">
                {cat.description}
              </p>
            </div>
            <ChevronRight
              size={20}
              className="text-on-surface-variant/40 group-hover:text-primary/60 transition-colors shrink-0"
              aria-hidden="true"
            />
          </Link>
        ))}
      </div>
    </div>
  );
}
