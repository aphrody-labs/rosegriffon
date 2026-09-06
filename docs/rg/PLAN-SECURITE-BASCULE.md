# Plan de sécurité de la bascule Azalée

État : préparation J1, **aucune commande ci-dessous n’a été exécutée**.

Ce document prépare la bascule du wiki et des services Supabase-compatible. Chaque
action de production reste soumise à un go explicite de l’utilisateur. Les commandes
utilisent des variables déjà présentes sur la machine ; aucune valeur secrète n’est
copiée dans ce document.

## Huit actions préparées

### 1. Fermer le RPC de suppression de profil pour `anon`

Constat d’audit : `public.rg_liberer_profil_discord(text)` est `SECURITY DEFINER`,
exécutable par `anon`, et supprime dans `profiles` et `auth.users`.

Commande préparée, à exécuter après sauvegarde et validation du propriétaire de la
base :

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c \
  'REVOKE EXECUTE ON FUNCTION public.rg_liberer_profil_discord(text) FROM anon;'
```

Contrôle préparé :

```bash
psql "$DATABASE_URL" -Atc \
  "SELECT has_function_privilege('anon', 'public.rg_liberer_profil_discord(text)', 'EXECUTE');"
```

Résultat attendu : `f`. Ne pas supprimer la fonction avant d’avoir vérifié les
consommateurs de la procédure de suppression de compte.

### 2. Retirer `discord_members` de l’API publique

`discord_members` contient des données de membres Discord et est actuellement
présente dans le schéma exposé par PostgREST. La fermeture doit préserver les usages
serveur (site, bot, cron) avec un rôle privilégié, sans ouvrir la table à `anon`.

Commande préparée :

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
REVOKE ALL ON TABLE public.discord_members FROM anon, authenticated;
DROP POLICY IF EXISTS "discord_members_public_read" ON public.discord_members;
SQL
```

Contrôles préparés :

```bash
psql "$DATABASE_URL" -Atc \
  "SELECT has_table_privilege('anon','public.discord_members','SELECT');"
curl -sS -o /dev/null -w '%{http_code}\n' \
  'https://rosegriffon.fr/rest/v1/discord_members?select=discord_id&limit=1' \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY"
```

Résultat attendu : privilège `f` et réponse non exploitable par un visiteur
(normalement `401`, `403` ou `404`, à confirmer selon PostgREST). Les accès serveur
doivent être testés séparément avec leur rôle autorisé.

### 3. Revoir les droits et politiques des tables publiques

L’audit a relevé de nombreux droits `anon` (`INSERT`/`UPDATE`/`DELETE`/`TRUNCATE`)
sur des tables sensibles ; RLS est la barrière effective et doit être vérifiée table
par table avant toute révocation.

Inventaire en lecture seule, préparé :

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
SELECT table_schema, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'anon'
  AND table_schema = 'public'
ORDER BY table_name, privilege_type;

SELECT schemaname, tablename, rowsecurity, forcerowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
SQL
```

Après revue, préparer une migration explicite de moindre privilège. Ne pas désactiver
RLS globalement et ne pas appliquer une révocation large sans matrice des usages.

### 4. Réduire l’exposition des surfaces PostgREST, Realtime et Storage

`supabase-compat.inc` expose `/rest/v1/`, `/graphql/v1`, `/realtime/v1/` et
`/storage/v1/` dans les vhosts publics et sur le listener interne `127.0.0.1:8811`.
La décision cible est de garder le listener interne et de n’exposer publiquement que
les chemins effectivement consommés.

Mesure préparée avant modification :

```bash
for host in azalee.rosegriffon.fr rosegriffon.fr supabase.rosegriffon.fr; do
  for path in /rest/v1/ /graphql/v1 /realtime/v1/ /storage/v1/; do
    printf '%s %s ' "$host" "$path"
    curl -sS -o /dev/null -w '%{http_code}\n' "https://$host$path"
  done
done
```

Toute suppression d’un `include` ou d’un `location` doit être précédée de la
vérification de l’inventaire ci-dessous et d’un test des flux d’authentification,
d’images, d’uploads et de realtime. Aucun reload n’est inclus dans ce J1.

### 5. Protéger `nie-model-serve` contre l’abus et le déni de service

L’audit a infirmé la traversée de chemin, mais a mesuré l’absence d’authentification
et de limitation sur les routes de modèles, avec des réponses pouvant durer 30 s et
une pression mémoire importante.

Diagnostic préparé, sans redémarrage :

```bash
curl -sS -o /dev/null -w 'model=%{http_code} ttfb=%{time_starttransfer} total=%{time_total}\n' \
  http://127.0.0.1:8790/health
systemctl show nie-model-serve.service \
  -p MemoryCurrent -p MemoryHigh -p MemoryMax -p TasksCurrent
```

Correctif à préparer dans le service ou son proxy : authentification explicite pour
les routes lourdes, taille maximale, timeout borné, et limitation par client. Ne pas
exposer directement le port `8790` et ne pas redémarrer le service dans ce lot.

### 6. Rendre effectives la limitation nginx et la journalisation fail2ban

Constat : `limit_req_zone rpb_api` est déclarée mais non appliquée ; la prison
fail2ban associée lit des journaux inexistants.

Mesures préparées :

```bash
rg -n 'limit_req_zone|limit_req |fail2ban|access_log|error_log' \
  infra/nginx /etc/nginx /etc/fail2ban 2>/dev/null
