# DESIGN : app NIE en Rust

Une seule app, `NIE`, pour tous les jeux Inazuma Eleven : bibliothèque (gestionnaire de paquets), matrice des fonctionnalités, fiche jeu, puis outils par jeu (extraction, sauvegarde, équipe, wiki). Maquettes : `mockup/` (SVG importables dans Figma).

## Décision : Dioxus, GPUI en option pour l'éditeur

| Critère | Dioxus 0.7 | GPUI 0.2 / gpui-fast 0.1 + gpui-kit 0.9 |
|---|---|---|
| Web (wasm) | oui | non |
| Desktop Windows/macOS/Linux | oui (webview), natif Blitz en 0.8 | oui, natif GPU |
| Mobile | oui (Android/iOS) | non (dépôt `gpui-mobile` expérimental) |
| SSR / SEO pour le wiki | oui (`dioxus-ssr`, fullstack) | non |
| Composants prêts | `dioxus-components` (non stylés, accessibles) | gpui-kit : 60+ composants stylés |
| Performances listes/tableaux | DOM, virtualisation à écrire | très bonnes (gpui-fast : -80 % CPU annoncé en défilement) |
| Réutilisation des jetons existants | CSS direct (`--jeu-*` générés par `aphrody-nie-ui::css`) | à transposer en thème Rust |

Choix : Dioxus pour toute l'app (une base, web + desktop + mobile, SSR du wiki, cross cloud par simple export statique ou conteneur). GPUI (via `gpui-fast` + `gpui-component`) reste réservé à un éventuel éditeur 3D/timeline desktop si le profilage Dioxus est insuffisant ; il consommerait les mêmes crates de domaine (`nie-pkg`, `aphrody-nie-*`), jamais de logique propre. NSH (longbridge) est écarté : ses écrans sont en TSX, contraire à l'objectif Rust pur.

## Jetons

Source unique : `crates/aphrody-nie-ui/src/color.rs` et `tokens.rs` (déjà dérivés de la DA du jeu, cf. `docs/ie/DESIGN-UI.md`). L'app consomme le CSS généré par `aphrody-nie-ui::css`, aucun hex dupliqué.

| Rôle | Jeton | Valeur |
|---|---|---|
| Fond app | `--jeu-fond-abysse` | #131420 |
| Panneau | `--jeu-fond-nuit` | #152d52 |
| Panneau survolé / ligne | `--jeu-fond-profond` | #224271 |
| Accent primaire | `--jeu-accent-cyan` | #97c0fc |
| Accent secondaire | `--jeu-accent-turquoise` | #5f9efc |
| Avertissement / partiel | `--jeu-accent-ambre` | #e6c961 |
| Erreur / absent | `--jeu-accent-brique` | #c74955 |
| Texte | `--jeu-texte-vif` | #fcfaf8 |
| Texte secondaire | `--jeu-surface-glace` | #e0ecff |

Statuts de la matrice : `full` = cyan plein, `partial` = ambre, `planned` = contour cyan sans remplissage, `none` = brique à 40 %. Toujours doublé d'un libellé texte (jamais la couleur seule).

Espacements : grille 4 px (4, 8, 12, 16, 24, 32). Rayons : 4 (cellule), 8 (carte), 12 (panneau). Typo : police système sans-serif, échelle 12/14/16/20/28 ; chiffres tabulaires dans les tableaux.

## Layout

- Shell : barre latérale 240 px (Bibliothèque, Matrice, Outils, Paramètres), barre supérieure 56 px (recherche, filtre plateforme, état de la synchro du registre), contenu fluide.
- Points de rupture : < 720 px barre latérale en tiroir, 720-1280 deux colonnes, > 1280 trois colonnes de cartes.
- Layout calculé par le moteur CSS (web/desktop) puis par taffy (natif) : rester en flex/grid uniquement.

## Composants

- `GameCard` : jaquette, titre, série, pastilles plateformes, état install (non installé / installé / à vérifier / mise à jour dispo), action principale.
- `PlatformChip` : libellé court (DS, 3DS, Wii, Switch, Switch 2, PS4, PS5, PC, Mobile).
- `SupportCell` : statut + libellé, `title` = nom de la fonctionnalité.
- `FeatureMatrix` : tableau jeux x fonctionnalités, en-têtes collants, filtre plateforme.
- `InstallDialog` : choix plateforme, sélection du dump local, progression du hachage BLAKE3, résumé.
- `VerifyReport` : compte ok / manquants / modifiés, liste des écarts.
- `EcosystemList` : émulateurs, outils, wikis, boutique par jeu.
- Primitives : `dioxus-components` (dialog, tabs, tooltip, select) stylées avec les jetons ci-dessus.

## Accessibilité

Contraste AA minimum sur `--jeu-fond-abysse`, focus visible cyan 2 px, navigation clavier complète de la matrice (flèches), libellés texte sur toutes les couleurs de statut.
