"use client";

import { Button } from "@rosegriffon/ui";
import Image from "next/image";

import { useTheme } from "@/contexts/theme-context";

const THEME_METADATA = {
  gaelle: {
    icon: "/emote/RG_Gaelle_salut.webp",
    name: "Gaëlle",
  },
  roy: {
    icon: "/emote/RG_Roy_salut.webp",
    name: "Roy",
  },
};

export function ThemeToggle() {
  const { theme, toggleTheme, mounted } = useTheme();

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="h-8 sm:h-9 md:h-10 w-8 sm:w-9 md:w-10"
        disabled
        aria-label="Chargement du thème"
      >
        <span className="sr-only">Chargement thème</span>
      </Button>
    );
  }

  const currentTheme = THEME_METADATA[theme as keyof typeof THEME_METADATA] ?? THEME_METADATA.roy;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className="h-8 sm:h-9 md:h-10 w-8 sm:w-9 md:w-10 relative overflow-hidden rounded-full hover:bg-sidebar-accent/20 transition-all duration-300 group"
      title={`Thème actuel : ${currentTheme.name} (Cliquer pour changer)`}
    >
      <div className="relative size-6 sm:h-7 sm:w-7 transition-transform duration-500 ease-in-out group-hover:rotate-12 group-active:rotate-180">
        <Image
          src={currentTheme.icon}
          alt={`Thème ${currentTheme.name}`}
          fill
          className="object-contain"
          priority
          unoptimized
        />
      </div>
      <span className="sr-only">Changer de thème</span>
    </Button>
  );
}