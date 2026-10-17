---
title: "Plan des prochaines sessions"
description: "État vérifié au 2026-10-17, procédures de déploiement et chantiers restants"
scope: ["ops", "agents"]
status: "active"
---

# Plan des prochaines sessions

État vérifié le **2026-10-17 UTC**. Cette page complète [PROD-STATUS.md](PROD-STATUS.md) ; en cas de
désaccord sur les ports, unités et routes, `aphrody-infra` fait foi.

## Règles de travail héritées de ces sessions

- Aucun Playwright : captures et audits avec `Bun.WebView` (la fenêtre a au minimum ~504 px de large),
  `aphrody-web`, ou le Chrome MCP (`get_page_text`, console ; ses captures expirent fenêtre masquée).
- Fichiers souvent en CRLF : modifier par remplacement exact avec détection CRLF, jamais en réécrivant
  tout le fichier. Si `bun fmt` reformate des fichiers entiers, annuler et réappliquer à la main.
- Sous Git Bash, préfixer `MSYS_NO_PATHCONV=1` quand un argument commence par `/`.
- Ne jamais redémarrer `rg-core` pendant qu'une tâche longue (`crawl`) tourne : le redémarrage la coupe et
  laisse un bail dans `cron_task_leases` (durée = délai maximal de la tâche) qui bloque son relancement
  (`La tâche « … » tourne déjà`). Supprimer alors la ligne périmée :
  `DELETE FROM cron_task_leases WHERE tache = '<nom>' AND pris_le < now() - interval '30 minutes'`.
