"use client";

import { CommonSpriteIcon } from "@/components/ui/CommonSpriteIcon";
import type { SpriteCommonKey } from "@/config/sprites-common";
import { cn } from "@/lib/utils";

// ── Types ──

export interface RarityValues {
  low: string;
  high: string;
}

export interface PlayerPassiveData {
  no: number;
  playstyle: string;
  requirement: string;
  stat: string;
  legendary: RarityValues;
  top: RarityValues;
  advanced: RarityValues;
  growing: RarityValues;
  common: RarityValues;
}

export interface CustomPassiveData {
  no: number;
  requirement: string;
  stat: string;
  buff: string;
}

export interface CoordinatorPassiveData {
  no: number;
  playstyle: string;
  requirement: string;
  stat: string;
  coordinatorCommon: string;
  coordinatorLegendary: string;
  managerCommon: string;
  managerLegendary: string;
}

// ── Translations ──

export const REQUIREMENT_FR: Record<string, string> = {
  "For players of the same element": "Joueurs du même élément",
  "For players of different elements": "Joueurs d'éléments différents",
  "For players of the same positions": "Joueurs de la même position",
  "For players of the same position": "Joueurs de la même position",
  "For players of different positions": "Joueurs de positions différentes",
  "For nearby players": "Joueurs à proximité",
  "When a player of the same element is nearby": "Joueur du même élément à proximité",
  "When a player of a different element is nearby": "Joueur d'élément différent à proximité",
  "On your half of the pitch": "Sur votre moitié de terrain",
  "On the opposition's half of the pitch": "Sur la moitié de terrain adverse",
  "When outside the zone": "Hors de la zone",
  "Non-Conditional": "Sans condition",
  "When tied or behind in goals": "Score à égalité ou en retard",
  "When at +15% or higher Breach Rate": "Taux de brèche +15% ou plus",
  "When at 15% of higher Breach Rate": "Taux de brèche +15% ou plus",
  "When opposition passes the ball out during Focus Battle":
    "L'adversaire passe le ballon lors d'un affrontement",
  "When winning a Focus or Scramble Battle": "En remportant un affrontement ou une mêlée",
  "When at 50% or higher tension": "Tension à 50% ou plus",
  "When at 50% of higher Tension": "Tension à 50% ou plus",
  "When at 100% Tension": "Tension à 100%",
  "On gaining possession (excluding catches) (15s)": "Récupération du ballon (hors arrêts) (15s)",
  "On gaining possession(excluding catches) (15s)": "Récupération du ballon (hors arrêts) (15s)",
  "When making a pass": "En faisant une passe",
  "When at 20% of more Bond Power": "Puissance de lien à 20% ou plus",
  "When at 20% or more Bond Power": "Puissance de lien à 20% ou plus",
  "When losing a Scramble": "En perdant une mêlée",
  "On Dash knockback": "Lors d'un plaquage en sprint",
  "When the opposition commits a foul": "Quand l'adversaire commet une faute",
  "Until you incur a foul": "Tant que vous ne commettez pas de faute",
  "After a substitution, for the player who comes on (15s)":
    "Après remplacement, joueur entrant (15s)",
  "Upon being subbed in (15s)": "Après remplacement (15s)",
  "For the first half": "En première mi-temps",
  "For the second half": "En seconde mi-temps",
};

