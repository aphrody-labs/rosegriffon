# Registre de livraison — atelier 3D Azalée

Dernière mise à jour : 2026-09-05 UTC.

Ce document est la source de vérité de la livraison `/avatar`. Les fichiers de `outputs/` et les
rapports générés restent des artefacts de diagnostic : ils ne constituent jamais, seuls, une
preuve de fonctionnement. Chaque résultat ci-dessous renvoie donc à une commande, une base ou un
navigateur effectivement exécuté.

## Baseline Git et périmètre

- Baseline demandée : `2d82512504add30060ddc25b5fa08996c16de0b6`, retrouvée dans
  `/home/ubuntu/niers` avec le sujet `feat(avatar): livrer atelier, imports locaux et audit des
  liaisons`.
- Publication de la baseline vérifiée : `origin/main` du dépôt Niers contient ce commit. Les
  sources atelier de cette baseline et les correctifs WASM ultérieurs ont été intégrés
  sélectivement dans le monorepo RG ; les artefacts `outputs/` n'ont pas été recopiés.
- Monorepo cible : branche `main`, tête avant intégration `d76577511ba5`, remote
  `https://github.com/rose-griffon/rg.git`.
- Les changements Explorer de NIE restent hors périmètre : aucun fichier du dépôt Niers n'a été
  modifié. Après la livraison initiale, une convergence Azalée explicite a supprimé l'interface
  `/cpk` locale, qui faisait doublon avec Niers, tout en conservant l'API `/api/cpk` et les
  bibliothèques de décodage nécessaires aux pages publiques et aux imports.

## Fonctionnalités livrées

| Fonction | État et preuve locale |
| --- | --- |
| Édition réelle | Catalogue CDN, choix par identifiant stable, transformations, annuler/rétablir et projet JSON ; tests projet/liaisons verts |
| Composition et aperçu 3D | GLB composé chargé dans `model-viewer`, chargement local des décodeurs Basis/Draco/Meshopt ; smoke Chromium vert |
| Imports locaux | PNG réel, GLB et GLB/gzip validés dans Chromium ; signatures, URI, tailles et traversées couvertes par 7 tests |
| Export | Téléchargement `avatar.glb` observé dans Chromium après composition et après import |
| Compte | Enregistrer, lister, restaurer et supprimer via Server Actions ; absence de session refusée |
| Partage | Lien `/avatar?code=…`, format exact de 69 caractères, ouverture privilégiée côté serveur uniquement |
| Sécurité des recettes | Validation structurelle et volumétrique à l'écriture et à l'ouverture ; clés de pollution et valeurs hors bornes refusées |

## Persistance et RLS

Migration : `apps/website/supabase/migrations/20260905_avatar_saves.sql`.

- `id` UUID, `user_id` vers `auth.users(id)` avec cascade, nom `varchar(40)` borné, recette JSONB,
  code nullable de 69 caractères, dates de création/modification.
- Un seul index unique partiel sur le code et un seul index `(user_id, modifie_le desc)` ; les
  contraintes, politiques et index legacy sont convergés de manière rejouable.
- RLS activée avec quatre politiques `authenticated`, toutes limitées à
  `(select auth.uid()) = user_id`. `anon` n'a aucun droit de table.
- `service_role` possède les droits nécessaires aux Server Actions. Seule `ouvrirParCode`, après
  validation longueur/alphabet, peut faire une lecture privilégiée ; elle ne renvoie que le nom
  et une recette revalidée.
- Validation effectuée deux fois, avec `ON_ERROR_STOP`, sur une base éphémère reproduisant le
  schéma de production : 7 colonnes attendues, 3 index, 4 politiques, grants attendus. Les tests
  RLS A/B ont prouvé lecture propre, refus lecture/écriture/suppression croisée, refus anonyme et
  lecture du partage par `service_role`. La base éphémère a ensuite été supprimée.
- La migration a ensuite été appliquée en production, rejouée sans erreur et auditée : la politique
  legacy de lecture publique par code a disparu. La table est sécurisée même si la promotion de
  l'application reste indépendante et conditionnée par les smokes preview.

## Chronologie factuelle des sources NIE

La baseline n'est pas un bloc opaque : son parent direct est `49951018` et son diff comporte 146
fichiers, 50 836 ajouts et 269 suppressions. Ce volume inclut beaucoup d'artefacts d'étude ; seuls
les éléments exécutables nécessaires à Azalée ont été admis dans RG.

