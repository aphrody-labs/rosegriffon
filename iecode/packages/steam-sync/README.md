# @rose-griffon/iecode-steam-sync

Sync IEVR depuis Steam, en deux briques :

1. **Scraper store dédié** — bâti sur le package [`@aphrody-code/bxc`](https://github.com/aphrody-code/bxc) (profil `http`, TLS-fingerprinté). Agrège l'API officielle `appdetails` + le HTML de la page store (tags communautaires, évaluations), avec bypass de l'age-gate.
2. **Synchro native** — `download` + extraction CPK (`dump`) via le CLI `iecode` (issu de `@rose-griffon/iecode-core` / SteamKit2). **Aucun `steamcmd`.**

## API

```ts
import { scrapeApp, syncApp } from "@rose-griffon/iecode-steam-sync";

// Métadonnées store (réseau via bxc)
const meta = await scrapeApp(2799860);
//  → { name, type, price, releaseDate, developers, genres, tags, platforms, … }

// Pipeline complet (scrape + download natif + dump sélectif)
await syncApp({
  dumpOut: "~/iecode-dump",
  preset: "inagle-azalee",
  tokenStore: "~/.local/share/iecode/steam-tokens.json",
});
// Identifiants : options.user/password/guardCode ou env STEAM_USER / STEAM_PASSWORD / STEAM_GUARD_CODE
```

Sous-exports : `@rose-griffon/iecode-steam-sync/scraper` (scraper seul, parsers purs), `@rose-griffon/iecode-steam-sync/sync`.

## CLI

```bash
bun steam-sync                      # scrape IEVR → résumé lisible
bun steam-sync 2799860 --json       # métadonnées JSON sur stdout
bun steam-sync --list               # inspecte depots/manifests/tailles (login, sans download)
bun steam-sync --out ~/iecode-dump  # scrape + download + dump (creds via env STEAM_*)
```

Depuis la racine : `bun run scrape`, `bun run steam:depots`, `bun run steam:sync -- --out ~/iecode-dump`.

## Notes

- Le chemin du CLI `iecode` est dérivé de l'assembly exporté par `@rose-griffon/iecode-core` (build cohérent). Construit à la volée si absent.
- 1er login : `STEAM_GUARD_CODE` requis (2FA) ; le refresh token est ensuite mis en cache (`--token-store`) → runs suivants non-interactifs.
- Le scraper parse en regex légères (zéro dépendance DOM) ; les helpers (`parseStoreTags`, `parseReviewSummary`, …) sont exportés et testés.