export const STAT_FR: Record<string, string> = {
  "Shot AT": "ATT Tir",
  "Focus AT & DF": "ATT & DEF Affrontement",
  "Scramble AT & DF": "ATT & DEF Mêlée",
  "Castle Wall DF": "DEF Mur de défense",
  "Own Shot AT": "ATT Tir (perso)",
  "Own Focus AT & DF": "ATT & DEF Affrontement (perso)",
  "Own Scramble AT & DF": "ATT & DEF Mêlée (perso)",
  "Own Castle Wall DF": "DEF Mur de défense (perso)",
  "Own Castle Wall": "Mur de défense (perso)",
  "Team Focus AT & DF": "ATT & DEF Affrontement (équipe)",
  "Team Breach Rate": "Taux de brèche (équipe)",
  "Team Castle Wall Pierce Rate": "Taux de percée (équipe)",
  "Team Tension Breach Cost": "Coût tension brèche (équipe)",
  "Drain Tension": "Drain de tension",
  "Team Tension": "Tension (équipe)",
  "Team Shot AT": "ATT Tir (équipe)",
  "[MF] Focus AT & DF": "[MF] ATT & DEF Affrontement",
  "[DF] Focus AT & DF": "[DF] ATT & DEF Affrontement",
  "[KP] KP": "[GK] Gardien",
  "Team Rough Attack AT & DF": "ATT & DEF Assaut (équipe)",
  "Team Bond Power": "Puissance de lien (équipe)",
  "Team Scramble AT & DF": "ATT & DEF Mêlée (équipe)",
  "Team Direct Shot AT": "ATT Tir direct (équipe)",
  "Team Bond Power Loss": "Perte puissance de lien (équipe)",
  "Team Dash Foul Rate": "Taux faute sprint (équipe)",
  "Team Foul Rate": "Taux de faute (équipe)",
  "Team AT & DF": "ATT & DEF (équipe)",
  "Team AT": "ATT (équipe)",
  "Team DF": "DEF (équipe)",
  "Team Castle Wall DF": "DEF Mur de défense (équipe)",
  "[Substitute Player] AT": "[Remplaçant] ATT",
  "[Substitute Player] DF": "[Remplaçant] DEF",
  "Own Special Tactics Cooldown": "Cooldown Tactiques spé. (perso)",
};

export const PLAYSTYLE_FR: Record<string, string> = {
  Breach: "Brèche",
  Tension: "Tension",
  Counter: "Contre-attaque",
  Bond: "Lien",
  "Rough Play": "Jeu brutal",
  Justice: "Justice",
};

const PLAYSTYLE_SPRITES: Record<string, SpriteCommonKey> = {
  Breach: "breche",
  Tension: "tension",
  Counter: "contre",
  Bond: "lien",
  "Rough Play": "jeu_violent",
  Justice: "justice",
};

const PLAYSTYLE_COLORS: Record<string, string> = {
  Breach: "text-red-500",
  Tension: "text-amber-500",
  Counter: "text-blue-500",
  Bond: "text-pink-500",
  "Rough Play": "text-orange-500",
  Justice: "text-emerald-500",
};

const RARITY_COLORS: Record<string, string> = {
  legendary: "bg-amber-500/20 text-amber-600",
  top: "bg-purple-500/20 text-purple-600",
  advanced: "bg-blue-500/20 text-blue-600",
  growing: "bg-green-500/20 text-green-600",
  common: "bg-slate-500/20 text-slate-600",
};

const RARITY_LABELS: Record<string, string> = {
  legendary: "Normal",
  top: "Émérite",
  advanced: "Expérimenté",
  growing: "En progression",
  common: "Normal",
};

// ── Player Passive Card ──

