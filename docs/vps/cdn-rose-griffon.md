# cdn.rosegriffon.fr — CDN multi-surface (uploads + static Next.js)

> Live depuis 2026-04-30. Sert les assets statiques de **azalee.rosegriffon.fr** et **rosegriffon.fr** + l'API d'upload d'images (héritée de `api.alessf.fr`).

## Vue d'ensemble

```
                                    ┌─ /upload + /images/<id>     → Bun :8804 (apps/cdn/server.ts)
cdn.rosegriffon.fr  → nginx  ───────┤
                                    └─ /static/<app>/...           → /var/www/cdn/static/<app>/ (statique)
                                                                       ├─ public/        ← apps/<app>/public/
                                                                       └─ _next/static/  ← apps/<app>/.next/static/
```

**2 surfaces, 1 vhost** :
1. **API uploads** (legacy) : `POST /upload` + `DELETE /images/<id>` proxy vers Bun port 8804, storage `/var/www/cdn/images/`. Pattern fichier `[a-f0-9]{16}.<ext>`.
2. **Static Next.js** (Phase 1+2) : `GET /static/<app>/...` servi directement par nginx depuis `/var/www/cdn/static/<app>/`. Cache-busting via hash dans le path Next + `Cache-Control: public, immutable, max-age=31536000`.

## Stack

| Composant | Détail |
|---|---|
| nginx | 1.28.3, modules `gzip_static` + `brotli_static` + `http_v2` + `http_v3` + `slice` + `threads` |
| Cert TLS | Let's Encrypt `/etc/letsencrypt/live/cdn.rosegriffon.fr/` |
| Bun (uploads API) | `apps/cdn/server.ts`, port 8804, systemd `cdn.service` (User=ubuntu, hardened) |
| Storage | `/var/www/cdn/images/` (uploads) + `/var/www/cdn/static/<app>/` (Next assets) |
| Sync script | `scripts/ops/cdn-sync.ts` (Bun, idempotent, parallèle, brotli + gzip) |

## Apps activées

| App | Vhost origin | Phase 1 (assetPrefix) | Phase 2 (loader Image) |
|---|---|---|---|
| azalee | azalee.rosegriffon.fr | ✅ | ✅ |
| website | rosegriffon.fr | ✅ | ✅ |
| rpb-dashboard | rpbey.fr | ❌ (non opted-in) | ❌ |

## Configuration nginx

Fichier source : `infra/nginx/cdn.rosegriffon.conf` → déployé dans `/etc/nginx/conf.d/cdn.rosegriffon.conf`.

### Best-practices appliquées

```nginx
# Transmission zero-copy
sendfile           on;
sendfile_max_chunk 1m;
tcp_nopush         on;
tcp_nodelay        on;
keepalive_timeout  65s;
keepalive_requests 1000;

# Descripteurs FD + métadonnées en RAM (gain massif sur petits fichiers)
open_file_cache          max=10000 inactive=60s;
open_file_cache_valid    60s;
open_file_cache_min_uses 2;
open_file_cache_errors   on;

# Pré-compression
brotli_static on;        # priorité 1 (Accept-Encoding: br)
gzip_static   on;        # priorité 2 (Accept-Encoding: gzip)
gzip_vary     on;

# Logs allégés
access_log /var/log/nginx/cdn.rosegriffon.fr.access.log combined buffer=64k flush=5s;
```

### Headers static `/static/<app>/`

```nginx
expires off;     # géré explicitement via Cache-Control unique
etag off;
add_header Alt-Svc                  'h3=":443"; ma=86400'                     always;
add_header Cache-Control            "public, immutable, max-age=31536000"     always;
add_header Access-Control-Allow-Origin "*"                                     always;
add_header Cross-Origin-Resource-Policy "cross-origin"                         always;
add_header X-Content-Type-Options   "nosniff"                                  always;
access_log off;
```

### Whitelist apps

```nginx
location ^~ /static/ {
    location ~ "^/static/(?!azalee/|website/)" { return 404; }
    alias /var/www/cdn/static/;
    ...
}
```

### MIME types (sous-bloc complet)

`types {}` dans une location nginx **OVERRIDE** `mime.types` global → on déclare tout :

```nginx
types {
    application/javascript    js mjs;
    application/json          json map;
    application/manifest+json webmanifest;
    application/wasm          wasm;
    font/woff                 woff;
    font/woff2                woff2;
    image/avif                avif;
    image/webp                webp;
    image/svg+xml             svg svgz;
    # … cf. fichier source
}
```