| Commit NIE | Date | Fait vérifié dans le diff |
| --- | --- | --- |
| `19831b52` | 2026-09-05 02:02 +02 | point de sauvegarde WIP de l'atelier et du pipeline de rendu |
| `1044e5db` | 02:06 | préparation du viewport WebGPU et partage des backends natifs |
| `a62fa043` | 02:14 | ouverture de NIE Studio natif sur le moteur GPU partagé |
| `2d825125` | 02:42 | livraison atelier : UI, imports locaux, composition, tests, vérification CDN, moteur web Rust/WASM et artefacts de mesure |
| `46f7370d` | 02:44 | publication du binaire WASM d'atlas et versionnage de son URL de chargement |
| `fcb23d2b` | 02:44 | correction de typage du tampon gzip dans le contrôle navigateur |
| `010765d4` | 02:49 | contraste des actions de l'atelier en thème sombre |
| `6f180526`, `8aa6a291`, `032b2e70`, `d6ecaf41` | 02:52–04:08 | changements Explorer postérieurs, explicitement non portés dans cette livraison |
| `50837759` | 04:15 | documentation CLI des captures GLB GPU, sans changement de l'atelier web porté |

Avant cette baseline, les commits NIE mesurables qui alimentent le moteur actuel comprennent la
résolution des planches (`7844d8fc`), la correction de la couche œil inversée (`418cba09`), le
sourcil manquant (`b4819335`), la résolution des centres et du dépliage (`0b911949`), les six
familles de visage (`9b54414b`), le corps propre à chaque morphologie (`602df992`), les mains et la
pose de repos (`6a31402d`, `a3b1ba96`) et la coupe du maillot (`2e15e5eb`). Ces sujets de commit
documentent une progression ; les preuves retenues par cette livraison restent les tests, l'audit
CDN et les smokes navigateur exécutés.

## Inventaire des fichiers admis depuis NIE

| Fichier ou groupe | Responsabilité observable |
| --- | --- |
| `app/avatar/Atelier.tsx`, `atelier.css` | coque responsive, bibliothèque de pièces, inspection, transformations, historique, projet et accès compte/partage |
| `app/avatar/Editeur.tsx` | adaptateur mince entre catalogue, état de recette, composition d'URL et atelier |
| `app/avatar/composition.ts` | transforme les choix stables de catalogue en pièces, couches, teintes, morphologie, taille, forme et habits pour `/model-avatar` |
| `app/avatar/ImportAvatar.tsx`, `import-local.ts` | import local PNG/GLB/gzip, validation des signatures/tailles/URI, réécriture sûre des ressources GLB |
| `app/avatar/Modele3D.tsx` | cycle de vie `model-viewer`, état de chargement et export de l'instantané GLB |
| `app/avatar/projet.ts` | format de projet JSON NIE, validation, copie défensive et historique borné à 50 étapes |
| `app/avatar/liaisons.ts` | CRC IEEE, URL d'icône, invariants catalogue→icône→composition et audit des sélections |
| `app/avatar/verification/*` | audit automatisé CDN et banc web ; outils de preuve, pas preuve autonome |
| `lib/model-viewer-loader.ts` | chargement unique du viewer auto-hébergé et configuration des chemins de décodeurs locaux |
| `public/vendor/basis`, `public/vendor/draco`, `meshopt_decoder.module.js` | dépendances d'exécution 3D auto-hébergées avec licences Basis/Draco conservées |
| `lib/nie-wasm-web/*`, `public/wasm/nie_wasm_bg.wasm`, `lib/cpk-wasm.ts` | bindings WASM, binaire source et binaire public optimisé, dont l'export atlas `g4tx_sprite_sheet_json` |
| `*.test.ts` de l'avatar | 34 tests de baseline : 7 import, 5 liaisons, 22 projet/historique |

Les composants de l'ancien explorateur CPK ne sont plus une surface produit : ils ont été retirés
dans Azalée par `84461f04`. Les pages `/modeles`, `/gallery`, `/videos`, `/sons` et `/textures`
consomment directement leurs API/domaines respectifs (`lib/cpk/*`, catalogue wiki et CDN), sans
exposer de navigation brute des fichiers. Les primitives d'état réutilisables du wiki sont
centralisées dans `components/wiki` (notamment `WikiPageHeader` et `WikiErrorState`).

