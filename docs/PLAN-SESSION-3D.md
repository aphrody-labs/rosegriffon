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
- Les changements Explorer restent hors périmètre. Aucun chemin Explorer n'apparaît dans le diff
  de cette livraison et aucune modification Explorer non commitée n'a été écrasée.

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
- À ce stade du registre, la production n'a pas encore été mutée : elle conserve donc sa politique
  legacy de lecture publique par code jusqu'à la séquence contrôlée migration → preview → smoke.

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

- Committer et publier l'intégration RG, puis construire une release isolée depuis ce commit.
- Sauvegarder la base de production, appliquer la migration dans une transaction et auditer
  immédiatement colonnes, contraintes, index, grants et politiques.
- Déployer sur le slot de prévisualisation Azalée, exécuter le smoke public puis le parcours complet
  avec deux comptes éphémères : sauvegarde, restauration, partage visiteur, isolation du second
  compte et suppression. Supprimer ensuite comptes, sessions, profils et sauvegardes de test et
  prouver l'absence de résidus.
- Promouvoir uniquement si toutes les actions et sondes preview sont vertes. Sinon conserver le
  slot de production actuel et corriger à partir des journaux.
- Après promotion, vérifier la version active, le domaine en HTTP 200 et les parcours
  non authentifié/authentifié en production.

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