export function PlayerPassiveCard({ passive }: { passive: PlayerPassiveData }) {
  const reqFr = REQUIREMENT_FR[passive.requirement] || passive.requirement;
  const statFr = STAT_FR[passive.stat] || passive.stat;
  const playstyleFr = PLAYSTYLE_FR[passive.playstyle] || null;
  const playstyleSprite = PLAYSTYLE_SPRITES[passive.playstyle] || null;
  const playstyleColor = PLAYSTYLE_COLORS[passive.playstyle] || "text-on-surface-variant";

  const rarities = [
    { key: "legendary", values: passive.legendary },
    { key: "top", values: passive.top },
    { key: "advanced", values: passive.advanced },
    { key: "growing", values: passive.growing },
    { key: "common", values: passive.common },
  ];

  return (
    <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low hover:bg-surface-container transition-colors p-4 space-y-3">
      {/* Header: stat + playstyle */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-bold text-sm text-on-surface leading-tight">{statFr}</h3>
          <p className="text-xs text-on-surface-variant mt-0.5">{reqFr}</p>
        </div>
        {playstyleFr && (
          <span
            className={cn(
              "inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-surface-container-highest",
              playstyleColor,
            )}
          >
            {playstyleSprite && <CommonSpriteIcon name={playstyleSprite} scale={0.2} />}
            {playstyleFr}
          </span>
        )}
      </div>

      {/* Rarity values grid */}
      <div className="space-y-1">
        {rarities.map(({ key, values }) => {
          if (!values.low && !values.high) return null;
          const display =
            values.low === values.high ? values.low : `${values.low} ~ ${values.high}`;
          return (
            <div key={key} className="flex items-center gap-2">
              <span
                className={cn(
                  "text-[10px] font-bold uppercase tracking-wider w-20 shrink-0 px-1.5 py-0.5 rounded text-center",
                  RARITY_COLORS[key],
                )}
              >
                {RARITY_LABELS[key]}
              </span>
              <span className="text-xs font-mono font-bold text-on-surface flex-1">{display}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Custom Passive Card ──

export function CustomPassiveCard({ passive }: { passive: CustomPassiveData }) {
  const reqFr = REQUIREMENT_FR[passive.requirement] || passive.requirement;
  const statFr = STAT_FR[passive.stat] || passive.stat;

  return (
    <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low hover:bg-surface-container transition-colors p-4 space-y-2">
      <div>
        <h3 className="font-bold text-sm text-on-surface leading-tight">{statFr}</h3>
        <p className="text-xs text-on-surface-variant mt-0.5">{reqFr}</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-tertiary/20 text-tertiary">
          Bonus
        </span>
        <span className="text-sm font-mono font-bold text-on-surface">{passive.buff}</span>
      </div>
    </div>
  );
}

// ── Coordinator Passive Card ──

export function CoordinatorPassiveCard({ passive }: { passive: CoordinatorPassiveData }) {
  const reqFr = REQUIREMENT_FR[passive.requirement] || passive.requirement;
  const statFr = STAT_FR[passive.stat] || passive.stat;
  const playstyleFr = PLAYSTYLE_FR[passive.playstyle] || null;
  const playstyleColor = PLAYSTYLE_COLORS[passive.playstyle] || "text-on-surface-variant";
  const playstyleSprite = PLAYSTYLE_SPRITES[passive.playstyle] || null;

  const roles = [
    {
      label: "Manager (L)",
      value: passive.managerLegendary,
      color: "bg-amber-500/20 text-amber-600",
    },
    { label: "Manager (C)", value: passive.managerCommon, color: "bg-slate-500/20 text-slate-600" },
    {
      label: "Coord. (L)",
      value: passive.coordinatorLegendary,
      color: "bg-purple-500/20 text-purple-600",
    },
    {
      label: "Coord. (C)",
      value: passive.coordinatorCommon,
      color: "bg-slate-500/20 text-slate-600",
    },
  ].filter((r) => r.value);

  return (
    <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low hover:bg-surface-container transition-colors p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-bold text-sm text-on-surface leading-tight">{statFr}</h3>
          <p className="text-xs text-on-surface-variant mt-0.5">{reqFr}</p>
        </div>
        {playstyleFr && (
          <span
            className={cn(
              "inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-surface-container-highest",
              playstyleColor,
            )}
          >
            {playstyleSprite && <CommonSpriteIcon name={playstyleSprite} scale={0.2} />}
            {playstyleFr}
          </span>
        )}
      </div>
      <div className="space-y-1">
        {roles.map(({ label, value, color }) => (
          <div key={label} className="flex items-center gap-2">
            <span
              className={cn(
                "text-[10px] font-bold uppercase tracking-wider w-20 shrink-0 px-1.5 py-0.5 rounded text-center",
                color,
              )}
            >
              {label}
            </span>
            <span className="text-xs font-mono font-bold text-on-surface">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
