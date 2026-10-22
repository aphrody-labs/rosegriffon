// SPDX-License-Identifier: Apache-2.0
/**
 * Lignes de documentation des méthodes d'`AchilleaClient`, relevées dans les
 * sources du paquet `@rosegriffon/achillea-client`.
 *
 * Importé comme MACRO (`with { type: "macro" }`) : la fonction s'exécute au
 * moment du bundle ou de la transpilation, et le binaire compilé n'embarque
 * que la table qu'elle rend — il n'a plus accès aux sources `.ts` à l'exécution.
 *
 * Clé : `<propriété du client>.<méthode>` (`clans.kickMember`). Valeur : la
 * première ligne utile du bloc JSDoc qui précède la méthode.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Table propriété → classe, lue dans `client.ts` (`this.clans = new ClansResource(...)`). */
export function proprietesDuClient(sourceClient: string): Record<string, string> {
  const table: Record<string, string> = {};
  for (const [, propriete, classe] of sourceClient.matchAll(/this\.(\w+)\s*=\s*new\s+(\w+Resource)\(/gu)) {
    if (propriete && classe) table[classe] = propriete;
  }
  return table;
}

/** Docs `Classe.méthode` d'un fichier source de ressource. */
export function docsDuSource(source: string): Record<string, string> {
  const docs: Record<string, string> = {};
  const classes = [...source.matchAll(/export\s+class\s+(\w+Resource)\b/gu)];
  for (const [rang, correspondance] of classes.entries()) {
    const classe = correspondance[1];
    const debut = correspondance.index ?? 0;
    const fin = classes[rang + 1]?.index ?? source.length;
    const corps = source.slice(debut, fin);
    for (const [, bloc, methode] of corps.matchAll(/\/\*\*([\s\S]*?)\*\/\s*\n\s*(?:async\s+)?(\w+)\s*[(<]/gu)) {
      if (!bloc || !methode || !classe) continue;
      const ligne = bloc
        .split("\n")
        .map(l => l.replace(/^\s*\*?\s?/u, "").trim())
        .find(l => l !== "");
      if (ligne) docs[`${classe}.${methode}`] = ligne;
    }
  }
  return docs;
}

/** MACRO : table `ressource.méthode` → ligne de doc. */
export function docsClientAchillea(): Record<string, string> {
  const dossier = join(import.meta.dir, "../../../packages/achillea-client/src/v1");
  let fichiers: string[];
  try {
    fichiers = readdirSync(dossier).filter(f => f.endsWith(".ts") && !f.endsWith(".test.ts"));
  } catch {
    return {};
  }
  const proprietes = proprietesDuClient(readFileSync(join(dossier, "client.ts"), "utf8"));
  const docs: Record<string, string> = {};
  for (const fichier of fichiers) {
    for (const [cle, ligne] of Object.entries(docsDuSource(readFileSync(join(dossier, fichier), "utf8")))) {
      const [classe, methode] = cle.split(".");
      const propriete = classe ? proprietes[classe] : undefined;
      if (propriete && methode) docs[`${propriete}.${methode}`] = ligne;
    }
  }
  return docs;
}