## Storage

```
/var/www/cdn/
├── images/                          # uploads API (heritage api.alessf.fr)
│   └── [a-f0-9]{16}.{png,jpg,webp,gif,svg}
└── static/
    ├── azalee/
    │   ├── public/                  # miroir apps/azalee/public/
    │   │   ├── *.webp + *.gz + *.br
    │   │   ├── locales/{fr,en,ja}.json + .gz + .br
    │   │   └── fonts/*.woff2
    │   └── _next/static/            # miroir apps/azalee/.next/static/
    │       ├── chunks/*.js + .gz + .br
    │       ├── css/*.css + .gz + .br
    │       └── media/*.{woff2,otf}
    └── website/                     # idem pour website
```

Permissions : `chown ubuntu:www-data ; chmod 0775` sur `/var/www/cdn/static/{azalee,website}/`.

## Sync workflow

### Script `scripts/ops/cdn-sync.ts`

```bash
bun scripts/ops/cdn-sync.ts azalee website                    # sync incrémental
bun scripts/ops/cdn-sync.ts --dry-run azalee                  # plan sans exécution
bun scripts/ops/cdn-sync.ts --no-compress website             # skip .gz/.br
bun scripts/ops/cdn-sync.ts --root=/tmp/cdn azalee            # destination custom
bun scripts/ops/cdn-sync.ts --concurrency=16 azalee website   # tune parallélisme
```

### Optimisations

| Technique | Gain |
|---|---|
| Fast-path `mtime + size` (skip hash) | sync idempotent en **~50 ms** |
| Parallélisme `pMap` (concurrency=8) | full sync en **~7 s** (vs 30+ s séquentiel) |
| `Bun.gzipSync` + `node:zlib brotliCompressSync` | pas de subprocess, niveau 9/11 |
| Batch `mkdir -p` via `node:fs/promises` | évite 1 fork par dir |
| Batch `unlink` parallélisé | suppression orphelins rapide |

### Statistiques live

```
azalee   : 257 public + 110 _next/static = 367 fichiers, 8.6 MiB → 1.24 MiB gz, 1.06 MiB br (~85% saved)
website  : 143 public + 120 _next/static = 263 fichiers, 43.4 MiB → 898 KiB gz, 781 KiB br (~98% saved)
```

### Hook safe-deploy

`scripts/ops/safe-deploy.sh` appelle automatiquement `cdn-sync.ts` post-build (avant smoke + restart) pour les apps `azalee|website`. Échec sync = warning non fatal (la prod fonctionne sans CDN).

## Activation côté Next.js

### Vars d'env (build-time, NEXT_PUBLIC_*)

```bash
# apps/<app>/.env (lu par Next au build ET par systemd au runtime)
NEXT_PUBLIC_CDN_URL=https://cdn.rosegriffon.fr/static/azalee   # Phase 1 : assetPrefix
NEXT_PUBLIC_CDN_LOADER=1                                       # Phase 2 : loader Image
```

### Patches `next.config`

**Azalee** (`apps/azalee/next.config.ts`) :

```ts
const CDN_URL    = process.env.NEXT_PUBLIC_CDN_URL?.trim() || "";
const CDN_ORIGIN = CDN_URL ? new URL(CDN_URL).origin : "";
const CDN_LOADER = CDN_URL && process.env.NEXT_PUBLIC_CDN_LOADER === "1";

const nextConfig: NextConfig = {
  ...(CDN_URL && { assetPrefix: CDN_URL }),

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.rosegriffon.fr", pathname: "/**" },
      // … autres
    ],
    ...(CDN_LOADER && {
      loader: "custom",
      loaderFile: "./cdn-loader.js",
    }),
  },

  async headers() {
    const cdnSrc = CDN_ORIGIN ? ` ${CDN_ORIGIN}` : "";
    const cspHeader = [
      `script-src 'self' 'unsafe-inline'${cdnSrc} ...`,
      `style-src 'self' 'unsafe-inline'${cdnSrc}`,
      `img-src 'self' blob: data:${cdnSrc} ...`,
      `font-src 'self'${cdnSrc}`,
      `connect-src 'self'${cdnSrc} ...`,
    ].join("; ");
    return [{ source: "/(.*)", headers: [{ key: "Content-Security-Policy", value: cspHeader }, ...] }];
  },
};
```

**Website** (`apps/rosegriffon/config/next.config.mjs`) : même pattern, sans CSP custom (pas de header CSP côté website).

### Loader custom `cdn-loader.js`