Les fichiers Rust `crates/engine/nie-render3d/src/web.rs` et
`crates/engine/nie-wasm/src/web_viewer.rs` font partie de la baseline NIE et restent la source du
build WASM côté Niers. Ils ne sont pas dupliqués dans RG : RG reçoit leurs bindings et binaires
construits par `scripts/build-wasm.sh`, ce qui évite deux implémentations divergentes.

## Chronologie factuelle de l'intégration RG/Azalée

| Commit RG | Fait vérifié |
| --- | --- |
| `4270b715` (2026-08-20) | premier codec de 69 caractères, 86 emplacements/410 bits, panneau et persistance initiale ; sa lecture RLS publique par code a été remplacée dans cette livraison |
| `0eae3639` à `34c2d41e` (20–21 août) | personnage habillé, cheveux avant/arrière, teintes, morphologie, genre, taille, forme, habits, échantillons et manipulation de l'ancien écran |
| `63ba8ec4` (2026-09-01) | enrichissement Zukan et filtre groupe d'âge, indépendant du cœur atelier mais source du catalogue personnage |
| `9fbb4a6f` (2026-09-05) | six profils officiels Shawn rétablis, métadonnées/filtres Zukan et corpus de modèles consolidés avant reprise de l'atelier |
| `44eee069` | port sélectif de la baseline, persistance privée, E2E, migration et registre : 39 fichiers, 4 472 ajouts, 1 070 suppressions |
| `dff9534b` | mapping `twoFactorEnabled` du schéma propre au plugin Better Auth vers `two_factor_enabled`, avec test du schéma fusionné |
| `d5aecd1e` | navigation complète après inscription et capture des rejets SMTP, afin que la nouvelle session soit relue côté serveur sans rejet non géré |
| `c63b7bb9` | CSP : autorisation du pixel GTM utilisé par le parcours public |
| `84461f04` | suppression de l'interface CPK Azalée en doublon ; API et bindings conservés |
| `5c81e971` | état d'erreur partagé pour les fiches wiki, avec reprise et retour cohérents |

Le remplacement de l'ancien `Editeur.tsx` (884 lignes retirées, adaptateur de 41 lignes) est
intentionnel : la logique monolithique a été répartie entre `Atelier`, `composition`, `projet`,
`liaisons` et `ImportAvatar`. Cela ne signifie pas une suppression fonctionnelle ; la couverture
tests et le smoke public vérifient les chemins effectivement réutilisés.

## Journal de déploiement

- Première preview de `44eee069` : smoke public vert ; inscription rouge avec PostgreSQL 42703,
  le plugin Better Auth demandant `twoFactorEnabled` au lieu de `two_factor_enabled`. Aucune
  promotion ; aucun compte créé.
- Preview de `dff9534b` : appel d'inscription HTTP 200, utilisateur et session présents côté
  serveur, mais navigation SPA vers `/avatar` restée anonyme. L'échec SMTP sur l'adresse de test
  produisait aussi une `unhandledRejection`. Aucune promotion.
- Après chacun de ces diagnostics, le nettoyage a vérifié zéro résidu dans `user`, `account`,
  `session`, `profiles`, `auth.users` et `avatar_saves`.
- Release preview B `2026-09-05T02-44-51-570-vkdWKsHwUClCT-XrRBjEy` (SHA `92c26dc6`) :
  build/lint/type/gates publics verts ; les premières tentatives d'inscription SPA restaient
  anonymes après redirection.
- Les correctifs `2d97b37d`, `ef71704c` et `b44e38ce` ont ensuite rendu le flux déterministe :
  réponse HTTP d'inscription attendue, initialisations annulées neutralisées, puis lecture
  réseau de session avant navigation. Le smoke E2E à deux comptes a été rejoué avec sauvegarde,
  restauration, partage visiteur, isolation et suppression, sans résidu. Cette preuve doit encore
  être rejouée sur la release finale construite depuis la tête publiée.
- Une tentative de promotion a été interrompue car le worktree avait avancé vers `84461f04` pendant
  le build. La production a été restaurée sur le slot A précédent (`2026-09-05T01-33-59-015-MQF1OoRspqfLIs7pY4OmR`,
  commit `d7657751`) et reste à promouvoir depuis une release isolée intégrant les commits wiki validés.

