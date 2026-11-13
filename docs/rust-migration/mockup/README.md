# Maquettes NIE (SVG, import Figma)

Frames 1440 x 900, une par fichier, couleurs = jetons `--jeu-*` de `crates/aphrody-nie-ui/src/color.rs` (voir `../DESIGN.md`).

| Fichier                 | Frame                                                                                    |
| ----------------------- | ---------------------------------------------------------------------------------------- |
| `01-main-shell.svg`     | Shell : barre latérale, barre supérieure, compteurs, récents                             |
| `02-library.svg`        | Bibliothèque / gestionnaire de paquets : une carte par jeu du registre, état d'install   |
| `03-feature-matrix.svg` | Matrice jeux x fonctionnalités, générée depuis `nie-pkg matrix`                          |
| `04-game-detail.svg`    | Fiche jeu (Victory Road) : plateformes, vérification BLAKE3, fonctionnalités, écosystème |

## Import dans Figma

1. Dans un fichier Figma, glisser-déposer les quatre `.svg` sur le canevas (ou `Ctrl+Shift+K` / menu _Place image_ ne convient pas : utiliser le glisser-déposer ou _File > Import_, qui garde les vecteurs).
2. Chaque SVG devient un frame nommé d'après son `<title>` ; les groupes (`sidebar`, `topbar`, `card-<id>`, `row-<id>`, `verify-report`, `features`, `ecosystem`) deviennent des calques nommés.
3. Les textes sont des `<text>` : Figma les importe en texte éditable. La police déclarée est `Inter` (repli Segoe UI) ; installer Inter ou remplacer la police au besoin.
4. Pour en faire des composants : sélectionner un `card-*` ou une cellule de `row-*` puis _Create component_ ; les couleurs peuvent être converties en styles nommés d'après la table des jetons de `DESIGN.md`.

## Régénérer

```sh
cargo run -q -p nie-pkg -- matrix > /tmp/matrix.md   # sur le vps
bash docs/rust-migration/mockup/gen.sh docs/rust-migration/mockup /tmp/matrix.md
```
