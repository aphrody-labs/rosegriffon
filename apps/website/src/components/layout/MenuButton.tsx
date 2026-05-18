"use client";

import { Button } from "@rg/ui";
import { useSidebar } from "@rg/ui";
import { Menu, X } from "@/lib/icons-config";

/**
 * Bouton menu pour ouvrir/fermer la sidebar sur mobile
 * Affiche une icône hamburger (menu) ou croix (close)
 */
export function MenuButton() {
  const { toggleSidebar, open, isMobile } = useSidebar();

  // Ne pas afficher sur desktop
  if (!isMobile) {
    return null;
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 sm:h-9 md:h-10 w-8 sm:w-9 md:w-10 md:hidden"
      onClick={toggleSidebar}
      aria-label={open ? "Fermer la navigation" : "Ouvrir la navigation"}
      aria-expanded={open}
      aria-controls="sidebar"
    >
      {open ? (
        <X className="h-4 sm:h-5 md:h-6 w-4 sm:w-5 md:w-6 transition-transform duration-300" />
      ) : (
        <Menu className="h-4 sm:h-5 md:h-6 w-4 sm:w-5 md:w-6 transition-transform duration-300" />
      )}
    </Button>
  );
}