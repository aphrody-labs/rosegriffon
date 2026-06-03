# @rose-griffon/iecode-pipeline

Flow IEVR **headless unifié** — relie l'acquisition et le parsing en une chaîne auto-actualisée :

```
acquire (@rose-griffon/iecode-steam-sync)        parse + serve (@rose-griffon/iecode-inagle)
  download Steam natif + dump CPK  →  API données jeu complète + serveur HTTP
            └──────────── gardé par le buildid Steam ────────────┘
```

## API

```ts
import { accumulate, serve, exportCorpus, getRemoteBuildId } from "@rose-griffon/iecode-pipeline";

// Accumulation auto-actualisée : ne (re)télécharge/extrait que si le jeu a changé,
// puis exporte le corpus complet (tous les domaines inagle) en JSON versionné.
await accumulate({ corpusOut: "~/iecode-corpus" }); // creds via env STEAM_*

// Export du corpus depuis des données déjà extraites (sans Steam).
await exportCorpus({ dataPath: "~/iecode-dump", outDir: "~/iecode-corpus" });

// Serveur HTTP inagle headless (REST + OpenAPI + images).
const s = await serve({ dataPath: "~/iecode-dump", port: 3000 });

// Détection de mise à jour seule.
const buildId = await getRemoteBuildId(2799860);
```

## CLI (`iecode-data`)

```bash
iecode-data accumulate --out ~/iecode-corpus     # check build → download+dump → corpus
iecode-data export --data ~/data --out ~/corpus  # corpus depuis données existantes
iecode-data serve --data ~/data --port 3000      # API HTTP inagle headless
iecode-data version 2799860                      # buildid Steam courant
```

Scripts racine : `bun run data:accumulate -- --out ~/iecode-corpus`, `data:serve`, `data:export`.

## Fonctionnement

- **Auto-update** : `accumulate()` lit le `buildid` Steam (via `iecode steam-build`, login + app info, sans téléchargement) et le compare à `.build-snapshot.json`. Si inchangé → no-op. Sinon → download + dump + ré-export.
- **Corpus** : `exportCorpus()` laisse **inagle** (parsing complet de ~50 fichiers cfg.bin) produire les données et fige chaque domaine (characters, skills, auras, passives, basara, items, capsules, gallery, teams, formations, uniforms, series, quests, drops, + parsers) en `<domaine>.json` + `corpus.json` (manifeste : compte par domaine, buildId, total).
- **Headless** : aucune UI, tout en CLI/Bun ; le serveur via `Bun.serve`.

Identifiants Steam : `.secrets/steam.env` (`STEAM_USER`/`STEAM_PASSWORD`) + `STEAM_GUARD_CODE` au 1er login.