`apps/{azalee,website}/cdn-loader.js` :

```js
export default function cdnLoader({ src, width, quality }) {
  const cdn = process.env.NEXT_PUBLIC_CDN_URL;
  if (!cdn) return src;
  if (/^https?:\/\//i.test(src)) return src;     // URL absolue → pass-through
  const path = src.startsWith("/") ? src : `/${src}`;
  const q = quality ?? 75;
  return `${cdn}/public${path}?w=${width}&q=${q}`;
}
```

**Effet Phase 2** : `<Image src="/logo.webp">` → `<img srcset="https://cdn.rosegriffon.fr/static/<app>/public/logo.webp?w=32&q=75 32w, ...">` — aucun appel à `/_next/image`, Sharp côté Next totalement déchargé.

## Tests / verification

### Curl pattern

```bash
# Phase 1 — assetPrefix actif ?
curl -s https://azalee.rosegriffon.fr/ | grep -oE 'cdn\.rosegriffon\.fr/static/azalee/_next/static/[^"]+' | head -3

# Phase 2 — loader actif ?
curl -s https://rosegriffon.fr/ | grep -c '_next/image'   # doit retourner 0

# Compression negotiation
curl -sI -H 'Accept-Encoding: br'   https://cdn.rosegriffon.fr/static/azalee/_next/static/chunks/X.js  | grep content-encoding   # br
curl -sI -H 'Accept-Encoding: gzip' https://cdn.rosegriffon.fr/static/azalee/_next/static/chunks/X.js  | grep content-encoding   # gzip

# Health
curl -s https://cdn.rosegriffon.fr/health   # {"ok":true,"storage":"/var/www/cdn/images"}
```

### Smoke complet automatisé

```bash
bash scripts/ops/check-status.sh   # status nginx + services + healthchecks
```

## Pièges connus

### nginx

1. **`types {}` sous-bloc OVERRIDE le mime.types global** — déclarer un partial casse tout. Solution : redéclarer tous les MIME utilisés.
2. **`add_header` dans `location` REMPLACE le parent** — dès qu'une location ajoute un seul header, tous les `add_header` du `server` sont ignorés. Solution : re-déclarer chaque header voulu (Alt-Svc, CORS, CORP, …).
3. **`expires off` nécessite `restart`, pas `reload`** — un reload peut garder le contexte précompilé et émettre encore Cache-Control en doublon. Solution : `systemctl restart nginx` (one-shot pour ce changement).
4. **Brotli double : runtime + static** — `nginx.conf` global a `brotli on; brotli_comp_level 6;` → fallback runtime sur tout type éligible même sans `.br`. Le `brotli_static on` du vhost CDN sert de cache disque prioritaire pour les assets pré-générés (quality 11 > 6).

### cdn-sync.ts