- Base de prod : migrations appliquées avec `supabase db query --linked --project-ref xzwfnxzkxtcpgmtqulbh -f <fichier>`
  (rôle propriétaire ; `RG_DATABASE_URL` n'a pas les droits `ALTER`). Fichiers dans
  `apps/rg-website/sql/migrations/` ou `supabase/migrations/`.
- Sur le VPS, `pkill -f` / `pgrep -f` avec un motif présent dans la ligne de commande SSH coupent la
  session : utiliser `pgrep -f "[m]otif"` ou un script copié sur place.

## Déploiement (VPS, depuis GitHub)

Scripts versionnés dans `scripts/deploy/vps/` (à copier dans `/home/ubuntu/build/` sur le VPS) :

| Script | Rôle |
|---|---|
| `lancer-build.sh` | `git reset --hard origin/main` dans `/home/ubuntu/build/rg/repo`, lève le verrou `.next/lock`, lance `run-build.sh` |
| `run-build.sh` | charge `/etc/rg/rg.env` ligne par ligne (les valeurs contiennent `&` et des guillemets : `source` ne marche pas) puis `bun run build` |
| `deploy.sh` | copie `.next/standalone` + `static` + `public` vers `apps/rg/current`, crée `.next/cache` (requis par l'unité), redémarre `rg-website`, supprime l'ancienne release |
| `rebuild-core.sh` | compile `apps/rg-bot` (`bun run compile:core`), installe `/usr/local/bin/rg-core`, redémarre `rg-core` |
| `vnc-up.sh` | bureau virtuel Xvfb `:99` + openbox + `aphrody infra remote serve` (VNC 127.0.0.1:5900, viewer 8795) |

Gates avant déploiement : `bun check apps/rg-website packages/rg-ui packages/rg-app-shell packages/rg-cron packages/rg-types`
et `bun test packages/rg-app-shell`. Un seul build lourd à la fois.

## En production aujourd'hui

- Site : Feed `/feed` (X en direct via la CLI native `aphrody x`, YouTube/TikTok/Instagram via instantanés
  `feed:sync`, redirections `/x` → `/feed`), boutique et paliers Patreon lus en base, profil et paramètres
  façon application mobile, CMS admin (cron réel `/admin/cron`, API et pages `/admin/routes`, gardes
  serveur), page d'audit, sitemap et inventaire des routes synchronisés, `public/vendor` (viewer 3D) restauré.
- `rg-core` : crawl X par `aphrody x` (plus de FFI), `feed:sync` toutes les 30 min (`pg_cron`), corrections du
  navigateur du crawl (`PageWebView.goto`).
- Base : tables OAuth Better Auth migrées en 1.7, colonne `profiles.game_avatar`, planification `rg:feed:sync`.

## Chantiers restants (par priorité)

1. **Crawl complet jamais prouvé** : zukan passe (5 456 personnages), mais aucun run n'est allé au bout sans
   être coupé. Relancer `crawl` seul, sans aucun redéploiement, et lire le bilan (`Cron Runner … crawl`).
   `reddit` répond 403 (étape non critique).
2. **`noctaly:import`** : fonctionne (≈17 min) mais le classement remonte 0 profil, session Noctaly expirée à renouveler.
3. **Avatar du jeu** (`/settings/avatar-jeu`, banque de portraits + code de partage `chara_edit`) : interface jamais vue
   (derrière la connexion), cadrage « buste » de l'aperçu 3D non vérifié.
4. **Instagram / TikTok / YouTube** : lecture limitée sans session (≈12 posts Instagram par compte, ≈10 vidéos TikTok).
   Chemins avec cookies codés (`FEED_INSTAGRAM_COOKIES`, `FEED_TIKTOK_COOKIES`) mais jamais exercés.
   Chaîne YouTube d'Achilléa : lien du site en 404, non listée.
5. **Streaming du vrai jeu** : voir ci-dessous.
6. **Infra** : `azalee.` et `achillea.rosegriffon.fr` répondent 526 (Cloudflare) ; `/api/mode-tex` répond 404
   (`DATA_PATH/mode-tex` absent) ; SMTP 535 ; `credentials-calendar.json` absent ; `SUPABASE_SERVICE_ROLE_KEY` du
   VPS appartient à l'ancien projet ; canal Discord « graphisme / DA » à ajouter à la synchronisation.
7. **Jetons de statut** : `success` / `warning` existent dans `rg-ui` ; `app/achillea/**` utilise encore des palettes brutes.

## Streaming du jeu (Inazuma Eleven: Victory Road)

Constats mesurés :
- Aucune capture du vrai jeu en local. Le jeu (58 Go, appid 2799860) est dans `/home/ubuntu/apps/nie/game` sur le VPS.
- `aphrody-nie-game --play` (réimplémentation Rust) tourne sous Xvfb mais n'affiche qu'un écran titre générique.
- `nie.exe` sous Wine 10 : `E-01000100 Failed to connect to Steam`. Sous Proton Experimental : assertion
  `steam.exe` (pas de client Steam Linux connecté). Il faut un client Steam Linux **connecté** (auto-login en cours
  de configuration par la session `bun-os-ac` à partir du cache `steamcmd` de `darksasuke971`).
- Le VPS n'a pas de GPU (`llvmpipe`, rendu processeur) : « full WebGPU » ne peut pas se calculer côté VPS.
  Voie réaliste : rendre dans le navigateur avec le moteur compilé en wasm (`iecode/packages/nie-ui/rust/nie-wasm`,
  `nie-render3d`), les assets étant servis par `aphrody-nie-model-serve` (127.0.0.1:8792, `/menu-render/` inactif
  faute de `--layout-dir` et `--menu-cfg-dir`).
- Côté bureau : Wayland envisagé (`sway` + `wayvnc`, Proton avec son pilote Wayland, Steam via `Xwayland`).
  `gamescope` est déjà installé ; **aucun paquet Wayland n'est installé** (installation refusée, décision en attente).
- Pour l'intégration au site : `selkies-project/selkies` (MPL-2.0) ou `m1k1o/neko` (Apache-2.0), WebRTC en `iframe`.

Décisions à prendre : paquets Wayland à installer ; examiner `nie-wasm` d'abord ou continuer sur Wayland.

## Sessions parallèles à connaître

- `bun-os-ac` monte la pile Steam/Proton/gamescope/Heroic du VPS, un volume de jeux ext4 sur le disque rapide
  `/games` (ne pas installer de jeux sur `/home`, 15 Mo/s contre 2,1 Go/s) et configure l'auto-login Steam.
  Elle ne tue ni le client Steam ni Xvfb `:99` sans prévenir ; un faux `zenity` existe dans
  `/home/ubuntu/build/fakebin` (à retirer une fois Steam installé). Un Proton Experimental téléchargé par
  `steamcmd` traîne dans `/home/ubuntu/apps/proton` : à supprimer quand Steam aura le sien.
- MCP `nie` installé côté PC (`claude mcp` : `ssh vps /home/ubuntu/.local/bin/nie mcp`) et cinq skills `nie` copiés
  dans `~/.claude/skills`.
