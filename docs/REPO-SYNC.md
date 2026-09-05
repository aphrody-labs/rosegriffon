# Orchestration RG ↔ Niers

Ce document est le registre opératoire commun aux deux dépôts. Il décrit ce
qui est réellement synchronisé, ce qui ne l'est pas, et les preuves à rejouer.
Le fichier de référence est dans `rg` afin de ne pas dupliquer une logique
d'automatisation dans Niers.

## Frontière des responsabilités

| Surface | Dépôt canonique | Consommateurs | Règle |
| --- | --- | --- | --- |
| Applications Azalée, site rosegriffon, nginx, publication bleu/vert | `rg` | VPS de production | Le code web et les migrations publiables sont versionnés ici. |
| Formats IEVR, parseurs Rust/Bun, manifests, données de jeu et outils NIE.exe | `niers` | RG, services NIE, poste de travail | Les données lourdes et dérivées restent locales et ne sont jamais auto-ajoutées. |
| Miroirs SQLite, `var/`, `target/`, `.next/`, cache modèle | machine qui exécute le service | services locaux | Artefacts régénérables, hors Git et hors synchronisation. |
| CDN originaux et variantes | service partagé du VPS | RG et Niers | `rg-cdn.service` et `cdn-variants.service` restent actifs : les arrêter casserait les deux sites. |

`niers/apps/azalee/data` est encore un chemin de compatibilité consommé par
`azalee-api`, le MCP et certains scripts. Il ne s'agit pas d'une seconde
source de code web : toute suppression de `niers/apps/azalee` devra d'abord
remplacer ces références et rejouer les tests de service. Le nettoyage
automatique ne supprime donc pas ce répertoire.

Les dépôts ne sont jamais fusionnés par un `pull` : chacun suit son propre
remote et sa propre branche. Un changement transversal est un changement
coordonné dans deux commits, reliés par le registre de livraison, pas un
`git merge` entre arborescences.

## Commande canonique

Depuis `/home/ubuntu/rg` :

```bash
# lecture seule : état des deux arbres et fichiers qui seraient checkpointés
bun scripts/ops/repo-sync.ts --repo all --commit --dry-run --json

# synchronisation volontaire : fast-forward, checkpoint sûr, push de chaque dépôt
bun scripts/ops/repo-sync.ts --repo all --pull --commit --push

# même opération sur un VPS accessible par une clé SSH
REPO_SYNC_VPS=mon-alias \
REPO_SYNC_REMOTE_RG_ROOT=/home/ubuntu/rg \
REPO_SYNC_REMOTE_NIERS_ROOT=/home/ubuntu/niers \
bun scripts/ops/repo-sync.ts --repo all --pull --commit --push --vps
```

`--pull` fait `fetch --prune` puis `merge --ff-only`. Un arbre modifié est
refusé : aucun stash, reset, rebase ou force-push n'est caché dans le script.
`--commit` crée `chore(sync): checkpoint <UTC>` seulement après
`git diff --check`. Les chemins secrets, bases SQLite, `.env`, sources Astro,
`node_modules`, `.next`, `target`, `var`, `outputs` et caches sont refusés avant
`git add`. `--push` exige la branche demandée et un arbre propre. Le script ne
lance jamais `deploy.ts`, ne redémarre jamais un service et ne modifie jamais
le contenu d'un autre dépôt.

La variable `REPO_SYNC_AUTOCOMMIT=1` active le checkpoint sans option CLI ;
`REPO_SYNC_PUSH=1` active le push. Elles sont désactivées par défaut. Le
wrapper `bun run ops:sync` est volontairement explicite et le contrôle rapide
est disponible avec `bun run ops:sync:check`.

## Timer d'autocommit sur le VPS

`infra/systemd/rg-repo-sync.service` est un oneshot borné à 20 % CPU et 256 Mio
de RAM. `rg-repo-sync.timer` le déclenche après le démarrage puis toutes les
30 minutes. Il checkpoint les deux arbres mais pousse à `0` : une publication
reste une action séparée, après les gates et la validation navigateur.

Installation idempotente :

