---
title: "Déploiement et exploitation"
description: "Procédures de déploiement des applications et services Rose Griffon sur le VPS"
scope: ["monorepo", "ops"]
status: "stable"
---

# Déploiement et exploitation

> **Production status — 2026-09-08:** BXC, public MCP, and public RAG are retired.
> Their old service rows and commands below are historical references only. The
> canonical current state is [`PROD-STATUS.md`](PROD-STATUS.md). Do not enable a
> retired unit or install its old public vhost.

Tout tourne sur un **seul VPS**, derrière nginx, en services systemd lancés par
l'utilisateur `ubuntu`. Il n'y a aucun déploiement externe : les deux
applications Next ont été rapatriées en auto-hébergement.

**Aucun `git push` ne déploie quoi que ce soit.** Un déploiement est toujours
une commande explicite sur la machine.

## Services

| Service systemd | Port | Rôle | Build nécessaire |
| --- | --- | --- | --- |
| `azalee-web` | 3003 | wiki Azalée (Next 16 standalone) | oui |
| `website-web` | 3004 | site principal (Next 16 standalone) | oui |
| `azalee-api` | 8807 | API JSON headless du wiki (41 routes) | non |
| `rg-mcp` | 8808 | **retired — public HTTP disabled; local stdio only** | non |
| `rag-api` | 8806 | **retired — public HTTP disabled** | non |
| `rg-rag-embed` | 8799 | **retired — embeddings sidecar disabled** | non |
| `rg-cdn` | 8804 | CDN images (`/images`, `/upload`) | non |
| `cdn-variants` | 8805 | redimensionnement + WebP à la volée | non |
| `nie-model-serve` | 8790 | modèles 3D assemblés à la volée, décodage **live** des textures des archives CPK | non (binaire Rust) |
| `rg-cron` | — | tâches planifiées | non |
| `nie-miroir.timer` | — | rafraîchissement quotidien du miroir SQLite canonique | non |

Domaines actifs : `rosegriffon.fr`, `azalee.rosegriffon.fr`, `api.rosegriffon.fr`,
`cdn.rosegriffon.fr`, and `achillea.rosegriffon.fr`. `mcp.rosegriffon.fr` remains a
retired vhost and returns `410`.
Les configurations nginx et les unités systemd sont versionnées dans
[`infra/`](../infra).

Chaque service actif porte un **plafond mémoire**. Avant le 14/8/2026, huit d'entre eux
tournaient en `MemoryMax=infinity` : une fuite dans n'importe lequel épuisait les 45 Gio
de l'hôte, et c'est l'OOM killer **global** qui choisissait sa victime — il a tué
`nie-model-serve` à 02 h 16 ce jour-là, alors que sa propre limite de 24 Gio n'était pas
approchée. Les surfaces publiques sont à `OOMScoreAdjust=-200`, les gros consommateurs
sans visiteur (`nie-model-serve`, `rg-rag-embed`) à `+300` : si l'hôte manque de mémoire,
ce sont eux qui tombent, pas le wiki.

De même, tous les démons sont en `Restart=always` et non `on-failure` : une sortie en
code 0 — fin de boucle inattendue, exception avalée — laissait le service mort sans
qu'aucune unité n'apparaisse en échec.

### Vérifier que la machine et le dépôt disent la même chose

```bash
bun run infra:check     # dérive dépôt ↔ machine, sort en 1 si elle réapparaît
bun run infra:pull      # importe la machine dans infra/
bun run infra:diff <nom>
```

Quatre familles sont suivies : unités systemd (services **et** timers), vhosts nginx,
réglages `sysctl`, rotation `logrotate`. La commande refuse aussi tout secret inscrit en
dur dans une unité — ils doivent tous passer par `EnvironmentFile=`.

### Cache partagé des pages de catalogue

