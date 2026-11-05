"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { domaineDeLaRoute } from "@rosegriffon/app-shell";
import { sectionTheme, THEME_PACKS, type ThemeType, useTheme } from "@rosegriffon/ui";

/**
 * Fond d’écran du thème effectif (thème de section, sinon celui de
 * l'utilisateur). Publie `--theme-wallpaper` sur `<html>` ; la zone de
 * contenu (`main[data-slot=sidebar-inset]`, voir globals.css) le superpose
 * sous un voile de sa propre couleur de surface, ce qui garde le contraste
 * du texte.
 *
 * La variable n'est posée qu'une fois le navigateur inactif après le
 * chargement : une grande image peinte tôt deviendrait l'élément LCP. Rien
 * n'est chargé quand l'utilisateur demande moins de données.
 */
export function ThemeBackdrop() {
  const chemin = usePathname() || "/";
  const { theme } = useTheme();
  const [pret, setPret] = useState(false);

  useEffect(() => {
    if (matchMedia("(prefers-reduced-data: reduce)").matches) return;
    const demarrer = () => setPret(true);
    if (document.readyState === "complete") {
      const id = requestIdleCallback(demarrer, { timeout: 3000 });
      return () => cancelIdleCallback(id);
    }
    const auChargement = () => requestIdleCallback(demarrer, { timeout: 3000 });
    addEventListener("load", auChargement, { once: true });
    return () => removeEventListener("load", auChargement);
  }, []);

  const pack = THEME_PACKS[sectionTheme(domaineDeLaRoute(chemin)) ?? (theme as ThemeType)] ?? THEME_PACKS.roy;

  // Une règle rendue par React plutôt qu'un style posé à la main sur <html> :
  // d'autres modules réécrivent le style en ligne de <html> (réglages de
  // thème), ce qui effaçait la variable.
  if (!pret) return null;
  return <style>{`:root{--theme-wallpaper:url("${pack.wallpaper}")}`}</style>;
}