```bash
sudo install -m 0644 infra/systemd/rg-repo-sync.service /etc/systemd/system/
sudo install -m 0644 infra/systemd/rg-repo-sync.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now rg-repo-sync.timer
systemctl list-timers rg-repo-sync.timer
systemctl status rg-repo-sync.service --no-pager
```

Le timer peut être désactivé sans toucher aux services web :
`sudo systemctl disable --now rg-repo-sync.timer`. Les journaux sont ceux de
systemd (`journalctl -u rg-repo-sync.service`).

## Poste local et accès SSH

Le script supporte un poste local et un VPS distincts, mais ne devine pas un
hôte. Sur la machine où ce registre a été vérifié le 2026-09-05, l'alias
`vps-tunnel`/`ovh-vps-direct` n'est pas défini ; `newvps` pointe vers un hôte
qui ne contient ni `/home/ubuntu/rg` ni `/home/ubuntu/niers`. Il serait donc
incorrect de déclarer la synchronisation locale comme fonctionnelle. Pour
l'activer, créer un alias SSH non interactif avec une clé dédiée et les deux
racines présentes, puis renseigner `REPO_SYNC_VPS`,
`REPO_SYNC_REMOTE_RG_ROOT` et `REPO_SYNC_REMOTE_NIERS_ROOT`. La sonde à
exécuter avant activation est :

```bash
ssh -o BatchMode=yes "$REPO_SYNC_VPS" \
  'test -d "$REPO_SYNC_REMOTE_RG_ROOT" && test -d "$REPO_SYNC_REMOTE_NIERS_ROOT"'
```

Tant que cette sonde échoue, le timer local reste un checkpoint local et ne
prétend pas synchroniser une machine absente.

## Allègement et nettoyage contrôlé

Le cache GLB de `nie-model-serve` est régénérable. Le pruner refuse un service
actif par défaut, ne suit aucune symlink, ne touche pas `VERSION` et n'accepte
que `/home/ubuntu/niers/var/model-cache` :

```bash
# aperçu (conserve les fichiers de moins de 24 h)
bun scripts/ops/prune-runtime.ts --max-gib 6 --dry-run

# après arrêt contrôlé de nie-model-serve, purge vers 6 Gio
sudo systemctl stop nie-model-serve.service
bun scripts/ops/prune-runtime.ts --max-gib 6 --min-age-hours 0
sudo systemctl start nie-model-serve.service
curl --fail --silent http://127.0.0.1:8790/health
```

`--prune-debug-target` peut retirer uniquement `niers/target/debug` après une
lecture de `/proc`; il ne s'exécute pas si un processus utilise un exécutable
de ce répertoire. `target/release`, les données de jeu, les bases, les logs et
les caches d'outils ne sont pas effacés par défaut.

Le serveur modèle est configuré avec un budget CPK et un pool bornés, sans
préchargement global : `NIE_CPK_CACHE_BUDGET_GIB=4`, deux workers,
quatre threads HTTP, file de 128, cache mémoire explicite de 128 Mio,
`MemoryHigh=5G`, `MemoryMax=7G`, `MemorySwapMax=1G`, `CPUWeight=80`.
Cette stratégie privilégie une latence de premier modèle contre un pic de
14 Gio créé par le preload de 6 387 modèles. Toute modification de ces bornes
doit être suivie de `/health`, d'une requête GLB réelle et d'une mesure
`systemctl show`.

## Preuves minimales avant publication

```bash
bun scripts/ops/repo-sync.ts --repo all --pull --commit --push
git -C /home/ubuntu/rg status --short --branch
git -C /home/ubuntu/niers status --short --branch
systemctl is-active azalee-web.service nie-model-serve.service rg-cdn.service cdn-variants.service
curl --fail --silent https://azalee.rosegriffon.fr/api/health
curl --fail --silent https://cdn.rosegriffon.fr/health
```

Pour Azalée, rejouer ensuite les tests avatar, le type-check, le lint/build et
le smoke navigateur (imports PNG/GLB, export, sauvegarde/restauration,
partage). Une compilation verte n'est pas une preuve de rendu WebGPU ni de
fichier média 200. Pour Niers, utiliser les tests ciblés documentés dans
`niers/docs/FUSION.md` et ne jamais publier une mesure pixel-perfect sans
comparaison mesurée.