Les routes de catalogue d'azalée (`/chara`, `/skill`, `/item`…) se déclarent `no-store`
alors qu'elles rendent un miroir de données de jeu qui ne bouge qu'aux imports : trois
visites de `/chara` coûtaient trois rendus complets (0,449 / 0,458 / 0,434 s). Un
micro-cache nginx d'une minute les sert désormais en **41 ms**. Il est **contourné** dès
que la requête porte un cookie de session, et nginx refuse par défaut de mettre en cache
une réponse qui pose un `Set-Cookie` : une page personnalisée ne peut pas être servie à
quelqu'un d'autre. Voir `infra/nginx/00-rg-cache.conf`.

## Déployer une application Next

```bash
bun run deploy            # wiki + site
bun run deploy azalee     # une seule surface
bun run deploy:status     # version servie, slots, mémoire, santé publique
```

La publication est **bleu/vert et sans coupure** : type-check, build, assemblage
d'une version figée, démarrage sur un second port, sondes réelles, bascule nginx,
puis extinction de l'ancien processus. Détail de la mécanique, de la
prévisualisation et du retour arrière :
[`deploiement-sans-coupure.md`](deploiement-sans-coupure.md).

`bash scripts/ship-azalee.sh` et `bash scripts/ship-website.sh` restent valables :
ce sont désormais des enveloppes autour de la même commande. Le type-check est
exécuté par le déploiement lui-même (`--no-gate` pour le sauter).

### Deux pièges qui font croire à un échec

1. **Code de sortie 132 (« Illegal instruction ») après un build réussi.**
   Next 16 sous Bun plante à la sortie du processus. Le script l'ignore si le
   `BUILD_ID` et le `server.js` standalone existent. Ce n'est pas un échec.
2. **« Another next build process is already running ».** Un seul build à la
   fois : `pkill -f next-build.sh` avant de relancer.

### Symptôme classique après déploiement

Les fragments `/_next/static/*` répondent 500 avec un type MIME `text/plain` :
le dossier `static` du build standalone n'a pas été copié. Correctif :
relancer le script de déploiement.

## Déployer un service sans build

Les services qui lisent directement les sources se rechargent d'un
redémarrage :

```bash
sudo systemctl restart azalee-api.service   # API headless du wiki
# RETIRED: rg-mcp.service is masked; use the local stdio MCP process.
sudo systemctl restart rg-cron.service      # tâches planifiées
```

Installer ou mettre à jour une unité et sa configuration nginx :

```bash
sudo cp infra/systemd/<unité>.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl restart <unité>.service

sudo cp infra/nginx/<vhost>.conf /etc/nginx/conf.d/
sudo nginx -t && sudo systemctl reload nginx
```

`nginx -t` **avant** tout rechargement : une configuration invalide empêche
nginx de recharger et laisse l'ancienne en place — mais un vhost qui référence
un certificat absent fait échouer *toute* la configuration.

Le serveur MCP dispose d'un script d'installation dédié
(`scripts/mcp/install.sh serveur`) qui gère jetons, unité et vhosts ; voir
[`mcp.md`](mcp.md).

## Diagnostiquer

```bash
systemctl status <unité>
journalctl -u <unité> -n 100 --no-pager -p err
curl -s -o /dev/null -w '%{http_code}\n' https://azalee.rosegriffon.fr/
```

| Symptôme | Cause probable |
| --- | --- |
| `502` sur un domaine | le service derrière nginx est arrêté ou en boucle |
| `500` avec du HTML | erreur applicative — lire le journal du service |
| wiki en `504` | plafond mémoire de l'unité atteint |
| `rg-cron` en boucle | `packages/inagle/dist` supprimé → `bun run build --filter=@rosegriffon/inagle` puis redémarrer |
| asset du jeu en 404 sur le CDN | le dump est incomplet : le décodage doit passer par le service live, ne jamais rétablir un `=404` dans nginx |
| unité `failed` mais travail réussi | sonde de santé trop précoce après redémarrage — lire le journal jusqu'au bout |

Le serveur MCP expose ces vérifications en outils (`ops_status`, `ops_logs`,
`ops_http`), utilisables depuis n'importe quelle machine.

## Données

