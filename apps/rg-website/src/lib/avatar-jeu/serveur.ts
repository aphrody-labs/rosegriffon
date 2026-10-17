import "server-only";

import { cdnOrigin } from "@rosegriffon/assets";
import { listCharacterFaceCodes } from "@rosegriffon/azalee/images";

import type { Catalogue } from "@/app/wiki/avatar/types";
import { getPgPool } from "@/lib/db/pg";

import { construireBanque, type LigneBanque, type PersonnageBanque } from "./banque";

export const CDN = cdnOrigin(process.env.NEXT_PUBLIC_CDN_ORIGIN);

const UNE_HEURE = 3_600_000;
let banque: { lue: number; items: PersonnageBanque[] } | null = null;

/**
 * La banque de personnages, lue en base une fois par heure et gardée en mémoire :
 * ~5 500 personnages, filtrés ensuite sans retour à la base.
 */
export async function lireBanque(): Promise<PersonnageBanque[]> {
  if (banque && Date.now() - banque.lue < UNE_HEURE) return banque.items;
  const { rows } = await getPgPool().query<LigneBanque>(
    `SELECT internal_code, name_fr, name_en, name_ja, series
       FROM inagle_characters
      WHERE internal_code ~ '^c[0-9]{8}'`,
  );
  banque = { lue: Date.now(), items: construireBanque(rows) };
  return banque.items;
}

let portraits: ReadonlySet<string> | null = null;
/** Codes de base qui ont réellement un portrait dans les CPK. */
export function codesAvecPortrait(): ReadonlySet<string> {
  portraits ??= new Set(listCharacterFaceCodes());
  return portraits;
}

/** Catalogue résolu de l'éditeur, relu au plus une fois par jour. `null` si la source est injoignable. */
export async function lireCatalogue(): Promise<Catalogue | null> {
  try {
    const reponse = await fetch(`${CDN}/avatar/catalog.json`, {
      next: { revalidate: 86_400 },
      signal: AbortSignal.timeout(8_000),
    });
    if (!reponse.ok) return null;
    return (await reponse.json()) as Catalogue;
  } catch {
    return null;
  }
}
