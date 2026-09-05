# Déploiement sans coupure (bleu/vert)

`scripts/ops/deploy.ts` publie le wiki Azalée et le site principal **sans que le service
tombe**, en une commande. Il remplace le `systemctl restart` de `ship-azalee.sh` /
`ship-website.sh`, qui coupait le site le temps du démarrage de Next — et retirait au
passage les fragments `/_next/static/*` de l'ancien build aux onglets déjà ouverts.

```bash
bun run deploy                 # les deux surfaces, build compris
bun run deploy azalee          # une seule
bun run deploy -- --no-build   # publier des artefacts déjà bâtis
bun run deploy:status
```

Mesure sur un déploiement complet des deux applications, build inclus, avec une sonde
HTTP toutes les 200 ms sur les deux domaines publics : **1 558 requêtes, 0 erreur**.

## Ce qui tourne

| | slot A (production) | slot B (doublure) |
| --- | --- | --- |
| Azalée | `azalee-web.service` :3003 | `azalee-web-b.service` :3013 |
| Site | `website-web.service` :3004 | `website-web-b.service` :3014 |

En régime stable, **seul le slot A tourne**. Le slot B n'est démarré que le temps d'une
bascule (ou d'une prévisualisation) puis éteint : rien ne consomme de mémoire en trop.

Les unités sont tenues en dépôt dans `infra/systemd/` — les drop-ins historiques de
`/etc/systemd/system/azalee-web.service.d/` ont été fusionnés dedans (mémoire,
résilience, épinglage du miroir SQLite) pour n'avoir qu'une source de vérité.

## Versions

```
/home/ubuntu/rg-releases/<app>/
  releases/<horodatage>-<BUILD_ID>/   version figée (RELEASE.json : commit, branche)
  slot-a -> releases/<version>        lu par le service de production
  slot-b -> releases/<version>        lu par la doublure
  static -> static-pool-<horodatage>  réservoir de fragments servi par nginx
  state.json / live.env / logs/       état, miroir shell, journaux de publication
```

Une version est assemblée depuis `.next/standalone` **par liens physiques** (`cp -al`) :
quelques milliers d'inodes, pas 1,2 Go recopié. C'est ce qui rend la version immuable —
un `next build` ultérieur remplace les fichiers du dépôt sans jamais toucher un inode
déjà publié, donc sans retirer sous les pieds du processus en cours les fragments de
route qu'il charge à la demande.

`/home/ubuntu/niers/var/mirror.sqlite` est le lien stable du miroir SQLite canonique :
`nie-miroir.timer` permute sa cible par échange atomique, et une version doit voir la
permutation.

Les 5 dernières versions sont conservées (`--keep=n`), ce qui donne un retour arrière
immédiat : `bun scripts/ops/deploy.ts rollback azalee` (ou `--to=<version>`).

## La séquence, et pourquoi elle est dans cet ordre

1. **Garde-fous** — type-check du workspace, mémoire disponible, espace disque,
   configuration nginx déjà valide.
2. **Build** — retenté jusqu'à 3 fois. Le succès se juge sur les **artefacts**
   (`BUILD_ID` frais + `server.js` standalone), jamais sur le code de sortie : Next 16
   sous Bun sort en 132 après un build pourtant complet, et écrit parfois `BUILD_ID`
   sans émettre le standalone.
3. **Assemblage** de la version + reconstruction du réservoir de fragments.
4. **Slot B** démarre sur la nouvelle version et est **sondé** : `/api/health`, puis des
   pages réelles. Un build cassé répond souvent 200 sur `/api/health` (route isolée) et
   500 sur tout ce qui touche la couche données.
5. **Bascule nginx → B**, puis attente du drainage.
6. **Slot A** reprend la même version, sondé à son tour.
7. **Bascule nginx → A**, drainage, extinction de B.

Un échec avant l'étape 5 laisse la production intacte. Un échec après la laisse sur B,
qui sert le nouveau code : dégradé (un seul slot), jamais coupé.

## Les trois pièges qui cassent une prod pendant un déploiement

### 1. Les fragments statiques qui disparaissent

nginx sert `/_next/static/` depuis `rg-releases/<app>/static`, un **réservoir** qui
contient l'union des `.next/static` des dernières versions. Un onglet ouvert avant le
déploiement retrouve donc ses fragments au lieu d'un 404 suivi d'un rechargement forcé.
Les noms étant hachés par contenu, l'union ne peut pas produire de collision.

Next 16 sait poser un suffixe `?dpl=<deploymentId>` sur les URL d'assets
(`globalThis.NEXT_CLIENT_ASSET_SUFFIX`, cf. `next/dist/server/base-server.js`), et
`experimental.useSkewCookie` existe — mais en auto-hébergement **aucun routeur
n'exploite ce paramètre** : c'est la plateforme Vercel qui s'en sert pour router vers
l'ancien déploiement. Le hachage par contenu, lui, suffit ici. On ne l'active donc pas :
ce serait une configuration en plus, un rebuild par version, et zéro bénéfice réel.

### 2. Les workers nginx qui drainent

`systemctl reload nginx` rend la main dès que le maître a reçu le signal, mais les
anciens workers finissent leurs connexions **avec l'ancienne configuration**, donc en
proxyfiant vers l'ancien port. Redémarrer le slot sortant avant leur extinction produit
des 502 — mesuré : 1 requête sur 77 lors d'un essai.

Le script attend donc la disparition des **PID** de workers d'avant le rechargement (pas
le titre « shutting down », qui n'apparaît qu'après quelques millisecondes et ferait
conclure trop tôt). `install` pose `worker_shutdown_timeout 30s` dans `nginx.conf` pour
borner cette attente : sans elle, une connexion longue (SSE) maintiendrait indéfiniment
un ancien worker.