Le miroir SQLite des tables `inagle_*` est rafraîchi chaque nuit par
`nie-miroir.timer`, possédé par le dépôt `/home/ubuntu/niers` : dump Supabase →
validation → échange atomique du lien `/home/ubuntu/niers/var/mirror.sqlite` →
rétention de deux snapshots. Les unités Azalée épinglent ce chemin via
`SQLITE_DB_PATH`. Les consommateurs de la bibliothèque détectent aussi le
changement d'inode tout seuls, donc un processus long ne sert jamais un snapshot
périmé.

Après une publication réussie, le publisher peut invalider les fiches ISR avec
`POST /api/ops/revalidate/wiki` et le secret `AZALEE_REVALIDATE_SECRET`. La route
est inactive par défaut si le secret n'est pas défini.

Corriger une donnée du jeu ne se fait **jamais** dans le miroir : la source est
`packages/inagle`, poussée vers Supabase, puis répliquée. Voir
[`database.md`](database.md) et [`azalee-lib.md`](azalee-lib.md).

## Sauvegardes

`rg-sauvegarde.timer` tourne chaque nuit à 03 h 15 (`scripts/ops/sauvegarde.ts`) :

1. **rôles** (`pg_dumpall --globals-only`) puis **chaque base** en format custom ;
2. **relecture** de chaque archive (`pg_restore --list`) ;
3. **restauration réelle** de la base `rg` dans une base jetable, dont on compte les
   tables et les lignes avant de la supprimer — une archive qui se liste bien peut
   encore refuser de se restaurer ;
4. **envoi hors machine** vers l'archive froide, plus les **fichiers utilisateurs**
   (`/var/www/rg-storage`, 5,4 Gio) en incrémental `--link-dest`.

Pourquoi ce niveau de méfiance : au 14/8/2026 la base `rg` — comptes, commandes,
adhésions, wiki — n'avait **aucune** sauvegarde, et les derniers fichiers du disque,
datés du 14 mai, faisaient 385 octets. Un dump jamais relu n'est pas une sauvegarde,
c'est un fichier.

Les fichiers utilisateurs ne gardent que **3 copies** contre 7 pour les bases : ils pèsent
5,4 Gio et l'archive froide n'a que 5,4 Gio de marge. Mieux vaut trois jours de recul
qu'un disque plein le jour où on en a besoin.

```bash
bun scripts/ops/sauvegarde.ts            # complet
bun scripts/ops/sauvegarde.ts --local    # sans envoi distant
bun scripts/ops/sauvegarde.ts --verifier # revérifie les archives présentes
```

## Surveillance

`Restart=always` ne couvre que les crashs : il ne voit pas le cas « processus vivant mais
figé », qui produit un 504 persistant. `rg-watchdog@<service>.timer` sonde donc, toutes
les 60 s, neuf services : trois sondes HTTP consécutives, redémarrage si les trois
échouent, plus un redémarrage préventif si la mémoire du cgroup approche son plafond.

Il s'abstient pendant un déploiement (`deploy.lock`), pendant un redémarrage déjà en
cours, et sur une **5xx applicative** — un 500 signale une application vivante mais
fautive, qu'un redémarrage ferait boucler sans rien corriger.

Un seul service était surveillé avant le 14/8/2026 ; la table des ports et des seuils
vit dans `scripts/rg-watchdog.sh`, pour qu'ajouter un service soit une ligne et non un
fichier de plus à laisser dériver.

```bash
sudo ./scripts/rg-watchdog.sh nie-model-serve   # essai à blanc, n'agit que si nécessaire
systemctl list-timers 'rg-watchdog@*'
```

## Ce qu'il ne faut jamais faire

- **Supprimer un `dist/` ou un `.next/` servi par un service.** Effacer
  `packages/inagle/dist` casse `rg-cron` ; effacer `apps/azalee/.next` met le
  wiki en 500.
- **Créer un lien symbolique sortant de la racine du dépôt.** Turbopack les
  refuse et le build d'azalée échoue — le service reste alors sur un build
  supprimé et l'application devient inutilisable dans le navigateur.
- **Régénérer `bun.lock` avec un Bun 1.4.** La CI et la production lisent du
  `lockfileVersion: 1` ; la v2 leur est illisible.
