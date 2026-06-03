# IECODE — Inazuma Eleven Victory Road Toolkit

IECODE est une suite d'outils pour le reverse engineering, l'extraction de données et le
modding d'**Inazuma Eleven: Victory Road** (IEVR). Il télécharge le jeu depuis Steam
**nativement** (sans `steamcmd`), extrait les archives `.cpk`, parse les formats
propriétaires de Level-5 et expose tout via une API headless.

Le projet est un **monorepo cross-platform** : un cœur **C# .NET 10** (`src/IECODE.{Core,CLI}`)
ponté vers **Bun** via [node-api-dotnet](https://github.com/microsoft/node-api-dotnet),
orchestré par Turbo + Bun workspaces.

---

## Prérequis

- **[.NET 10 SDK](https://dotnet.microsoft.com/download)** — cœur C# + CLI `iecode`.
- **[Bun](https://bun.sh) ≥ 1.4** — runtime/PM/test des workspaces (pas de `node`/`npm`).
- Un **compte Steam** possédant IEVR (app id **`2799860`**) pour télécharger les données.

```bash
git clone <repo> && cd iecode
bun install
bun run dotnet:build        # solution C# (Release)
bun run build               # workspaces TS (turbo)
```

> Sur clone neuf, le pont node-api-dotnet exige `dotnet pack` du submodule avant
> `bun install` (le `file:` dep pointe sur son `out/pkg`). Voir `CLAUDE.md`.

---

## Workspaces

| Package | Chemin | Rôle |
|---|---|---|
| `@rose-griffon/iecode-core` | `packages/core` | Pont Bun ↔ `IECODE.Core` .NET (expose 21 namespaces) |
| `@rose-griffon/iecode-config` | `packages/config` | Presets tsconfig + oxlint partagés |
| `@rose-griffon/iecode-inagle` | `packages/inagle` | Accès Bun au parsing IEVR riche (`@rose-griffon/inagle`) |
| `@rose-griffon/iecode-steam-sync` | `packages/steam-sync` | Scraper store (bxc) + synchro native download/dump |
| `@rose-griffon/iecode-pipeline` | `packages/pipeline` | Flow headless unifié, auto-update par buildid Steam |

---

## Automatisation Steam (native, sans steamcmd)

Le téléchargement et l'extraction sont **100 % natifs** : `IECODE.Core/Steam/Content/`
(SteamKit2) parle directement aux serveurs Steam — login CM, 2FA, manifests, chunks CDN,
déchiffrement des depots — sans dépendre de `steamcmd`.

```bash
# 1. Télécharger le jeu (1er login : STEAM_GUARD_CODE requis, puis token caché)
iecode download 2799860 -o ~/.local/share/Steam/iecode/inazuma

iecode download 2799860 --list      # inspecter depots/manifests/tailles sans télécharger
iecode steam-build 2799860          # buildid Steam courant (signal d'auto-update)

# 2. Extraire les CPK (extraction sélective : presets inagle / azalee)
iecode dump  --preset inagle-azalee -o ~/.local/share/iecode/dump

# download + dump en une commande (--app défaut IEVR, -o requis)
iecode sync  -o ~/.local/share/iecode/dump --preset inagle-azalee
```

**Endpoints contactés** (3 tiers, tout en TLS/chiffré) :

| Service | Host | Port | Rôle |
|---|---|---|---|
| WebAPI Directory | `api.steampowered.com` (Akamai) | 443 | bootstrap → liste des CM |
| CM | `*.valve.net` | 27017 | auth, PICS, manifest codes, depot keys |
| CDN SteamPipe | `cache*.steamcontent.com` (edge géo) | 443 | manifests + chunks |

Identifiants via `.secrets/steam.env` (gitignoré) ou env `STEAM_USER` / `STEAM_PASSWORD` /
`STEAM_GUARD_CODE`. Le refresh token est mis en cache (`--token-store`,
défaut `~/.local/share/iecode/steam-tokens.json`) → runs suivants non-interactifs.

---

## Flow data headless (`@rose-griffon/iecode-pipeline`)

Unifie l'acquisition (download + dump) et le parsing (inagle, ~50 `cfg.bin`, 6000+ persos /
2900+ skills), **gardé par le buildid Steam** pour l'auto-update.

```bash
bun run data:accumulate -- --out ./corpus   # check build → download+dump si update → corpus
bun run data:export     -- --data ~/data --out ./corpus   # corpus depuis données existantes
bun run data:serve      -- --data ~/data    # API HTTP inagle headless (Bun.serve)
```

`exportCorpus()` fige tous les domaines inagle en `<domaine>.json` + `corpus.json`
(compte/build). `.build-snapshot.json` mémorise le buildid pour l'idempotence.

---

## Développement

```bash
bun run build | dev | lint | type-check | test | clean | format   # via turbo
bun run dotnet:build      # solution C# (Release)
bun run dotnet:test       # tests xUnit C# (séparés de turbo test)
bun run napi:build        # dotnet pack node-api-dotnet → out/pkg
bun --filter @rose-griffon/iecode-core gen:types   # régénère les typedefs du pont
```

- **Lint/format** : `oxlint` (`.oxlintrc.json`) + `oxfmt` (`.oxfmtrc.json`).
- **Tests** : `bun test` natif (TS) + `dotnet test` (C#).
- **Versions** : la `catalog:` du `package.json` racine est la source de vérité ;
  deps internes en `workspace:*`.

---

## Documentation

- [**Profil VPS & réglages**](./docs/vps.md) — matériel réel, défauts auto-ajustés
  (`HostProfile`), overrides `IECODE_PARALLELISM` / `IECODE_IO_BUFFER`, audit réseau Steam.

---

## License

Distribué sous licence MIT. Voir `LICENSE`.

_Made with for the Inazuma Eleven community._
