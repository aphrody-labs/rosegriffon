/**
 * Couleurs qui sont des DONNÉES, pas des statuts.
 *
 * Les statuts et états d'Achilléa (succès, alerte, erreur, information)
 * passent par les jetons sémantiques de `@rosegriffon/ui` (`success`,
 * `warning`, `destructive`, `primary`…). Restent ici, et seulement ici, les
 * couleurs qui désignent une chose du monde réel et ne doivent pas suivre le
 * thème : les métaux du podium et les couleurs de marque des plateformes.
 * `src/app/achillea/palette.test.ts` refuse toute palette brute ailleurs.
 */

/** Or, argent, bronze : la couleur EST l'information (rang 1, 2, 3). */
export const MEDAILLE = {
  or: {
    pastille: "bg-amber-400 text-black",
    texte: "text-amber-400",
    survolTexte: "hover:text-amber-400",
    anneau: "ring-amber-400 shadow-amber-500/20",
    carte: "border-2 border-amber-500/80 bg-gradient-to-b from-amber-500/10 via-card to-card",
    encart: "bg-amber-500/10 border-amber-500/30 text-amber-400",
    encartDoux: "bg-amber-500/10 border border-amber-500/20",
  },
  argent: {
    pastille: "bg-slate-300 text-black",
    texte: "text-slate-300",
    anneau: "ring-slate-300",
    carte: "border border-slate-700/60 bg-gradient-to-b from-slate-800/40 to-card",
    encart: "bg-slate-400/10 border-slate-400/30 text-slate-300",
    encartDoux: "bg-slate-400/10 border border-slate-400/20",
  },
  bronze: {
    pastille: "bg-amber-700 text-white",
    pastilleClaire: "bg-amber-700 text-amber-100",
    texte: "text-amber-600",
    anneau: "ring-amber-700",
    carte: "border border-amber-800/60 bg-gradient-to-b from-amber-950/20 to-card",
    encart: "bg-amber-700/10 border-amber-700/30 text-amber-600",
    encartDoux: "bg-amber-700/10 border border-amber-700/20",
  },
} as const;

/** Couleurs de marque des plateformes liées (Twitch, YouTube). */
export const MARQUE = {
  twitch: "text-purple-400",
  twitchBouton: "text-purple-600 hover:text-purple-700",
  twitchPastille: "border-purple-500/30 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20",
  youtube: "text-red-500",
} as const;
