/**
 * Shared search UI configuration
 *
 * Single source of truth for type labels, icons, and badge styles
 * used by both GlobalSearch (Cmd+K dialog) and SearchClient (full-page search).
 */

/** Singular labels — used in result subtitles */
export const TYPE_LABELS: Record<string, string> = {
  basara: "BASARA",
  character: "Personnage",
  skill: "Technique",
  keshin: "Esprit Guerrier",
  soul: "Totem",
  miximax: "Miximax",
  awakening: "Éveil",
  modechange: "Changement Mode",
  aura: "Aura",
  passive: "Talent",
  tactic: "Tactique",
  item: "Objet",
  team: "Équipe",
  article: "Actualité",
  patchnote: "Patch Note",
};

/** Plural labels — used in group headings */
export const TYPE_LABELS_PLURAL: Record<string, string> = {
  basara: "Joueurs BASARA",
  character: "Personnages",
  skill: "Techniques",
  keshin: "Esprits Guerriers",
  soul: "Totems",
  miximax: "Miximax",
  awakening: "Éveils",
  modechange: "Changements de Mode",
  aura: "Auras",
  passive: "Talents",
  tactic: "Tactiques",
  item: "Objets",
  team: "Équipes",
  article: "Actualités",
  patchnote: "Patch Notes",
};

/** Language badge colors (Material Design 3 tokens) */
export const LANG_BADGE_STYLES: Record<string, string> = {
  FR: "bg-[var(--md-sys-color-tertiary-container)] text-[var(--md-sys-color-on-tertiary-container)]",
  EN: "bg-[var(--md-sys-color-secondary-container)] text-[var(--md-sys-color-on-secondary-container)]",
  JP: "bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)]",
};