### 3. La mémoire

Deux instances Next coexistent pendant la bascule. Un déploiement qui déclenche l'OOM
killer coûterait exactement ce qu'il prétend éviter. Avant de démarrer la doublure, le
script exige `MemAvailable ≥ empreinte du slot vivant + 1 Gio` — vérification rejouée
juste avant le démarrage, car un build entier s'est écoulé depuis les garde-fous
d'entrée. `--allow-low-memory` passe outre en connaissance de cause.

Empreintes observées : Azalée ~410 Mio au démarrage (le miroir SQLite se charge à la
demande), site ~180 Mio.

## Prévisualisation

```bash
bun scripts/ops/deploy.ts preview azalee     # → URL d'activation
bun scripts/ops/deploy.ts promote azalee     # passe cette version en production
bun scripts/ops/deploy.ts preview-off azalee # rend la mémoire
```

`preview` publie une version sur le slot B **sans toucher à la production**, et la rend
joignable **sur le domaine public** à ceux qui portent le cookie `rg_preview`. nginx
choisit l'amont par cookie :

```nginx
map $cookie_rg_preview $azalee_backend {
    default        azalee_web;
    "<jeton>"      azalee_preview;
}
```

Sans cookie — donc pour tout le monde — la variable vaut l'amont de production : le
comportement par défaut est rigoureusement inchangé. Le point d'entrée `/__preview?token=…`
pose le cookie, `/__preview?off=1` le retire. Sans prévisualisation active, la table ne
contient plus que sa ligne par défaut : un vieux cookie retombe sur la production au lieu
d'un 502.

Cette approche évite d'avoir à créer un sous-domaine, un enregistrement DNS et un
certificat pour chaque prévisualisation.

## Piloter à distance

- **MCP** (`packages/mcp`) : `deploy_status` en lecture, `deploy_run` en portée `admin`.
  La publication est **détachée** — un build dépasse largement la durée d'un appel MCP —
  et l'avancement se suit avec `deploy_status` (`logLines` > 0).
- **GitHub Actions** : `.github/workflows/deploy.yml`. Le runner ne construit rien : il
  déclenche la même mécanique via MCP (secret `RG_MCP_ADMIN_TOKEN`), puis attend la fin.
  La publication automatique sur poussée demande la variable `DEPLOY_ON_PUSH=true`.

## Conséquences ailleurs

- `scripts/ship-azalee.sh` / `ship-website.sh` sont conservés mais délèguent ici.
- `niers/scripts/donnees/miroir-inagle.sh` publie le miroir par échange atomique ; le
  wiki ne tombe pas pendant la permutation et ses lecteurs réouvrent le handle si
  l'inode change.
- `scripts/azalee-watchdog.sh` lit `rg-releases/azalee/live.env` pour sonder le slot
  **vivant**, saute son tour tant que `deploy.lock` existe, et relance le slot vivant
  s'il est arrêté (cas d'un redémarrage machine alors que la production était sur B).

## Installation / réinstallation

```bash
bun run deploy:install          # idempotent, les deux surfaces
```

L'installation prouve la nouvelle disposition sur la doublure **avant** de réécrire
l'unité de production, sauvegarde les fichiers nginx touchés (`*.bak-bleu-vert-*`) et
restaure la configuration si `nginx -t` la refuse.