5. **`Bun.$` rejette les NUL bytes** — pas possible de passer `paths.join("\0")` à `xargs -0`. Solution : utiliser `Bun.spawn(["xargs", ...], { stdin: "pipe" })` ou switcher vers `node:fs/promises mkdir/unlink` (plus rapide qu'un subprocess).

### Next.js + assetPrefix

6. **`assetPrefix` ne couvre QUE `/_next/static/*`** — pas `public/`, pas `/_next/image`, pas `/_next/data/`. Pour décharger `public/` il faut soit modifier les `<Image src>` en absolus, soit activer le loader custom (Phase 2).
7. **`images.loader: 'custom'` est binaire** — toutes les `<Image>` passent par le loader, plus aucune optimization Next runtime. OK si les assets `public/` sont déjà en webp/avif (notre cas).
8. **`NEXT_PUBLIC_*` inliné au build time** — le toggle nécessite un rebuild + restart. Ne PAS confondre avec une var runtime.

## Backup / rollback

### Backup initial migration

```
/var/backups/cdn-migration-20260430-210839/
├── cdn.rosegriffon.live.conf       # vhost nginx avant modif
├── cdn.rosegriffon.repo.conf       # version repo avant modif
├── azalee-public.tar.gz            # snapshot apps/azalee/public/
└── website-public.tar.gz           # snapshot apps/rosegriffon/public/
```

Pointer : `/var/backups/cdn-migration.LATEST` contient `BACKUP_DIR=...`.

### Rollback Phase 2 (loader Image)

```bash
sed -i '/^NEXT_PUBLIC_CDN_LOADER=/d' apps/azalee/.env
sed -i '/^NEXT_PUBLIC_CDN_LOADER=/d' apps/rosegriffon/.env
bash scripts/ops/safe-deploy.sh azalee
bash scripts/ops/safe-deploy.sh website
# → Next reprend /_next/image (Sharp re-encode runtime), srcset relatifs
```

### Rollback Phase 1 (assetPrefix)

```bash
sed -i '/^NEXT_PUBLIC_CDN_URL=/d;/^NEXT_PUBLIC_CDN_LOADER=/d' apps/azalee/.env
sed -i '/^NEXT_PUBLIC_CDN_URL=/d;/^NEXT_PUBLIC_CDN_LOADER=/d' apps/rosegriffon/.env
bash scripts/ops/safe-deploy.sh azalee
bash scripts/ops/safe-deploy.sh website
# → chunks/CSS/fonts servis par origin Next, CDN reste accessible mais inutilisé
```

### Rollback complet vhost CDN

```bash
sudo cp /var/backups/cdn-migration-20260430-210839/cdn.rosegriffon.live.conf /etc/nginx/conf.d/cdn.rosegriffon.conf
sudo nginx -t && sudo systemctl restart nginx
# → API uploads intacte, surface /static/ supprimée (404)
```

## Branches Git

Submodules `apps/azalee` + `apps/rosegriffon` :

| Branche | Rôle |
|---|---|
| `main` | Production avec patches CDN mergés (commits `486d666` → `64431ad`) |
| `cdn` | Branche d'origine des patches (= main, conservée pour historique) |

Commits :

```
64431ad feat(cdn): toggle NEXT_PUBLIC_CDN_LOADER séparé d'assetPrefix (activation graduelle)
1c301e0 feat(cdn): loader custom passthrough vers cdn.rosegriffon.fr (bypass /_next/image)
486d666 feat(cdn): assetPrefix conditionnel via NEXT_PUBLIC_CDN_URL + cdn.rosegriffon.fr dans remotePatterns + CSP
```

## Mesures de performance

### Compression — chunk JS exemple

| Encoding | Taille | Économie |
|---|---|---|
| identity | 6 558 B | — |
| gzip -9 | 2 328 B | -64% |
| brotli -11 | 2 007 B | -69% |

### Locales JSON azalee

| Fichier | Raw | Brotli | Économie |
|---|---|---|---|
| en.json | 223 KB | ~85 KB | -62% |
| fr.json | 254 KB | ~87 KB | -66% |
| ja.json | 265 KB | ~85 KB | -68% |

### Décharge runtime Next

| Métrique | Avant CDN | Avec Phase 1+2 |
|---|---|---|
| Requêtes static origin Next | 100% | 0% (chunks/CSS/fonts CDN) |
| Appels `/_next/image` (Sharp) | 100% | 0% (loader custom direct) |
| RAM Next image cache | dynamique | minimal |

## Évolutions futures

- **Pré-rendu d'images responsive** : si on veut récupérer le multi-size avec `cdn-loader.js`, pré-générer les variantes `?w=N` côté build via `sharp`/`@aphrody-code/canvas` et les sync au CDN. Pour l'instant le `?w=N&q=Q` est ignoré côté nginx (1 seule taille servie).
- **`stale-while-revalidate`** : passer le CDN derrière un Cloudflare gratuit pour atteindre l'edge (la latence depuis EU est déjà <10 ms, mais hors EU bénéficierait).
- **Surface `/static/rpb-dashboard/`** : whitelist + sync, suit le même pattern que azalee/website.
- **Brotli quality 11 → 8** : si le sync devient un bottleneck dans `safe-deploy.sh` (actuellement ~7 s full, ~50 ms incremental), passer à quality 8 (gain compression marginal mais 4× plus rapide).

## Refs

- [`infra/nginx/cdn.rosegriffon.conf`](../infra/nginx/cdn.rosegriffon.conf)
- [`apps/cdn/server.ts`](../apps/cdn/server.ts) — API uploads (Bun :8804)
- [`scripts/ops/cdn-sync.ts`](../scripts/ops/cdn-sync.ts) — sync miroir + brotli/gzip
- [`scripts/ops/safe-deploy.sh`](../scripts/ops/safe-deploy.sh) — hook post-build
- [`apps/azalee/cdn-loader.js`](../apps/azalee/cdn-loader.js) — loader Image azalee
- [`apps/rosegriffon/cdn-loader.js`](../apps/rosegriffon/cdn-loader.js) — loader Image website
- `state.md` section "CDN cdn.rosegriffon.fr" — état runtime courant
- `CLAUDE.md` section "Pieges connus" — entrées CDN
