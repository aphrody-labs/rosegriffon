# Achillea — intégration dans l'écosystème Rose Griffon

Design / plan d'intégration d'**Achillea** (dashboard communautaire Inazuma Eleven — repo séparé
`rose-griffon/achillea`, front **Angular 21** auto-hébergé) dans l'écosystème RG : API distante sur
`api.rosegriffon.fr`, assets sur `cdn.rosegriffon.fr`, SEO aligné sur le monorepo RG, et intégration
cross-site entre les **3 sites**.

> Statut : **document de conception** pour les sections 1 à 7. La première passerelle réelle,
> elle, est en service depuis le 14/8/2026 — voir la section ci-dessous. Le code Achillea vit
> dans son propre dépôt ; ce doc décrit les points de contact côté monorepo RG.

## Passerelle en service — guildes, rôles et salons (14/8/2026)

Le bot Achillea expose `GET /guilds`, `/guilds/stats` et `/guilds/:id` (métadonnées d'un
serveur Discord **avec** ses rôles et ses salons). Le monorepo RG les consomme désormais.

**Deux choses étaient cassées, et ne le sont plus.** Le contrôleur `/guilds` se disait,
en commentaire, alimenté par `scripts/ops/discord/scan-guilds.ts --db` — un script qui
n'existait pas : `guild_role` et `guild_channel` étaient vides, les 76 lignes de `guild`
avaient toutes leurs colonnes de scan à `NULL`, et l'API répondait `{"data":[],"total":0}`.
Le script a été écrit côté Achillea et branché sur son refresh nocturne ; le premier
passage a relevé **102 rôles et 113 salons** pour le serveur Achillea. Et un serveur jamais
scanné répond `200` avec des champs nuls : la commande le **dit** au lieu d'afficher une
fiche vide qui ressemblerait à un serveur désert.

**Côté RG, en deux couches.** `apps/bot/src/services/achillea.ts` porte le transport et
des schémas **Zod** — aucun type TypeScript ne traverse la frontière entre les deux
dépôts, donc un `fetch` nu rendrait `any` et une colonne renommée là-bas s'afficherait
ici en `undefined` des mois plus tard. Les schémas produisent les types **et** vérifient
la réponse à l'exécution : une dérive devient une erreur nommée, avec le champ fautif.
`apps/bot/src/lib/achillea-format.ts` porte la mise en forme (types de salons, groupement
par catégorie, découpage au budget de 1 024 caractères d'un champ d'embed), testée sans
Discord.

Commandes : `/achillea serveur`, `/achillea roles`, `/achillea salons`, `/achillea scan`.

L'adresse de l'API est configurable par `ACHILLEA_API_URL` ; par défaut la boucle locale
(`http://127.0.0.1:4000`), les deux bots tournant sur la même machine. **Cette section
corrige la table ci-dessous** : Achillea n'est plus servi depuis le VPS `51.255.162.6`,
son bot et son front tournent sur le VPS principal.

## 0. État vérifié (tests live — 2026-06-04)

| Endpoint | Résultat | Note |
| --- | --- | --- |
| `https://rosegriffon.fr/` | **200** HTML | Next.js SSR (lang fr) |
| `https://azalee.rosegriffon.fr/` | **200** HTML | Next.js SSR (dark) |
| `https://api.rosegriffon.fr/health` | **200** `{"status":"ok"}` | stub |
| `https://api.rosegriffon.fr/` (autre route) | **404** `{"error":"unknown service"}` | **rien d'autre que /health** |
| `https://ranked.rosegriffon.fr/api/health` | **200** | backend Achillea (bot) |
| `…/api/tournaments?page=1` | **200** (données réelles) | lecture OK |
| `…/api/clans?page=1` | **200** (vide en local) | lecture OK |
| `…/api/auth/me` · `…/api/ranked/me` | **401** | auth-gated (attendu) |
| `https://cdn.rosegriffon.fr/` | **404** | pas de listing |
| `cdn.rosegriffon.fr/images/<hash invalide>` | **403** | validation content-addressed |
| `https://achillea.rosegriffon.fr/` | **200** | front Achillea (nginx, VPS `51.255.162.6`) |

> ⚠️ **Images legacy mortes** : d'anciennes lignes `image` (ancienne prod Achillea) pointent sur
> `https://api.alessf.fr/images/<id>` qui **ne répond plus (000)**. Le bot actuel écrit pourtant sur
> `cdn.rosegriffon.fr` (`IMAGE_SERVER_URL`) → **migrer / réécrire les URLs legacy** vers le CDN.

## 1. Écosystème — les 3 sites

| Site | Domaine | Stack | Rôle |
| --- | --- | --- | --- |
| **website** | `rosegriffon.fr` | Next.js 16 (`apps/website`) | site principal RG : shop, chroniques, articles |
| **azalee** | `azalee.rosegriffon.fr` | Next.js 16 (`apps/azalee`) | wiki Inazuma (personnages, items, keshins…) |
| **achillea** | `achillea.rosegriffon.fr` | Angular 21 (repo `rose-griffon/achillea`) | dashboard communautaire : clans, tournois, ranked, casts |