## Preuves exécutées le 2026-09-05

| Gate | Commande / environnement | Résultat |
| --- | --- | --- |
| Tests atelier et serveur | `bun test app/avatar/*.test.ts tests/avatar-sauvegardes-server.test.ts tests/partage.test.ts` | 51 verts, 0 échec, dont les 34 tests atelier de la baseline et 7 tests de persistance |
| Audit catalogue réel | `bun app/avatar/verification/check-assets.ts` | 502 pièces, 491 icônes uniques, 0 erreur liaison, 0 erreur image/pixels, 0 erreur sélection→composition |
| TypeScript | `bun --bun tsc --noEmit --incremental false -p tsconfig.json` | succès |
| Lint atelier | ESLint et Oxlint ciblés sur `app/avatar`, serveur, E2E et configuration Playwright | succès, 0 erreur |
| Lint global | `bun run lint` puis `eslint . --quiet` | bloqué par 2 erreurs préexistantes hors périmètre dans `app/vroid/GalerieVroid.tsx` et `lib/vroid/client.ts` |
| Build WASM | `AZALEE_DIR=/home/ubuntu/rg/apps/azalee bash scripts/build-wasm.sh` depuis Niers | succès ; wasm-bindgen 0.2.125, wasm public optimisé de 2 111 117 à 1 775 695 octets |
| Build Azalée | `bun run build` | succès Next.js 16.3 canary, 120 routes ; `/avatar` dynamique |
| Smoke Chromium public | Playwright sur build local, Chromium réel | vert en 8,5 s : édition, PNG 3×4, GLB, gzip, export, refus hors session, code invalide ; 0 console.error, pageerror ou réponse HTTP ≥400 |

Le rapport JSON de l'audit CDN est produit dans `var/json/avatar-assets-audit.json`; le décompte
ci-dessus provient de l'exécution réelle de la commande et non de la seule présence de ce fichier.

## Gates de publication encore ouvertes

- Publier l'intégration RG (`84461f04`, `5c81e971` et les correctifs d'auth associés), puis construire
  une release isolée depuis ce commit exact ; refuser l'assemblage si le SHA ou le worktree change
  pendant le build.
- La migration de production est appliquée et rejouée sans erreur ; conserver l'audit des colonnes,
  contraintes, index, grants et politiques comme preuve de base, sans la confondre avec la preuve
  de déploiement applicatif.
- Déployer sur le slot de prévisualisation Azalée, exécuter le smoke public puis le parcours complet
  avec deux comptes éphémères : sauvegarde, restauration, partage visiteur, isolation du second
  compte et suppression. Supprimer ensuite comptes, sessions, profils et sauvegardes de test et
  prouver l'absence de résidus.
- Promouvoir uniquement si toutes les actions et sondes preview sont vertes. Sinon conserver le
  slot de production actuel et corriger à partir des journaux.
- Après promotion, vérifier la version active, le domaine en HTTP 200 et les parcours
  non authentifié/authentifié en production.

Les contrôles opérationnels à ne pas omettre lors de cette nouvelle release sont : capturer le
SHA avant le build et le comparer à celui du manifeste après assemblage, tester chaque contexte
Playwright avec l'activation preview réellement routée, et invalider le cache HTML de `/login` (ou
le servir avec une revalidation courte) afin de ne pas rejouer un ancien bundle. Les identifiants
SMTP de production restent à vérifier séparément ; les erreurs d'envoi sont maintenant capturées,
mais cela ne constitue pas une preuve de livraison d'un courriel de vérification.

## Limites explicites

- Le codec fait un aller-retour exact dans l'atelier. Sa compatibilité avec l'éditeur du jeu n'est
  pas revendiquée sans table canonique publiée des 86 emplacements.
- L'audit pixels compare les icônes d'interface aux icônes canoniques du CDN avec un écart absolu
  moyen maximal de 8/255. Il ne mesure pas la fidélité du rendu 3D complet.
- La fidélité visuelle du personnage n'est donc pas qualifiée de pixel-perfect sans comparaison
  raster mesurée du rendu final.
- Les avertissements NFT/cache du build et les deux erreurs lint globales Vroid sont antérieurs et
  distincts de l'atelier ; ils restent consignés, pas masqués par une affirmation de gate global
  entièrement vert.
