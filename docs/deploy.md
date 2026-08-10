---
title: "Déploiement et exploitation"
description: "Procédures de déploiement des applications et services Rose Griffon sur le VPS"
scope: ["monorepo", "ops"]
status: "stable"
---

# Déploiement et exploitation

Tout tourne sur un **seul VPS**, derrière nginx, en services systemd lancés par
l'utilisateur `ubuntu`. Il n'y a plus aucun déploiement Vercel : les deux
applications Next ont été rapatriées en auto-hébergement.

**Aucun `git push` ne déploie quoi que ce soit.** Un déploiement est toujours
une commande explicite sur la machine.

## Services

| Service systemd | Port | Rôle | Build nécessaire |
| --- | --- | --- | --- |
| `azalee-web` | 3003 | wiki Azalée (Next 16 standalone) | oui |
| `website-web` | 3004 | site principal (Next 16 standalone) | oui |
| `azalee-api` | 8807 | API JSON headless du wiki (41 routes) | non |
| `rg-mcp` | 8808 | serveur Model Context Protocol | non |
| `rag-api` | 8806 | recherche sémantique locale | non |
| `rg-rag-embed` | 8799 | service d'embeddings auto-hébergé | non |
| `rg-cdn` | 8804 | CDN images (`/images`, `/upload`) | non |
| `cdn-variants` | 8805 | redimensionnement + WebP à la volée | non |
| `iecode-cdn` | 8788 | décodage **live** des archives CPK du jeu | non |
| `nie-model-serve` | 8790 | modèles 3D assemblés à la volée | non (binaire Rust) |
| `rg-cron` | — | tâches planifiées | non |
| `azalee-mirror-sync` | — | rafraîchissement quotidien du miroir SQLite | non |

Domaines : `rosegriffon.fr`, `azalee.rosegriffon.fr`, `api.rosegriffon.fr`
(passerelle des outils internes), `cdn.rosegriffon.fr`, `mcp.rosegriffon.fr`.
Les configurations nginx et les unités systemd sont versionnées dans
[`infra/`](../infra).

## Déployer une application Next

```bash
bash scripts/ship-azalee.sh      # wiki
bash scripts/ship-website.sh     # site principal
```

Chaque script enchaîne : build Next → copie du bundle standalone (`public/`,
`.next/static`, `data/`) → redémarrage du service → vérification de santé
locale.

Avant de lancer, vérifier :

```bash
bun run type-check
bun run lint
```

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
sudo systemctl restart rg-mcp.service       # serveur MCP
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
| `rg-cron` en boucle | `packages/inagle/dist` supprimé → `bun run build --filter=@rose-griffon/inagle` puis redémarrer |
| asset du jeu en 404 sur le CDN | le dump est incomplet : le décodage doit passer par le service live, ne jamais rétablir un `=404` dans nginx |
| unité `failed` mais travail réussi | sonde de santé trop précoce après redémarrage — lire le journal jusqu'au bout |

Le serveur MCP expose ces vérifications en outils (`ops_status`, `ops_logs`,
`ops_http`), utilisables depuis n'importe quelle machine.

## Données

Le miroir SQLite des tables `inagle_*` est rafraîchi chaque nuit par
`azalee-mirror-sync.timer` : dump Supabase → validation → échange atomique du
lien `mirror.sqlite` → rétention de deux snapshots → redémarrage des services
concernés. Les consommateurs de la bibliothèque détectent aussi le changement
de fichier tout seuls (vérification d'inode), donc un processus long ne sert
jamais un snapshot périmé.

Corriger une donnée du jeu ne se fait **jamais** dans le miroir : la source est
`packages/inagle`, poussée vers Supabase, puis répliquée. Voir
[`database.md`](database.md) et [`azalee-lib.md`](azalee-lib.md).

## Ce qu'il ne faut jamais faire

- **Supprimer un `dist/` ou un `.next/` servi par un service.** Effacer
  `packages/inagle/dist` casse `rg-cron` ; effacer `apps/azalee/.next` met le
  wiki en 500.
- **Créer un lien symbolique sortant de la racine du dépôt.** Turbopack les
  refuse et le build d'azalée échoue — le service reste alors sur un build
  supprimé et l'application devient inutilisable dans le navigateur.
- **Régénérer `bun.lock` avec un Bun 1.4.** La CI et la production lisent du
  `lockfileVersion: 1` ; la v2 leur est illisible.
