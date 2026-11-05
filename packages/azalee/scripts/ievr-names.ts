/** Fonctions pures de l’importeur de noms IEVR (testées dans test/ievr-names.test.ts). */

/** `0xab12` → `0xAB12` : forme des identifiants du miroir. */
export const normaliserId = (id: string) => `0x${id.replace(/^0x/i, "").toUpperCase()}`;

/** Retire le balisage de furigana du jeu : `[漢字/かんじ]` → `漢字`. */
export const sansFurigana = (texte: string) => texte.replace(/\[([^/\]]+)\/[^\]]*\]/g, "$1");

/** Classe l'écart entre le nom du miroir et celui du jeu, pour le rapport. */
export function classerEcart(miroir: string | null, jeu: string): "identique" | "vide" | "mot-double" | "surnom-colle" | "autre" {
  const m = (miroir ?? "").trim();
  if (m === jeu) return "identique";
  if (!m) return "vide";
  const mots = m.split(/\s+/);
  if (mots.length >= 2 && mots.at(-1) === mots.at(-2)) return "mot-double";
  if (m.startsWith(`${jeu} `)) return "surnom-colle";
  return "autre";
}
