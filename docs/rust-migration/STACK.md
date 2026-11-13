# Stack Rust

Versions relevées le 2026-11-12 (`cargo search` / `cargo info` sur le vps, `gh api`). Toolchain vps : cargo 1.101.0-nightly ; workspace : edition 2024, `rust-version` 1.95.

## UI

| Crate                                     | Version                                                                           | Usage                                         | Statut                                               |
| ----------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------- | ---------------------------------------------------- |
| `dioxus`                                  | 0.7.10 stable (0.8.0-alpha.3 en prérelease)                                       | UI unique web/desktop/mobile, SSR             | Retenu, utilisé dans `nie-pkg-ui`                    |
| `dioxus-ssr`                              | 0.7.10                                                                            | rendu statique, tests                         | Retenu                                               |
| `dioxus` feature `desktop`                | 0.7.10                                                                            | webview (wry) Windows/macOS/Linux             | Compilé sur le vps (webkit2gtk-4.1 présent)          |
| `dioxus` feature `native` / `blitz-dom`   | 0.7.10 / 0.2.4 (0.3.0-beta.4)                                                     | rendu natif sans webview                      | Bloqué : `image =0.25.6` contre 0.25.10 du workspace |
| `taffy`                                   | 0.15.1                                                                            | layout flex/grid (sous Dioxus native et GPUI) | Indirect                                             |
| `anyrender`                               | 0.14.0                                                                            | abstraction 2D (vello)                        | Indirect, à suivre                                   |
| `dioxus-components` (`dioxus-primitives`) | dépôt DioxusLabs/dioxus-components                                                | primitives accessibles non stylées            | Retenu pour la couche composants                     |
| `DioxusLabs/sdk`                          | dépôt                                                                             | stockage, géoloc, presse-papiers              | Au besoin                                            |
| `gpui`                                    | 0.2.2                                                                             | alternative desktop (Zed)                     | Non retenu par défaut (pas de web)                   |
| `gpui-fast`                               | 0.1.14                                                                            | fork GPUI mode retenu, -80 % CPU annoncé      | Candidat éditeur lourd                               |
| `gpui-component` (gpui-kit)               | 0.9.1                                                                             | 60+ composants GPUI                           | Candidat avec gpui-fast                              |
| longbridge `nsh`                          | dépôt longbridge/nsh (le crate `nsh` sur crates.io est un autre projet, un shell) | UI native multi-OS + web, écrans TSX          | Veille ; TSX contraire à l'objectif Rust pur         |

Dépôts vérifiés : `DioxusLabs/{dioxus,blitz,taffy,dioxus-components,sdk,anyrender,dioxus-icons,bedina,rustd}`, `longbridge/{nsh,gpui-fast,gpui-kit}`. `longbridge/gpui-component` redirige vers `longbridge/gpui-kit` (même dépôt). Aucune URL demandée n'était en 404.

## Cœur

| Crate       | Version             | Usage                  |
| ----------- | ------------------- | ---------------------- |
| `serde`     | 1.0.228 (workspace) | sérialisation          |
| `toml`      | 1.2.1               | manifestes et registre |
| `blake3`    | 1.8.7               | hachage des dumps      |
| `clap`      | 4 (workspace)       | CLI                    |
| `thiserror` | 2.0.21              | erreurs                |
| `wgpu`      | 30.0.1 (workspace)  | rendu NIE              |
| `vello`     | 0.11.0 (workspace)  | 2D vectoriel           |
| `bevy`      | 0.20.1 (workspace)  | runtime NIE            |
| `rusqlite`  | 0.40 (workspace)    | cache local            |

## À ajouter (phases suivantes, versions à figer au moment de l'ajout)

- `typify` (types Rust depuis JSON Schema), `reqwest` + `scraper` (`nie-crawl`), `minisign-verify` (registre signé), `tokio-postgres` déjà via `aphrody-nie-pg`.