Infra partagée : `api.rosegriffon.fr` (stub nginx, `/health`), `cdn.rosegriffon.fr` (service CDN d'images
`cdn.service`), backend Achillea sur `ranked.rosegriffon.fr` (bot Bun :4002/:4000).

## 2. API distante Achillea sur `api.rosegriffon.fr`

Aujourd'hui l'API Achillea est exposée sur **`ranked.rosegriffon.fr/api/*`** (consommée par le front via
les rewrites de son nginx). `api.rosegriffon.fr` n'est qu'un **stub** (`/health`, vérifié). Objectif : en faire la
**passerelle API unifiée** de l'écosystème, avec un préfixe par produit.

### Proposition
- `api.rosegriffon.fr/achillea/*` → proxy vers le bot Achillea (`127.0.0.1:4002`, l'entrypoint Colyseus+REST
  qui proxie déjà `/api` vers le TSed `:4000`).
- Conserver `ranked.rosegriffon.fr` (WSS Colyseus + REST actuel) pour compat ; `api.rosegriffon.fr/achillea`
  devient l'alias canonique « API publique ».

```nginx
# /etc/nginx/conf.d/api.rosegriffon.conf — ajouter :
location /achillea/ {
    proxy_pass         http://127.0.0.1:4002/api/;   # strip /achillea/ -> /api/
    proxy_http_version 1.1;
    proxy_set_header   Host $host;
    proxy_set_header   X-Forwarded-Proto https;
    proxy_set_header   X-Forwarded-Host $host;       # requis : OAuth callback du bot lit x-forwarded-host
    proxy_read_timeout 30s;
}
```

### Points d'attention
- **CORS** : ajouter `https://api.rosegriffon.fr` aux `WEB_ALLOWED_ORIGINS` du bot (`apps/bot/.env`).
- **OAuth Discord** : `redirect_uri` dérivé de `x-forwarded-host` → si l'auth passe par `api.rosegriffon.fr`,
  déclarer aussi `https://api.rosegriffon.fr/achillea/auth/callback` dans le Discord Developer Portal.
  Sinon réserver `api.rosegriffon.fr/achillea` aux endpoints **lecture** et garder l'auth sur le domaine front.
- **Endpoints vérifiés** : `/tournaments`, `/clans` → 200 ; `/auth/me`, `/ranked/me` → 401 (auth). Autres servis
  par le bot : `/users/*`, `/notifications/*`, `/casts/*`, `/sanctions/*`, `/organizations/*`, `/admin/lobbies/*`
  (toutes les routes ne sont pas publiques ; certaines `/misc/*` renvoient 404 selon le sous-chemin).
- **Versionnage** : préfixer `/achillea/v1/` pour figer le contrat si l'API devient publique.

## 3. Assets Achillea sur `cdn.rosegriffon.fr`

**Déjà en place** : le bot Achillea pousse déjà ses **cartes joueurs / posters de clan générés**
(`@aphrody-code/canvas` → `PlayerCardService`, `ClanPosterService`) vers le CDN via
`IMAGE_SERVER_URL=https://cdn.rosegriffon.fr` (auth `IMAGE_SERVER_API_KEY`). Le CDN `cdn.rosegriffon.fr`
(`cdn.service`) est content-addressé : upload `POST /upload`, lecture `GET /images/<hash>.<ext>` (403 si hash
invalide — vérifié).

**Reste à faire** :
- **Assets statiques du front** (`apps/web/public/` — `ranks/`, `flags/`, `achillea-banner.png`, animations…)
  encore servis par le VPS Achillea → à migrer sur le CDN partagé (même `/upload`).
- **URLs legacy** (`api.alessf.fr`, host mort) référencées dans la table `image` → réécrire vers `cdn.rosegriffon.fr`.

### Front Angular
- Pointer les assets sur `https://cdn.rosegriffon.fr/...` + `<link rel="preconnect" href="https://cdn.rosegriffon.fr">`
  (le préconnect `__RANKED_ORIGIN__` couvre déjà `ranked.`).

### Bénéfices
Pipeline d'images unifié (cartes déjà dessus), cache long partagé, moins de bande passante sur le VPS Achillea,
invalidation centralisée.

## 4. SEO Achillea — calqué sur le monorepo RG

Achillea est une **SPA Angular (CSR, pas de SSR)** → handicap SEO majeur (HTML quasi vide au crawl).
Aligner sur l'approche `docs/la stratégie SEO du dépôt` (website + azalee, **vérifié** : `generateMetadata`,
`StructuredData` JSON-LD, `sitemap.ts` dans les deux apps) :

| Levier | website / azalee (réf.) | Achillea (à faire) |
| --- | --- | --- |
| Rendu | SSR/SSG Next.js | **Prerender Angular** (`@angular/ssr`) sur les routes publiques (`/clans/:id`, `/tournaments/:id`, `/chara/...`) |
| `<title>` / meta | `generateMetadata` par page | service `Title`/`Meta` Angular + `@angular/ssr` ; titres uniques par entité |
| Open Graph / Twitter | oui | balises OG/Twitter par route (image via CDN) |
| Données structurées | JSON-LD (`StructuredData`) | JSON-LD `BreadcrumbList`, `Organization`, `SportsTeam`/`Event` pour clans/tournois |
| Canonical | oui | `<link rel="canonical">` par route |
| `sitemap.xml` | `app/sitemap.ts` | sitemap dynamique (routes + entités) — **absent** côté Achillea (vérifié) |
| `robots.txt` | oui | ✅ déjà présent (statique) |

