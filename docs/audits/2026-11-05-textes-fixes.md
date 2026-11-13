# 2026-11-05 — Corrections des textes (doublons, anglais, placeholders)

Suite de `2026-11-05-crawl.md` (constats 6 et 8). Preuve : HTML SSR récupéré par
`curl` sur le serveur de dev, avant et après correction, réduit en texte (scripts et
styles retirés, balises remplacées par une espace, comme le crawler `tools/crawl/copy.ts`),
puis comptage des chaînes fautives.

Serveur : le port 3332 demandé n'a pas pu démarrer (« Another next dev server is
already running », un autre agent tient `next dev` sur le même répertoire, port 3311,
PID 43120). Les mesures ont donc été faites sur `http://localhost:3311`, qui sert le
même checkout avec rechargement à chaud.

## Causes et corrections

| Constat                                                               | Cause                                                                                                                                                                            | Correction                                                                                                                                                                                                                                                                                                                                                                                      |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/wiki/chara` : « mountain Montagne », « wind Vent », « Normal girl » | `CommonSpriteIcon` et `SpriteIcon` écrivaient la clé brute du sprite (`girl`, `mountain`, `justice`…) dans un `<span class="sr-only">`, juste à côté du libellé français visible | La clé n'est plus jamais exposée. Nouveau prop `label` : présent, l'icône devient `role="img"` + `aria-label` localisé ; absent, l'icône est `aria-hidden` (le libellé visible la nomme déjà). Icônes de genre seules : `label` = `t("common.female" / "common.male")` (tableau, cartes mobiles, fiche personnage). Les boutons de filtre gardent leur nom via `title` (« Garçon », « Fille »). |
| `/wiki/chara` : « Inconnu Inconnu »                                   | Carte mobile `BaseCharacterTable` : sans image de poste, le libellé de repli était rendu, PUIS le libellé normal                                                                 | Un seul libellé                                                                                                                                                                                                                                                                                                                                                                                 |
| `/wiki/chara` : « Const : — — »                                       | Constellation absente → « — », style de jeu absent → « — »                                                                                                                       | Chaque valeur absente n'est pas affichée ; la ligne disparaît quand les deux manquent                                                                                                                                                                                                                                                                                                           |
| `/wiki` : « Command Palette », « Search for a command to run... »     | `GlobalSearch` ne passait pas `title`/`description` à `CommandDialog` (valeurs par défaut anglaises de `@rosegriffon/ui`)                                                        | Clés `search.palette.title`, `search.palette.description`, `search.palette.placeholder` dans `public/locales/{fr,en,ja}.json`, lues via `t()` de `useLanguage`                                                                                                                                                                                                                                  |
| « Critique Critique » (`/wiki`, `/news/critique-…`)                   | Badge de catégorie « Critique » posé au-dessus d'un titre qui commence par « Critique »                                                                                          | `libelleRedondantAvecTitre()` (`src/lib/libelle-redondant.ts`, testé) : le badge est omis quand le titre commence par le même mot (insensible casse/accents, mot entier). Appliqué au carrousel d'actualités et à l'en-tête d'article                                                                                                                                                           |
| « Chroniques Chroniques » (`/wiki`)                                   | Carte « Chroniques » décrite par « Chroniques et actualités du bouquet »                                                                                                         | Description : « Récits et actualités du bouquet »                                                                                                                                                                                                                                                                                                                                               |
| « Bureau Bureau » (`/notre-equipe`)                                   | Surtitre « Médailles d'Honneur du Bureau » au-dessus du titre « Bureau de l'Association »                                                                                        | Surtitre : « Médailles d'Honneur »                                                                                                                                                                                                                                                                                                                                                              |
| « Tournoi Tournoi » (`/achillea/tournaments`)                         | Carte mobile : type « Tournoi » suivi d'une description commençant par « Tournoi … » ; le type brut (`INTERCLAN`, `RANKED`) aurait été affiché en anglais                        | Carte mobile : type affiché seulement s'il n'est pas `TOURNAMENT` (la liste n'en contient que) ; table et carte passent par `eventTypeLabel()` de `@rosegriffon/achillea-core/labels`                                                                                                                                                                                                           |
| « Staff Staff », « Communauté Communauté » (`/community?vue=staff`)   | h1 « Communauté » suivi de l'onglet « Communauté » ; onglet « Staff » suivi du h2 « Staff Discord »                                                                              | Onglet : « Membres » ; h2 : « Équipe Discord — {serveur} »                                                                                                                                                                                                                                                                                                                                      |

## Mesures (occurrences dans le texte rendu)

| Page                                                        | Chaîne                                          |               Avant |                          Après |
| ----------------------------------------------------------- | ----------------------------------------------- | ------------------: | -----------------------------: |
| /wiki/chara                                                 | Normal girl                                     |                 185 |                              0 |
| /wiki/chara                                                 | Normal boy                                      |                  15 |                              0 |
| /wiki/chara                                                 | Inconnu Inconnu                                 |                 200 |                              0 |
| /wiki/chara                                                 | Const : — —                                     |                 200 |                              0 |
| /wiki/chara                                                 | mountain / wind / forest / fire                 | 87 / 113 / 105 / 99 |                  0 / 0 / 0 / 0 |
| /wiki/chara                                                 | `<span class="sr-only">` à clé de sprite        |                 807 |                              0 |
| /wiki/chara                                                 | icône de genre nommée (`role="img" aria-label`) |                   0 | 400 (Féminin 370, Masculin 30) |
| /wiki                                                       | Command Palette                                 |                   2 |                              0 |
| /wiki                                                       | Search for a command                            |                   2 |                              0 |
| /wiki                                                       | Recherche dans le wiki                          |                   0 |                              2 |
| /wiki                                                       | Critique Critique                               |                   2 |                              0 |
| /wiki                                                       | Chroniques Chroniques                           |                   1 |                              0 |
| /news/critique-communautaire-de-inazuma-eleven-victory-road | Critique Critique                               |                   1 |                              0 |
| /notre-equipe                                               | Bureau Bureau                                   |                   1 |                              0 |
| /achillea/tournaments                                       | Tournoi Tournoi                                 |                   2 |                              1 |
| /community?vue=staff&serveur=rose-griffon                   | Staff Staff                                     |                   1 |                              0 |
| /community?vue=staff&serveur=rose-griffon                   | Communauté Communauté                           |                   1 |                              0 |

## Restes

- `/achillea/tournaments`, table desktop : la cellule « Type » (« Tournoi ») précède la
  cellule « Description » (« Tournoi Inazuma Eleven… »). Ce sont deux cellules distinctes
  d'une table à en-têtes ; le doublon n'existe que dans le texte aplati par le crawler.
  Conservé.
- Noms doublés (« Jim Jim » 5, « Swift Swift » 4 sur `/wiki/chara`) : donnée en base,
  corrigée à part. Aucun dédoublonnage côté UI.
- Genre inversé sur `/wiki/chara` : 185 personnages ont `gender: 1`, 15 ont `gender: 0`,
  et `isFemaleGender` (`@rosegriffon/inagle/game/gender`) lit `1 = féminin`. Mark Evans
  s'affiche donc « Féminin », Nelly « Masculin ». La convention de la donnée et celle
  d'inagle divergent : à trancher côté données ou côté inagle (hors périmètre ici).
- « Normal » (rareté) reste en anglais dans les badges de rareté ; non signalé par le
  crawl comme anglais, à vérifier avec les libellés de rareté.

## Portes

`apps/rg-website` : `bun run typecheck` 0 erreur, `bun run lint` 0 erreur (avertissements
préexistants), `bun run test` 494 pass / 0 fail. `packages/rg-ui` : `bun run test`
153 pass / 0 fail. Ratchet `jsxUiText` : −1 sur les fichiers modifiés ici (placeholder de
`GlobalSearch` déplacé dans les locales) ; total arbre de travail 4788, égal à la baseline
(le reste de l'arbre contient des modifications non commitées d'autres agents). Baseline
non modifiée.
