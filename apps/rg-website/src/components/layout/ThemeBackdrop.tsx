"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { domaineDeLaRoute } from "@rosegriffon/app-shell";
import {
  sectionTheme,
  THEME_PACKS,
  type ThemeType,
  useTheme,
} from "@rosegriffon/ui";

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
/**
 * Exécute `tache` en tâche de fond, avec détection de fonctionnalité :
 * `scheduler.postTask` (priorité `background`) quand il existe, sinon
 * `requestIdleCallback`, sinon un délai. Aucune de ces API n'est disponible
 * partout (Safari n'a pas `scheduler`, et n'a eu `requestIdleCallback` que
 * tard) ; les appeler sans test lèverait une exception dans l'effet.
 */
function planifierEnArrierePlan(tache: () => void) {
  const w = window as typeof window & {
    scheduler?: {
      postTask?: (
        cb: () => void,
        o: { priority: "background" },
      ) => Promise<unknown>;
    };
  };
  if (w.scheduler?.postTask) {
    void w.scheduler.postTask(tache, { priority: "background" });
  } else if ("requestIdleCallback" in w) {
    w.requestIdleCallback(tache, { timeout: 3000 });
  } else {
    setTimeout(tache, 1500);
  }
}

export function ThemeBackdrop() {
  const chemin = usePathname() || "/";
  const { theme } = useTheme();
  const [pret, setPret] = useState(false);

  useEffect(() => {
    if (matchMedia("(prefers-reduced-data: reduce)").matches) return;
    let annule = false;
    const demarrer = () => {
      if (!annule) setPret(true);
    };
    const enArrierePlan = () => planifierEnArrierePlan(demarrer);
    if (document.readyState === "complete") enArrierePlan();
    else addEventListener("load", enArrierePlan, { once: true });
    return () => {
      annule = true;
      removeEventListener("load", enArrierePlan);
    };
  }, []);

  const pack =
    THEME_PACKS[
      sectionTheme(domaineDeLaRoute(chemin)) ?? (theme as ThemeType)
    ] ?? THEME_PACKS.roy;

  // Une règle rendue par React plutôt qu'un style posé à la main sur <html> :
  // d'autres modules réécrivent le style en ligne de <html> (réglages de
  // thème), ce qui effaçait la variable.
  if (!pret) return null;
  return <style>{`:root{--theme-wallpaper:url("${pack.wallpaper}")}`}</style>;
}