> **Priorité** : sans prerender, Google n'indexe que l'index. `@angular/ssr` (prerender des pages entité)
> = gain SEO #1, puis sitemap + JSON-LD + OG. Réutiliser les conventions titres/OG de `la stratégie SEO du dépôt`.

## 5. Intégration cross-site (home des 3 sites)

Aujourd'hui les 3 sites ne se renvoient quasiment pas (liens épars). Objectif : un **maillage écosystème**
cohérent, mutualisé.

### a. Composant partagé « écosystème »
- Ajouter dans **`packages/ui`** un composant `EcosystemNav` / `EcosystemFooter` (logo + lien + 1 phrase),
  réutilisé par `website` et `azalee` (porté en Angular pour Achillea).
- **Source unique** des sites exportée depuis **`packages/ui`** (`@rosegriffon/config` est réservé au
  tooling : tsconfig/tailwind/oxlint, pas de data runtime — vérifié). Atout : Achillea embarque déjà
  `rg-logo.png` + `azalee-logo.png` dans `apps/web/public/` (cross-branding amorcé).

```ts
// packages/ui — source unique des sites de l'écosystème
export const RG_SITES = [
  { id: "website", name: "Rose Griffon", url: "https://rosegriffon.fr", desc: "Le hub de la communauté" },
  { id: "azalee",  name: "Azalée",       url: "https://azalee.rosegriffon.fr", desc: "Le wiki Inazuma Eleven" },
  { id: "achillea",name: "Achillea",     url: "https://achillea.rosegriffon.fr", desc: "Clans, tournois & ranked" },
] as const;
```

### b. Home pages
- **rosegriffon.fr** : section « L'écosystème » (cartes Azalée + Achillea, CTA wiki / ranked).
- **azalee.rosegriffon.fr** : bandeau/foot vers Achillea (ranked/clans) + site principal.
- **achillea** : home avec liens vers Azalée (fiches personnages) + rosegriffon.fr.

### c. SEO du maillage
- Liens **réciproques** crawlables entre les 3 domaines (autorité partagée).
- `Organization` JSON-LD avec `sameAs` listant les 3 domaines + réseaux.
- Domaine `achillea.rosegriffon.fr` en place (200, nginx) — le sous-domaine RG consolide le SEO.

## 6. Cron & types (écosystème)

- **Cron RG** = `rg-cron.service` → `bun run src/index.ts` dans `packages/cron` (tâches `tasks/` +
  `check_team_members.ts` ; schedules `*/15`, `*/30`, `0 2`, `45 2`, `0 3`, `0 4`). Route vers
  `azalee.rosegriffon.fr` / `rosegriffon.fr`. **Ne touche pas Achillea.**
- **Cron Achillea** = interne au bot (décorateur `@Schedule` maison basé sur `cron` + tsyringe :
  backup DB, rappels casts, transitions de phases…). Séparé du cron RG.
- **Types** : deux paquets de contrats distincts, sans recouvrement —
  `@rosegriffon/types` (`article`, `stream`, `team`, `stats`, `user`, `roles`, `event`…) côté RG ;
  `@achillea/types` (enums `clanState`, `clanMemberRole`, `userRole`, `eventEnums`) côté Achillea.
  Pour qu'un site RG consomme l'API Achillea de façon typée, publier/partager un sous-ensemble de contrat
  (DTO `clans`/`tournaments`) — sinon typage manuel côté consommateur.

## 7. Roadmap proposée

1. **Cross-site** (rapide, fort impact marque/SEO) : `RG_SITES` dans `packages/ui` + `EcosystemNav`/footer
   sur website & azalee + liens home.
2. **CDN** : migrer les **assets statiques du front** Achillea vers `cdn.rosegriffon.fr/images/<hash>`
   (cartes/posters déjà dessus) + réécrire les URLs legacy `api.alessf.fr`.
3. **API gateway** : `location /achillea/` sur `api.rosegriffon.fr` (lecture d'abord ; auth ensuite).
4. **SEO Achillea** : `@angular/ssr` prerender + sitemap + JSON-LD/OG ; domaine `achillea.rosegriffon.fr`.

## Références

- docs/la stratégie SEO du dépôt · [docs/REPO_MAP.md](REPO_MAP.md) · [docs/deploy.md](deploy.md)
- CDN : endpoint `cdn.rosegriffon.fr` (`cdn.service`, content-addressé `/images/<hash>` + `/upload`) ·
  nginx `conf.d/cdn.rosegriffon.conf`, `api.rosegriffon.conf`
- Repo Achillea : `rose-griffon/achillea` (front `apps/web`, bot `apps/bot`, `docs/supabase-prod.md`)
