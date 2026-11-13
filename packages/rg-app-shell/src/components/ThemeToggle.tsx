"use client";

import { Check, Moon, SlidersHorizontal } from "lucide-react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useState, useSyncExternalStore } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  THEMES,
  type ThemeType,
} from "@rosegriffon/ui";

import { domaineDeLaRoute } from "../config/navigation";
import { ThemeTuner } from "./ThemeTuner";

export interface ThemeOption {
  id: ThemeType;
  label: string;
  icon?: typeof Moon;
  image?: string;
}

/**
 * Les cinq thèmes officiels partagent le même sélecteur dans le chrome.
 */
export const DEFAULT_THEMES: ThemeOption[] = [
  {
    id: "roy",
    image: THEMES.roy.icon,
    label: "Roy",
  },
  {
    id: "gaelle",
    image: THEMES.gaelle.icon,
    label: "Gaëlle",
  },
  {
    id: "azalee-light",
    image: THEMES["azalee-light"].icon,
    label: "Azalée clair",
  },
  {
    id: "azalee-dark",
    image: THEMES["azalee-dark"].icon,
    label: "Azalée sombre",
  },
  {
    id: "achillea",
    image: THEMES.achillea.icon,
    label: "Achilléa",
  },
];

export function ThemeToggle({
  themes = DEFAULT_THEMES,
  className,
}: {
  themes?: ThemeOption[];
  className?: string;
}) {
  const { setTheme, theme } = useTheme();
  const chemin = usePathname() ?? "/";
  const [reglageOuvert, setReglageOuvert] = useState(false);
  const mounted = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );

  if (!mounted) {
    return (
      <div
        className={`size-12 md:size-10 rounded-full flex items-center justify-center text-on-surface-variant/20 ${className ?? ""}`}
      >
        <Moon className="size-6 md:size-5" aria-hidden="true" />
      </div>
    );
  }

  const active = themes.find((entry) => entry.id === theme) ?? themes[0]!;
  // Le wiki et l’e-sport imposent leur thème à la zone de contenu : les
  // réglages y restent sans effet visible, il faut le dire dans le dialogue.
  const sectionImposee = domaineDeLaRoute(chemin) !== "association";
  const ActiveIcon = active.icon;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={`relative size-12 md:size-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-on-surface/[0.08] active:bg-on-surface/[0.12] transition-all duration-300 ${className ?? ""}`}
            aria-label="Changer de thème"
            title={active.label}
          >
            {ActiveIcon ? (
              <ActiveIcon aria-hidden="true" />
            ) : active.image ? (
              <Image
                src={active.image}
                alt=""
                width={24}
                height={24}
                unoptimized
                className="object-contain"
              />
            ) : (
              <Moon aria-hidden="true" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {themes.map((entry) => {
            const Icon = entry.icon;
            return (
              <DropdownMenuItem
                key={entry.id}
                onSelect={() => setTheme(entry.id)}
                className="gap-2.5"
                aria-current={entry.id === active.id ? "true" : undefined}
              >
                {Icon ? (
                  <Icon data-icon="inline-start" aria-hidden="true" />
                ) : entry.image ? (
                  <Image
                    src={entry.image}
                    alt=""
                    width={20}
                    height={20}
                    unoptimized
                    className="shrink-0 object-contain"
                  />
                ) : (
                  <Moon data-icon="inline-start" aria-hidden="true" />
                )}
                <span className="flex-1 truncate">{entry.label}</span>
                {entry.id === active.id && (
                  <Check
                    data-icon="inline-end"
                    className="opacity-70"
                    aria-hidden="true"
                  />
                )}
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => setReglageOuvert(true)}
            className="gap-2.5"
          >
            <SlidersHorizontal data-icon="inline-start" aria-hidden="true" />
            <span className="flex-1 truncate">Ajuster les couleurs…</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={reglageOuvert} onOpenChange={setReglageOuvert}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Couleurs du thème {active.label}</DialogTitle>
            <DialogDescription>
              Réglages enregistrés sur cet appareil, pour ce thème uniquement.
            </DialogDescription>
            {sectionImposee && (
              <p className="text-sm text-on-surface-variant">
                Cette section garde ses propres couleurs : vos réglages
                s’appliquent au reste du site.
              </p>
            )}
          </DialogHeader>
          <ThemeTuner key={active.id} themeId={active.id} />
        </DialogContent>
      </Dialog>
    </>
  );
}

export default ThemeToggle;

function subscribeNever(): () => void {
  return () => {};
}
