# Règle Absolue de Cloisonnement des Hôtes VPS (Strict Host Partitioning)

Date : 2026-09-09
Auteur : Akihiro Hino x Byron Love x Sovereign Autonomous Engine

---

## 1. VPS DBFR (`51.255.162.6`) — Sanctuaire Exclusif Dragon Ball / Shenron

Le serveur `dbfr` est **STRICTEMENT et UNIQUEMENT** réservé à l'écosystème Dragon Ball FR et au monorepo `shenron`.

- **Domaine principal :** `dragonballfr.com`
- **Monorepo :** `/home/ubuntu/shenron`
- **Services autorisés et actifs :**
  - `shenron-site.service` (Next.js 16 sur port `:3000`)
  - `shenron-mcp.service` (Serveur MCP public Dragon Ball sur port `:5010`)
  - `shenron.service` (Bot Discord DBZ — Bun + discordx)
  - `shenron-embed.service` (Sidecar embeddings RAG — multilingual-e5-small)
- **Base de données :** PostgreSQL (`5432`), Redis (`6379`)
- **Interdiction Formelle :** Aucun service étranger (Inazuma Eleven, Level-5, Niers, BXC, Rose Griffon, N2B) ne doit être déployé ou exécuté sur `dbfr`.

---

## 2. VPS Principal (`51.77.147.152` / `vps`) — Centre de Gravité Souverain

Le serveur `vps` héberge **TOUT LE RESTE** de l'écosystème :

- **Domaines :**
  - `aphrody.com` : API directe racine / VFS healthz (`:8085`)
  - `api.aphrody.com` : API lecture seule (`/api/v1/`, `/f/`, `/b`) (`:8085`)
  - `nie.aphrody.com` : Vitrine Inazuma Eleven Victory Road & 3D models (`:8085` / `:8790`)
  - `bxc.aphrody.com` : Vitrine de reconnaissance web et browser automation (`:8084`)
  - `n2b.aphrody.com` : Vitrine et distribution du CLI Node->Bun (`:8086`)
  - `azalee.rosegriffon.fr` : Plateforme Rose Griffon (`:3003`)
- **Monorepos & Projets :**
  - `/home/ubuntu/niers` (Inazuma Eleven VR, Nie VFS, G4 engine)
  - `/home/ubuntu/rg` (Rose Griffon, Azalée bot, tournois)
  - `/home/ubuntu/bxc` (Crawler furtif, scraping, MCP natif)
  - `/home/ubuntu/aphrody` (CLI orchestrateur, A2A, télémétrie SSH)
- **Services actifs :**
  - `nie-site.service` (`:8085`)
  - `nie-model-serve.service` (`:8790`)
  - `nie-cron.service`
  - `azalee-web.service` (`:3003`)
  - `rg-cdn.service` (`:8804`)
  - `rg-bot.service`
  - `azalee-bot.service`
  - `bxc-site.service` (`:8084`)