nginx -t -c /etc/nginx/nginx.conf
fail2ban-client status
```

Le correctif devra ajouter `limit_req` dans les locations réellement sensibles,
pointer la prison vers un journal existant, puis exécuter `nginx -t` sur la copie
candidate. Aucun `reload nginx` ni changement de prison n’est autorisé au J1.

### 7. Préparer la rotation de `SUPABASE_JWT_SECRET`

Le secret signe les JWT Supabase et son exposition permet de fabriquer un jeton
`service_role` avec bypass RLS. La rotation doit être coordonnée entre PostgreSQL /
PostgREST, les services Bun, les apps Next, Studio et les consommateurs MCP.

Inventaire préparé, sans afficher les valeurs :

```bash
rg -l 'SUPABASE_JWT_SECRET|jwt-secret|AUTH_JWT_SECRET' \
  /etc /home/ubuntu/rg --glob '!node_modules/**' --glob '!*.sqlite' 2>/dev/null
```

La séquence de production sera : générer un secret aléatoire hors dépôt, mettre à
jour les consommateurs coordonnés, redémarrer/recharger selon leur procédure,
révoquer l’ancien secret après validation, puis tester un JWT `anon` et un JWT
utilisateur. Ne jamais imprimer un secret, le committer ou le passer en argument
visible dans l’historique shell.

### 8. Durcir SSH et supprimer l’accès root par mot de passe

Constat : SSH accepte actuellement root par mot de passe ; `00-hardening.conf` pose
`PermitRootLogin yes`, malgré plus de 2 000 échecs d’authentification relevés.

Contrôles préparés :

```bash
sshd -T | rg '^(permitrootlogin|passwordauthentication|pubkeyauthentication) '
ss -lntp | rg ':22\\b'
fail2ban-client status sshd
```

La modification candidate devra imposer `PermitRootLogin no` et
`PasswordAuthentication no`, vérifier qu’un compte administrateur possède une clé
fonctionnelle et une session de secours, puis lancer `sshd -t` avant toute reprise de
service. Ne pas appliquer ces changements sans go explicite et sans session de
secours vérifiée.

## Inventaire des consommateurs de `supabase-compat.inc`

### Includes nginx mesurés

La recherche `rg -l 'supabase-compat\\.inc' infra/nginx` trouve quatre consommateurs
de l’include :

| Fichier | Surface | Rôle |
|---|---|---|
| `infra/nginx/azalee.rosegriffon.conf` | publique | origine du wiki Azalée |
| `infra/nginx/rosegriffon.conf` | publique | origine du site Rose Griffon |
| `infra/nginx/supabase.rosegriffon.conf` | publique | compatibilité Supabase dédiée |
| `infra/nginx/supabase-internal.conf` | locale | `127.0.0.1:8811`, consommateurs serveur |

L’include lui-même est le cinquième résultat de la recherche, mais n’est pas un
consommateur.

### Consommateurs applicatifs directs ou indirects

- Azalée : `apps/azalee/lib/supabase/{public,server}.ts`,
  `apps/azalee/lib/api-client.ts`, `components/providers/SupabaseProvider.tsx`,
  `app/actions/image-upload.ts`, les deux routes `opengraph-image.tsx`,
  `next.config.ts` et `app/dashboard/database/images/page.tsx`.
- Website : `apps/website/src/lib/supabase/**`, `apps/website/next.config.ts`,
  les modules d’authentification/realtime et `src/lib/x-campagnes/**` ; les médias
  utilisent notamment `/storage/v1/object/public/assets/` et `/tweets/`.
- Bibliothèques et tâches : `packages/azalee/src/images/utils.ts`,
  `packages/db/src/storage.ts`, `packages/cron/src/lib/storage-assets.ts` et ses
  tâches de campagnes/crawl, ainsi que `packages/inagle/src/{core/images,push-adapter}.ts`.
- Outillage et scripts : `packages/mcp/src/tools/supabase*.ts`,
  `scripts/campagnes/**` et `scripts/inagle/**`. Les deux scripts `fix-aura-images.ts`
  et `match-sheet-auras.ts` contiennent en plus un endpoint historique codé en dur
  (`127.0.0.1:8000`) : ils ne consomment pas l’include nginx et doivent être traités
  séparément avant une bascule.
- Services annexes : `apps/realtime/server.ts`, `apps/storage/server.ts`, le bot,
  le cron et Supabase Studio consomment l’endpoint interne ou les URLs de stockage ;
  ils ne doivent pas être assimilés à des consommateurs web publics.

### Vérification à rejouer avant toute suppression

```bash
rg -n '(/rest/v1/|/graphql/v1|/realtime/v1/|/storage/v1/|SUPABASE_INTERNAL_URL|NEXT_PUBLIC_SUPABASE_URL)' \
  apps packages scripts infra --glob '!node_modules/**' --glob '!.next/**' \
  --glob '!*.sqlite'
```

Une suppression d’include n’est sûre que si chaque résultat est classé : public à
conserver, serveur à basculer vers `127.0.0.1:8811`, URL historique à corriger, ou
référence documentaire. Ce classement doit être joint au compte rendu du lot qui
obtiendra le go de production.
