"use client";

import { useId, useState } from "react";
import {
  Button,
  DEFAULT_ADJUSTMENTS,
  getThemeTune,
  isDefaultAdjustments,
  resetThemeTune,
  setThemeTune,
  type ThemeAdjustments,
  type ThemeType,
} from "@rosegriffon/ui";

interface Curseur {
  cle: keyof ThemeAdjustments;
  libelle: string;
  aide: string;
  min: number;
  max: number;
  pas: number;
  format: (v: number) => string;
}

const signe = (v: number) => (v > 0 ? "+" : v < 0 ? "−" : "");

export const CURSEURS: readonly Curseur[] = [
  {
    cle: "hueShift",
    libelle: "Teinte",
    aide: "Fait tourner la couleur principale sur le cercle chromatique.",
    min: -180,
    max: 180,
    pas: 1,
    format: (v) => `${signe(v)}${Math.abs(v)}°`,
  },
  {
    cle: "chroma",
    libelle: "Saturation",
    aide: "Intensité des couleurs, de gris (0 %) à vive (200 %).",
    min: 0,
    max: 2,
    pas: 0.05,
    format: (v) => `${Math.round(v * 100)} %`,
  },
  {
    cle: "contrast",
    libelle: "Contraste",
    aide: "Écart entre textes et fonds ; le minimum reste 4,5:1.",
    min: -1,
    max: 1,
    pas: 0.1,
    format: (v) =>
      Math.abs(v) < 1e-9
        ? "Standard"
        : `${signe(v)}${Math.round(Math.abs(v) * 100)} %`,
  },
];

/**
 * Réglage des couleurs du thème actif : trois curseurs natifs (clavier :
 * flèches, Page préc./suiv., Début/Fin) et une remise à zéro. Chaque
 * changement recalcule les rôles et les pose sur `<html>`
 * (`@rosegriffon/ui` → `setThemeTune`), enregistrés dans `rg-theme-tune`.
 * À monter avec `key={themeId}` pour repartir des réglages du thème affiché.
 */
export function ThemeTuner({
  themeId,
  className,
}: {
  themeId: ThemeType;
  className?: string;
}) {
  const [reglages, setReglages] = useState<ThemeAdjustments>(() =>
    getThemeTune(themeId),
  );
  const id = useId();

  const changer = (cle: keyof ThemeAdjustments, valeur: number) => {
    const suivants = { ...reglages, [cle]: valeur };
    setReglages(suivants);
    setThemeTune(themeId, suivants);
  };

  const reinitialiser = () => {
    setReglages({ ...DEFAULT_ADJUSTMENTS });
    resetThemeTune(themeId);
  };

  return (
    <fieldset className={`flex flex-col gap-4 ${className ?? ""}`}>
      <legend className="sr-only">Réglage des couleurs du thème</legend>
      {CURSEURS.map((c) => {
        const valeur = reglages[c.cle];
        const champ = `${id}-${c.cle}`;
        return (
          <div key={c.cle} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <label
                htmlFor={champ}
                className="text-sm font-medium text-on-surface"
              >
                {c.libelle}
              </label>
              <output
                htmlFor={champ}
                className="text-sm tabular-nums text-on-surface-variant"
              >
                {c.format(valeur)}
              </output>
            </div>
            <input
              id={champ}
              type="range"
              min={c.min}
              max={c.max}
              step={c.pas}
              value={valeur}
              aria-valuetext={c.format(valeur)}
              aria-describedby={`${champ}-aide`}
              onChange={(e) => changer(c.cle, Number(e.currentTarget.value))}
              className="h-11 w-full cursor-pointer accent-primary"
            />
            <p id={`${champ}-aide`} className="text-xs text-on-surface-variant">
              {c.aide}
            </p>
          </div>
        );
      })}
      <Button
        type="button"
        variant="outline"
        onClick={reinitialiser}
        disabled={isDefaultAdjustments(reglages)}
        className="self-start"
      >
        Réinitialiser
      </Button>
    </fieldset>
  );
}

export default ThemeTuner;
