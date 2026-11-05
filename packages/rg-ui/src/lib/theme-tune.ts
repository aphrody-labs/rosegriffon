/**
 * Réglage des couleurs par l'utilisateur, à l'exécution.
 *
 * Les réglages (rotation de teinte, chroma, contraste) sont enregistrés par
 * thème dans `localStorage["rg-theme-tune"]`, AVEC la table des rôles déjà
 * calculée : `{ [themeId]: { a: réglages, v: { "--md-sys-color-x": "#hex" } } }`.
 * Le script anti-scintillement de `apps/rg-website/src/app/layout.tsx` n'a donc
 * qu'à recopier `v` en propriétés inline sur `<html>` avant la première
 * peinture, sans embarquer le moteur.
 *
 * Module pur côté import (aucun accès DOM au chargement) : le stockage et la
 * racine sont injectables pour les tests.
 */
import type { ThemeId } from "@rosegriffon/preferences";

import {
  clampAdjustments,
  computeRoles,
  DEFAULT_ADJUSTMENTS,
  ROLE_NAMES,
  ROLE_PREFIX,
  roleVariables,
  type ThemeAdjustments,
} from "./color-engine";
import { THEME_PACKS } from "./themes";

export const TUNE_STORAGE_KEY = "rg-theme-tune";

export interface StoredTune {
  a: ThemeAdjustments;
  v: Record<string, string>;
}

export type TuneStore = Partial<Record<ThemeId, StoredTune>>;

interface Contexte {
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;
  root?: { classList: { contains(c: string): boolean }; style: Pick<CSSStyleDeclaration, "setProperty" | "removeProperty"> } | null;
}

function stockage(ctx?: Contexte) {
  if (ctx?.storage !== undefined) return ctx.storage;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function racine(ctx?: Contexte) {
  if (ctx?.root !== undefined) return ctx.root;
  return typeof document === "undefined" ? null : document.documentElement;
}

const estTheme = (id: string): id is ThemeId => Object.hasOwn(THEME_PACKS, id);

export function readTuneStore(ctx?: Contexte): TuneStore {
  try {
    const brut = JSON.parse(stockage(ctx)?.getItem(TUNE_STORAGE_KEY) ?? "{}") as unknown;
    if (!brut || typeof brut !== "object") return {};
    const sortie: TuneStore = {};
    for (const [id, valeur] of Object.entries(brut as Record<string, unknown>)) {
      if (!estTheme(id) || !valeur || typeof valeur !== "object") continue;
      const a = clampAdjustments((valeur as { a?: Partial<ThemeAdjustments> }).a);
      // `v` est recalculé plutôt que relu : une valeur stockée ne peut pas
      // injecter autre chose qu'une couleur du moteur.
      sortie[id] = { a, v: roleVariables(computeRoles(THEME_PACKS[id].seed, a)) };
    }
    return sortie;
  } catch {
    return {};
  }
}

export function isDefaultAdjustments(adj: ThemeAdjustments): boolean {
  return (
    adj.hueShift === DEFAULT_ADJUSTMENTS.hueShift &&
    adj.chroma === DEFAULT_ADJUSTMENTS.chroma &&
    adj.contrast === DEFAULT_ADJUSTMENTS.contrast
  );
}

export function getThemeTune(id: ThemeId, ctx?: Contexte): ThemeAdjustments {
  return readTuneStore(ctx)[id]?.a ?? { ...DEFAULT_ADJUSTMENTS };
}

const auditeurs = new Set<() => void>();

/** Abonnement pour `useSyncExternalStore` (changements locaux et autres onglets). */
export function subscribeThemeTune(rappel: () => void): () => void {
  auditeurs.add(rappel);
  const surStockage = (e: StorageEvent) => {
    if (e.key === TUNE_STORAGE_KEY) rappel();
  };
  if (typeof window !== "undefined") window.addEventListener("storage", surStockage);
  return () => {
    auditeurs.delete(rappel);
    if (typeof window !== "undefined") window.removeEventListener("storage", surStockage);
  };
}

/** Enregistre (ou efface, s'ils sont neutres) les réglages d'un thème, puis les applique. */
export function setThemeTune(id: ThemeId, adjustments: Partial<ThemeAdjustments>, ctx?: Contexte): StoredTune | null {
  const a = clampAdjustments(adjustments);
  const store = readTuneStore(ctx);
  const entree = isDefaultAdjustments(a) ? null : { a, v: roleVariables(computeRoles(THEME_PACKS[id].seed, a)) };
  if (entree) store[id] = entree;
  else delete store[id];
  try {
    const s = stockage(ctx);
    if (Object.keys(store).length === 0) s?.removeItem(TUNE_STORAGE_KEY);
    else s?.setItem(TUNE_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Stockage plein ou interdit : le réglage vaut pour la session.
  }
  const r = racine(ctx);
  if (r?.classList.contains(id)) appliquer(r, entree);
  for (const rappel of auditeurs) rappel();
  return entree;
}

export function resetThemeTune(id: ThemeId, ctx?: Contexte): void {
  setThemeTune(id, DEFAULT_ADJUSTMENTS, ctx);
}

function appliquer(r: NonNullable<Contexte["root"]>, entree: StoredTune | null | undefined) {
  for (const role of ROLE_NAMES) r.style.removeProperty(`${ROLE_PREFIX}${role}`);
  if (entree) for (const [nom, valeur] of Object.entries(entree.v)) r.style.setProperty(nom, valeur);
}

/** Pose sur `<html>` les rôles réglés du thème actif (ou retire ceux d'un thème précédent). */
export function applyThemeTune(id: string | undefined, ctx?: Contexte): void {
  const r = racine(ctx);
  if (!r) return;
  appliquer(r, id && estTheme(id) ? readTuneStore(ctx)[id] : null);
}

/**
 * Fragment du script anti-scintillement : `t` est l'identifiant du thème
 * retenu, `d` la racine. Recopie les rôles précalculés, sans moteur.
 */
export const TUNE_BOOT_SNIPPET = `var u=JSON.parse(localStorage.getItem('${TUNE_STORAGE_KEY}')||'{}')[t];if(u&&u.v){for(var k in u.v){if(k.indexOf('${ROLE_PREFIX}')===0&&/^#[0-9a-f]{6}$/.test(u.v[k]))d.style.setProperty(k,u.v[k]);}}`;
