# Supabase Free — Référence

Compte Rose Griffon : `isbkaeltubqittywibeh.supabase.co` · Région : `eu-west-3`
Fact-checké Context7 / doc officielle Supabase · 2026-04-19

---

## Plan Free — Limites officielles

> Sources : `supabase.com/docs/guides/platform/database-size`, `/guides/storage/serving/bandwidth`, `/guides/functions/limits`, `/guides/troubleshooting?tags=MAU`.

### Base de données

| Ressource | Limite Free |
|---|---|
| Taille DB | **500 MB** (read-only au-dessus) |
| Disk space alloué | 1 GB (mais lock à 500 MB) |
| Connexions directes | 60 (port 5432) |
| Connexions pooled | 200 (port 6543 PgBouncer) |
| Extensions Postgres | Toutes supportées |

> **Au-delà de 500 MB** : la DB passe en **read-only**. Pour résoudre : soit nettoyer (`VACUUM`, archiver), soit upgrader Pro ($25/mois) avec Spend Cap désactivé pour autoscale > 8 GB.

### Bandwidth & Storage

| Ressource | Limite Free |
|---|---|
| **Bandwidth total** | **10 GB/mois** (5 GB cached + 5 GB uncached) |
| Storage (buckets) | 1 GB |
| File size max | 50 MB / fichier |
| CDN | Global (Cloudflare) |

> Le bandwidth agrège **DB + Storage + Edge Functions**. Un fichier de 1 MB téléchargé 10 000 fois = 10 GB consommés.

### Auth

| Ressource | Limite Free |
|---|---|
| Monthly Active Users (MAU) | **50 000** |
| Providers OAuth | Tous (Google, Discord, GitHub, etc.) |
| Custom SMTP | Supabase SMTP partagé (rate-limited) |
| Password recovery emails | ~3/heure par user |

### Edge Functions

| Ressource | Limite Free |
|---|---|
| Nombre max | **100** |
| Bundle size | 20 MB après compression |
| Invocations | 500 000/mois |
| Runtime | Deno |

### Realtime

| Ressource | Limite Free |
|---|---|
| Concurrent peak connections | **~200** |
| Messages / seconde | 100 |
| Channels / client | 100 |
| Payload max | 256 KB |

### Plan management

| Ressource | Limite Free |
|---|---|
| Projets / organisation | **2** |
| Log retention | **7 jours** |
| Backups | 1 / jour, 7 jours de rétention |
| Point-in-time recovery | ❌ (Pro uniquement) |
| Assistance | Communauté (forum, Discord) |

---

## ⚠ Auto-pause — critique pour la prod

> **Les projets Free sont mis en pause après 7 jours d'inactivité.**
>
> Source : `supabase.com/docs/guides/platform/going-into-prod#free-plan`.

**Conséquences** :
- Aucune requête ne répond (timeout).
- Le réveil prend 30-90 secondes au premier hit.
- Données préservées, pas de perte.
- Réveil manuel : login dashboard + click "Restore".

**Définition d'activité** : toute requête API (Postgres, REST, Auth, Storage, Realtime) remet le compteur à zéro.

**Mitigation pour prod publique** :
- Cron externe (GitHub Actions, VPS systemd timer) qui ping `/rest/v1/` tous les 6 jours.
- ✅ Recommandé : **upgrader Pro** ($25/mois) — pas d'auto-pause.

**Pour Rose Griffon** :
- `website` + `azalee` en prod publique francophone → **risque réel d'auto-pause** pendant les vacances ou creux de trafic.
- Solution actuelle VPS (Supabase Cloud même compte) : trafic régulier via le VPS évite la pause.

---

## Intégration Vercel + Supabase Marketplace

> Sources : `vercel.com/docs/storage/marketplace-storage`, `supabase.com/docs/guides/integrations/vercel`.

### Provisioning

```bash
# Depuis le dashboard Vercel :
# 1. Storage → Browse Marketplace → Supabase
# 2. Connect → région eu-west-3 → projet existant ou nouveau
# 3. Auto-link au projet Vercel
```

### Env vars auto-injectées

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...     # server-only, jamais NEXT_PUBLIC_
POSTGRES_URL=postgres://...:6543/postgres?pgbouncer=true    # pooled, serverless-safe
POSTGRES_URL_NON_POOLING=postgres://...:5432/postgres        # direct, migrations
POSTGRES_PRISMA_URL=postgres://...:6543/postgres?pgbouncer=true&connect_timeout=15
```

### Connection pooling — OBLIGATOIRE sur Vercel

Sur Vercel Functions (serverless), chaque invocation = nouveau process Node. Sans pooling, la DB plafonne à 60 connexions → erreur `FATAL: too many connections`.

```ts
// ✅ SSR avec pooler
import { createServerClient } from '@supabase/ssr'
// Utilise automatiquement POSTGRES_URL (port 6543)

// ✅ Prisma avec pgbouncer
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.POSTGRES_PRISMA_URL } }
})

