#!/usr/bin/env bun
// SPDX-License-Identifier: Apache-2.0
// Régénère `src/lib/i18n/fr-interface.json` : les clés d'interface de `public/locales/fr.json`
// (tout sauf les ~4 000 clés de texte de jeu `0x…`, 230 Ko que rien n'importe dans le site).
// C'est ce sous-ensemble que `LanguageProvider` embarque dans le JS de chaque page.
// À relancer après toute modification de fr.json : `bun scripts/locales-interface.ts`
// (le test `src/lib/i18n/fr-interface.test.ts` échoue tant que ce n'est pas fait).
import { join } from "node:path";

import { cleInterface } from "../src/lib/i18n/cles";

const racine = join(import.meta.dir, "..");
const complet = (await Bun.file(
  join(racine, "public/locales/fr.json"),
).json()) as Record<string, string>;
const interfaceSeule = Object.fromEntries(
  Object.entries(complet).filter(([cle]) => cleInterface(cle)),
);
await Bun.write(
  join(racine, "src/lib/i18n/fr-interface.json"),
  `${JSON.stringify(interfaceSeule, null, "\t")}\n`,
);
console.log(
  `fr-interface.json : ${Object.keys(interfaceSeule).length} clés sur ${Object.keys(complet).length}`,
);
