# NIERS — contexte post-migration de `rg`

Ce fichier est le point d'entrée pour reprendre le travail après la migration des capacités
IEVR de `rg` vers `niers`. Il complète `../aphrody-infra/docs/ops/REPO-SYNC.md` ; il ne remplace ni les règles
d'exploitation ni les documents de conception détaillés.

## Dépôts canoniques

| Surface                                                            | Dépôt canonique      | Règle                                                                     |
| ------------------------------------------------------------------ | -------------------- | ------------------------------------------------------------------------- |
| Applications Rose Griffon, Azalée, bot, nginx et orchestration VPS | `/home/ubuntu/rg`    | Le code de production web et l'infrastructure restent ici.                |
| `nie.exe`, formats IEVR, VFS, données de jeu, RE, forge et WASM    | `/home/ubuntu/niers` | Les capacités du jeu et leurs outils vivent ici.                          |
| Miroirs SQLite, caches, assets et builds                           | machine d'exécution  | Artefacts régénérables, hors Git sauf exception explicitement documentée. |

Les deux dépôts gardent leurs remotes, historiques et branches séparés. Une évolution qui
touche les deux arbres se livre par deux changements coordonnés, reliés dans
`../aphrody-infra/docs/ops/REPO-SYNC.md` ; on ne fusionne pas les dépôts par un `pull` ou un `merge` croisé.

## État cible

`nie.aphrody.com` est la surface web de `nie.exe`. La cible n'est pas un explorateur de données
présentant le jeu : `apps/nie-web` doit devenir l'hôte du moteur `nie.exe` compilé en
`wasm32-unknown-unknown`, via `crates/engine/nie-wasm`.

État mesuré au 2026-09-07 :

- `crates/engine/nie-wasm` compile avec `just build-wasm` ;
- `apps/nie-web` est encore un hôte Vite/React autour de `WasmGame` ;
- le rendu WASM actuel est un placeholder 2D, pas une reproduction fidèle du jeu ;
- la fidélité complète exige encore le portage progressif du moteur, des formats, du rendu,
  de l'audio, des entrées et des I/O natives vers des abstractions WASM.

La forge de `niers` conserve une autre contrainte : la production de `dist/nie.exe` doit rester
byte-exacte avec le binaire de référence. Le portage WASM ne remplace pas cette preuve et ne
doit pas être présenté comme une reconstruction byte-exacte du binaire Windows.

## Répartition après migration

Dans `rg` :

- `../aphrody-infra/scripts/ops/repo-sync.ts` orchestre les contrôles coordonnés des deux dépôts ;
- `scripts/ops/release-stack.ts` décrit la chaîne synchronisation → données → formats → WASM
  → services → sondes ;
- `infra/`, `scripts/ops/` et `../aphrody-infra/docs/ops/REPO-SYNC.md` portent l'exploitation du VPS ;
- aucun nouveau parseur IEVR, décodeur, outil RE ou composant du moteur ne doit être ajouté
  ici.

Dans `niers` :

- `crates/engine/` porte le moteur, les formats, le VFS, le rendu et `nie-wasm` ;
- `crates/forge/` porte le RE et la forge byte-exacte de `nie.exe` ;
- `crates/tools/nie-site` sert la surface web de `nie` ;
- `apps/nie-web` est la cible d'intégration navigateur du WASM ;
- `apps/inacord` et `packages/inacord-ui` portent la suite Inacord, distincte du jeu.

## Reprise opérationnelle

Depuis `rg`, commencer par :

```bash
git status --short --branch
bun ../aphrody-infra/scripts/ops/repo-sync.ts --repo all --commit --dry-run --json
```

Puis lire dans `niers` :

```bash
git -C /home/ubuntu/niers status --short --branch
sed -n '1,220p' /home/ubuntu/niers/docs/OVH.md
sed -n '1,180p' /home/ubuntu/niers/docs/TARGET-ARCHITECTURE.md
just -f /home/ubuntu/niers/justfile build-wasm
```

Avant toute modification de production, `docs/OVH.md` fait autorité pour les comptes, zones,
DNS et certificats. Avant toute modification de code WASM, `niers/docs/TARGET-ARCHITECTURE.md`
fait autorité pour la cible `nie.exe → nie-web`.

## Garde-fous

- ne jamais imprimer, copier ou committer de secret OVH, Postgres, Supabase ou SSH ;
- ne jamais confondre `rg` avec `niers`, ni éditer une copie d'application dans le mauvais dépôt ;
- ne pas déclarer le portage WASM terminé parce que le crate compile ;
- ne pas supprimer une surface existante avant qu'un remplacement soit mesuré ;
- ne pas installer, redémarrer, recharger nginx/systemd ou modifier le DNS sans action de
  production explicitement autorisée ;
- compter le contenu servi, pas seulement le code HTTP ou le code de sortie d'une commande.

## Sources de vérité

- `../aphrody-infra/docs/ops/REPO-SYNC.md` — orchestration et frontière `rg ↔ niers` ;
- `/home/ubuntu/niers/docs/OVH.md` — comptes, DNS, certificats et procédures OVH ;
- `/home/ubuntu/niers/docs/TARGET-ARCHITECTURE.md` — cible WASM et suite Inacord ;
- `/home/ubuntu/niers/docs/ARCHITECTURE.md` — état mesuré de l'architecture niers ;
- `/home/ubuntu/niers/docs/FORGE.md` — preuve de reconstruction de `nie.exe`.