// ❌ Direct connection — épuisera les 60 slots rapidement
const prismaDirect = new PrismaClient({
  datasources: { db: { url: process.env.POSTGRES_URL_NON_POOLING } }
})
```

### Supabase SSR Next.js (App Router)

```ts
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function supabaseServer() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => list.forEach((c) => cookieStore.set(c.name, c.value, c.options)),
      },
    },
  )
}
```

---

## Économiser du bandwidth (10 GB/mois est serré)

### Stratégies

1. **Servir les assets statiques hors Supabase Storage** :
   - Option A : garder nginx VPS (actuel) pour bucket `menu` (42 768 fichiers) via symlink
   - Option B : Cloudflare R2 / AWS S3 + CDN (bandwidth illimité sur R2)
   - Option C : Vercel Blob (100 GB bandwidth sur Hobby, mais lié au projet)

2. **Cache agressif côté client** :
   ```ts
   // Edge Function Supabase
   return new Response(data, {
     headers: {
       'Cache-Control': 'public, max-age=31536000, immutable',
     },
   })
   ```

3. **Transformation images côté Supabase** :
   - `?width=400&quality=80` → image plus petite = moins de bandwidth
   - Disponible sur Free avec quotas raisonnables

4. **Réduire les requêtes avec `select`** :
   ```ts
   // ❌ download tout
   supabase.from('articles').select('*')
   // ✅ colonnes nécessaires uniquement
   supabase.from('articles').select('id, title, excerpt, cover_url')
   ```

5. **Realtime seulement où nécessaire** :
   - Chaque connection Realtime maintient un WebSocket = bandwidth continu
   - Préférer `refetch` ponctuel via TanStack Query

### Monitoring

```bash
# Dashboard → Organization Settings → Usage
# Sections : Database, Storage, Auth, Realtime, Edge Functions
# Alertes email automatiques à 80% des quotas
```

---

## Migration Free → Pro ($25/mois)

### Ce qui change

| Feature | Free | Pro |
|---|---|---|
| Auto-pause | 7 jours | ❌ jamais |
| DB size | 500 MB | 8 GB (autoscale) |
| Bandwidth | 10 GB | **250 GB** |
| Storage | 1 GB | 100 GB |
| MAU | 50k | 100k |
| Realtime connections | 200 | 500 |
| Log retention | 7 jours | 7 jours (+ $10/mois pour 28j) |
| Point-in-time recovery | ❌ | $100/mois add-on |
| Support | Communauté | Email (48h SLA) |
| Compute upgrade | ❌ (small only) | Tous tiers (Micro → 16 XL) |
| Spend Cap | ❌ | ✅ (désactivable pour autoscale) |

### Upgrade

```bash
# Dashboard → Settings → Billing → Upgrade Pro
# Spend Cap : laisser activé pour limiter les coûts en burst
# Carte bancaire obligatoire
```

---

## Checklist Rose Griffon (website + azalee + inagle)

### État actuel

- **Hébergement Supabase** : compte `isbkaeltubqittywibeh` (eu-west-3)
- **Plan** : à vérifier (Free ou Pro ?)
- **Apps connectées** : website (Supabase Auth Google/Discord), azalee (Better Auth Discord)
- **Bucket principal** : `menu` (42 768 fichiers) — ~servi via nginx VPS

### Vérifications avant migration Vercel

```bash
# 1. Plan actuel
# Dashboard → Settings → Billing → Plan

# 2. DB size (doit être < 500 MB si Free)
psql "$POSTGRES_URL" -c "SELECT pg_size_pretty(pg_database_size(current_database()));"

# 3. Storage usage
# Dashboard → Storage → Usage

# 4. Bandwidth usage (mois courant)
# Dashboard → Organization Settings → Usage

# 5. Connexions actives
psql "$POSTGRES_URL" -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';"
```

### Si Free (recommandations)

- ✅ Garder bucket `menu` servi par nginx VPS (évite 10 GB bandwidth)
- ⚠ Configurer un cron externe tous les 6 jours pour prévenir auto-pause :
  ```yaml
  # .github/workflows/supabase-keepalive.yml
  on:
    schedule:
      - cron: '0 3 */6 * *'    # tous les 6 jours à 3h UTC
  jobs:
    ping:
      runs-on: ubuntu-latest
      steps:
        - run: curl -sf -H "apikey:${{ secrets.SUPABASE_ANON_KEY }}" https://isbkaeltubqittywibeh.supabase.co/rest/v1/
  ```
- ⚠ Surveiller bandwidth mensuel dans le dashboard (alertes email à 80%)
- ❌ Pas d'Image Optimization Vercel (quota 1K/mois) — utiliser URLs directes `/storage/v1/object/public/menu/...`

### Si Pro ($25/mois)

- ✅ Pas d'auto-pause → migration Vercel sereine
- ✅ 250 GB bandwidth → bucket `menu` peut aller sur Supabase Storage
- ✅ Point-in-time recovery add-on ($100/mois) si données critiques

---

## Références

- Plan Free : https://supabase.com/pricing
- Fair use : https://supabase.com/docs/guides/platform/billing-faq
- Going into production : https://supabase.com/docs/guides/platform/going-into-prod
- Marketplace Vercel : https://vercel.com/marketplace/supabase
- Compagnon : `~/vps/docs/vercel.md`
