# Services et stockage Achillea

Cette fiche décrit la configuration déclarative du portage Achillea. Elle ne constitue pas
une activation de production : aucune unité systemd, configuration Nginx, migration ou
politique Supabase n'est appliquée automatiquement.

La source de vérité machine-readable est
[`infra/achillea/services.json`](../infra/achillea/services.json). Sa cohérence avec le code,
les vhosts et l'unité systemd se vérifie sans réseau ni secret :

```bash
bun scripts/achillea/check-services-config.ts
bun test scripts/achillea/check-services-config.test.ts
```

## Topologie

| Surface                  | Écoute locale      | Exposition                                                      | Propriétaire                   |
| ------------------------ | ------------------ | --------------------------------------------------------------- | ------------------------------ |
| API REST Ts.ED           | `127.0.0.1:4000`   | via le proxy ranked ; upload `/api/proxy/*` en direct par Nginx | processus backend              |
| Ranked REST + Colyseus   | `127.0.0.1:4002`   | `https://ranked.rosegriffon.fr`                                 | enfant du backend              |
| Socket.IO                | `127.0.0.1:4005`   | `https://ranked.rosegriffon.fr/socket.io/`                      | processus backend              |
| Angular en développement | `127.0.0.1:4200`   | locale seulement                                                | Angular CLI                    |
| Angular en production    | fichiers statiques | `https://achillea.rosegriffon.fr`                               | Nginx, aucun processus Angular |

Une seule unité systemd supervise le backend, l'API, Socket.IO et le sous-processus ranked.
`KillMode=control-group` garantit que ranked s'arrête avec son parent. Le front de production
est le contenu immuable de `apps/achillea-web/dist/achillea-web/browser`, servi par Nginx.

L'unité candidate est [`infra/systemd/achillea-bot.service`](../infra/systemd/achillea-bot.service).
Elle n'est ni copiée ni démarrée par les tests de configuration.

## Secrets

Aucun `.env` réel ne doit être créé ou versionné dans le dépôt.

- En local, les valeurs sont chargées depuis `$HOME/.bash_secrets`, fichier utilisateur en
  mode `0600`, avant la commande Bun.
- En production, systemd lit exclusivement `/etc/rose-griffon/achillea.env`, détenu par root
  et en mode `0600`.
- Les valeurs déjà publiées dans une conversation ou un journal sont compromises : elles
  doivent être révoquées et remplacées avant d'être placées dans l'un de ces fichiers.
- Une clé personnelle Supabase `sbp_…` sert à administrer la plateforme. Ce n'est ni un mot
  de passe PostgreSQL, ni une clé Storage runtime, et elle ne doit pas être transmise au bot.

Le fichier de production contient au minimum les noms suivants, avec leurs valeurs injectées
hors Git :

| Classe              | Variables                                                                                                                                       |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Discord             | `BOT_PROFILE=legacy|current`; profil `legacy` : `BOT_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_PUBLIC_KEY`; profil `current` : `DEV_BOT_TOKEN`, `DISCORD_CLIENT_ID_DEV`, `DISCORD_CLIENT_SECRET_DEV`, `DISCORD_PUBLIC_KEY_DEV`; `TEST_GUILD_ID`, `BOT_OWNER_ID` |
| PostgreSQL Supabase | `DATABASE_URL` (recommandé) ; les cinq variables `DATABASE_*` historiques restent un repli                                                      |
| API et sessions     | `API_ADMIN_TOKEN`, `JWT_SECRET_KEY`, `RANKED_INTERNAL_SECRET`                                                                                   |
| Redis               | `REDIS_HOST`, `REDIS_PORT`                                                                                                                      |
| Origins             | `WEBSITE_URL`, `PUBLIC_API_URL`, `OAUTH_CALLBACK_BASE_URL`, `WEB_ALLOWED_ORIGINS`, `RANKED_ALLOWED_ORIGINS`, `RANKED_PUBLIC_URL`                |
| Storage Supabase    | `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_STORAGE_BUCKET`, `SUPABASE_PRIVATE_STORAGE_BUCKET`, `SUPABASE_SIGNED_URL_TTL`                  |

`API_HOST=127.0.0.1`, `API_PORT=4000`, `RANKED_HOST=127.0.0.1`, `RANKED_PORT=4002`,
`SOCKET_HOST=127.0.0.1`, `SOCKET_PORT=4005`, `NODE_ENV=production` et `RANKED_ENTRY` sont
fixés par l'unité versionnée, pas par le fichier secret. Cela empêche les trois ports amont
de contourner Nginx en écoutant sur l'interface publique. En production, `RANKED_ENTRY`
désigne exclusivement l'artefact construit `build/ranked/main.js`, jamais la source TypeScript.

Le mot de passe PostgreSQL reste nécessaire dans `DATABASE_URL` pour MikroORM et `Bun.SQL`,
même si une clé personnelle ou une clé API Supabase est disponible. La cible doit être le
projet Achillea, jamais la base RG. Le pooler et le port retenu doivent correspondre aux
paramètres affichés par ce projet Supabase ; TLS est imposé pour les hôtes Supabase.

### Dump borné de la base Achillea

[`scripts/achillea/dump-database.ts`](../scripts/achillea/dump-database.ts) encapsule
`pg_dump --format=custom`. Il refuse les hôtes locaux, privés, par IP, non-Supabase ou dont
le host/user ne porte pas le project ref Achillea attendu. Il n'accepte jamais l'URL en
argument et ne place jamais le mot de passe dans la ligne de commande ou les logs : un
`PGPASSFILE` temporaire en mode `0600` est créé puis supprimé.

Le secret local doit définir `ACHILLEA_DATABASE_URL` (prioritaire) ou `DATABASE_URL`, avec
`sslmode=require`. `ACHILLEA_SUPABASE_PROJECT_REF` permet de remplacer la référence attendue
pour une branche/projet Achillea explicitement approuvé. `ACHILLEA_BACKUP_DIR` peut déplacer
la sortie, mais le wrapper refuse toute destination dans le dépôt et les répertoires trop
larges. Par défaut, les archives vont dans `/home/ubuntu/achillea-backups`, dossier `0700`,
avec un fichier final `0600` horodaté.

```bash
set -a
. "$HOME/.bash_secrets"
set +a
bun scripts/achillea/dump-database.ts --check
bun scripts/achillea/dump-database.ts
```

La première commande est un dry-run local : validation de cible, destination et présence de
`pg_dump`, sans connexion ni fichier. La seconde réalise le dump ; elle ne doit être lancée
qu'après rotation des identifiants divulgués et validation de la cible affichée par
`--check`. Le wrapper ne sauvegarde pas les rôles globaux, conformément au périmètre d'un
`pg_dump` de base.

## Migration Cloud vers la pile locale isolée

La cible préparée est une nouvelle base PostgreSQL nommée exactement `achillea`. Les outils
refusent `rg`, `rose_griffon`, `postgres` et `template*`, ainsi que toute cible réseau autre
que le socket local ou `127.0.0.1`. La pile RG existante sur `8809`–`8812` reste intacte.

| Composant local Achillea | Adresse réservée                              | Isolation                                  |
| ------------------------ | --------------------------------------------- | ------------------------------------------ |
| PostgreSQL               | socket `/var/run/postgresql`, base `achillea` | base dédiée obligatoire                    |
| PostgREST                | `127.0.0.1:8820`                              | `/etc/rose-griffon/achillea-postgrest.env` |
| Storage                  | `127.0.0.1:8821`                              | DB dédiée et `/var/www/achillea-storage`   |
| Realtime                 | `127.0.0.1:8822`                              | DB dédiée                                  |
| passerelle interne       | `127.0.0.1:8823`                              | aucun port public                          |

Les unités et le fragment Nginx de `infra/` sont seulement des candidats versionnés. Ce lot
ne les installe, ne les active et ne les redémarre pas.

### Procédure opérateur avec arrêt avant mutation

1. Révoquer toutes les valeurs divulguées, récupérer le nouveau mot de passe PostgreSQL du
   projet Cloud Achillea dédié et définir `ACHILLEA_DATABASE_URL` avec `sslmode=require`
   dans `$HOME/.bash_secrets` en mode `0600`. Une clé `sbp_…` ne remplace pas ce mot de passe.
2. Charger le fichier puis exécuter uniquement les contrôles sans connexion/mutation :

   ```bash
   set -a
   . "$HOME/.bash_secrets"
   set +a
   bun scripts/achillea/dump-database.ts --check
   bun scripts/achillea/database-inventory.ts --source --check \
     --output /home/ubuntu/achillea-backups/source-inventory.json
   ```

3. Pendant une fenêtre sans écritures Cloud, capturer l'inventaire source puis le dump. Les
   sommes de lignes et empreintes sont sensibles comme des métadonnées et restent hors Git,
   en `0600` dans un dossier `0700`.

   ```bash
   bun scripts/achillea/database-inventory.ts --source \
     --output /home/ubuntu/achillea-backups/source-inventory.json
   bun scripts/achillea/dump-database.ts
   ```

4. Créer séparément une base locale **vide** `achillea`. Ne pas réutiliser RG/Azalée. Sur le
   VPS audité, aucun rôle PostgreSQL `ubuntu` n'existe : le défaut sûr est donc le rôle
   système PostgreSQL `postgres`, appelé explicitement via `sudo -u postgres`. Le dump doit
   être copié dans un répertoire privé lisible par ce rôle système, sans assouplir son mode :

   ```bash
   sudo install -d -o postgres -g postgres -m 0700 /var/lib/postgresql/achillea-import
   sudo install -o postgres -g postgres -m 0600 \
     /home/ubuntu/achillea-backups/achillea-AAAA.dump \
     /var/lib/postgresql/achillea-import/achillea-AAAA.dump
   sudo -u postgres createdb --owner=postgres achillea
   ```

   `createdb` est une étape opérateur mutante et n'a pas été lancée par ce lot. Le dump ne
   contient pas les rôles globaux : inventorier et créer explicitement les rôles listés par
   l'archive (`anon`, `authenticated`, `authenticator`, `service_role` et rôles Supabase
   observés), puis vérifier la disponibilité des extensions. Le wrapper ne crée ni base, ni
   rôle, ni extension et n'élève pas de privilège.

5. Valider l'archive, puis lancer le preflight en lecture seule de la cible :

   ```bash
   export ACHILLEA_LOCAL_PGDATABASE=achillea
   export ACHILLEA_LOCAL_PGHOST=/var/run/postgresql
   export ACHILLEA_LOCAL_PGPORT=5432
   export ACHILLEA_LOCAL_PGUSER=postgres
   sudo -u postgres env \
     ACHILLEA_LOCAL_PGDATABASE="$ACHILLEA_LOCAL_PGDATABASE" \
     ACHILLEA_LOCAL_PGHOST="$ACHILLEA_LOCAL_PGHOST" \
     ACHILLEA_LOCAL_PGPORT="$ACHILLEA_LOCAL_PGPORT" \
     ACHILLEA_LOCAL_PGUSER="$ACHILLEA_LOCAL_PGUSER" \
     /home/ubuntu/.bun/bin/bun scripts/achillea/migrate-local-database.ts --check \
     --dump /var/lib/postgresql/achillea-import/achillea-AAAA.dump
   sudo -u postgres env \
     ACHILLEA_LOCAL_PGDATABASE=achillea ACHILLEA_LOCAL_PGHOST=/var/run/postgresql \
     ACHILLEA_LOCAL_PGPORT=5432 ACHILLEA_LOCAL_PGUSER=postgres \
     /home/ubuntu/.bun/bin/bun scripts/achillea/migrate-local-database.ts --preflight \
     --dump /var/lib/postgresql/achillea-import/achillea-AAAA.dump
   ```

   Le preflight exige une cible vide, tous les rôles nécessaires et toutes les extensions
   disponibles. `pg_restore` utilisera ensuite `--single-transaction --exit-on-error
--no-owner`, ce qui annule la restauration au premier échec plutôt que de laisser une
   base partielle. La commande suivante affiche seulement le plan :

   ```bash
   sudo -u postgres env ACHILLEA_LOCAL_PGDATABASE=achillea \
     ACHILLEA_LOCAL_PGHOST=/var/run/postgresql ACHILLEA_LOCAL_PGUSER=postgres \
     /home/ubuntu/.bun/bin/bun scripts/achillea/migrate-local-database.ts --restore \
     --dump /var/lib/postgresql/achillea-import/achillea-AAAA.dump
   ```

6. La seule commande qui écrit en base porte deux confirmations explicites. Elle est réservée
   à une fenêtre approuvée ; elle n'a pas été exécutée par ce lot :

   ```bash
   sudo -u postgres env ACHILLEA_LOCAL_PGDATABASE=achillea \
     ACHILLEA_LOCAL_PGHOST=/var/run/postgresql ACHILLEA_LOCAL_PGUSER=postgres \
     /home/ubuntu/.bun/bin/bun scripts/achillea/migrate-local-database.ts --restore --execute \
     --dump /var/lib/postgresql/achillea-import/achillea-AAAA.dump
   ```

7. Toujours sous gel des écritures, capturer la cible et exiger une comparaison vide :

   ```bash
   sudo -u postgres env ACHILLEA_LOCAL_PGDATABASE=achillea \
     ACHILLEA_LOCAL_PGHOST=/var/run/postgresql ACHILLEA_LOCAL_PGUSER=postgres \
     /home/ubuntu/.bun/bin/bun scripts/achillea/database-inventory.ts --target \
     --output /var/lib/postgresql/achillea-import/target-inventory.json
   sudo install -o ubuntu -g ubuntu -m 0600 \
     /var/lib/postgresql/achillea-import/target-inventory.json \
     /home/ubuntu/achillea-backups/target-inventory.json
   bun scripts/achillea/database-inventory.ts --compare \
     --source-file /home/ubuntu/achillea-backups/source-inventory.json \
     --target-file /home/ubuntu/achillea-backups/target-inventory.json
   ```

   Le comparateur vérifie chaque table non-système par nombre de lignes et une empreinte
   indépendante de l'ordre. Toute table absente, supplémentaire ou différente bloque la
   bascule.

### Deux gates qui restent bloquantes

- Le dump PostgreSQL transporte les métadonnées `storage.objects`, pas les octets des objets
  Cloud. Ceux-ci doivent être copiés séparément, bucket par bucket, vers
  `/var/www/achillea-storage`, puis vérifiés par nombre, taille et checksum. `images` doit
  rester public et `ranked-proofs` privé. Sans identifiants Cloud rotatés et inventaire objet
  validé, aucune copie n'est autorisée.
- Le schéma `auth` est restauré, mais cette configuration ne fournit pas encore de service
  GoTrue Achillea isolé. La passerelle interne n'expose volontairement aucun `/auth/v1/`.
  OAuth, JWT/JWKS, refresh token et login doivent réussir sur un service Auth dédié avant
  toute bascule de `SUPABASE_URL`.

Après ces gates seulement, appliquer le SQL Storage à la base **Achillea**, renseigner les
trois fichiers secrets externes, tester les services sur loopback, puis planifier une bascule
et un retour arrière. Ne jamais modifier les fichiers ou unités Supabase RG existants.

## Configuration publique du navigateur

Le build Angular lit uniquement ces variables publiques :

```text
ACHILLEA_API_BASE_URL
ACHILLEA_SOCKET_URL
ACHILLEA_SOCKET_PATH
ACHILLEA_COLYSEUS_URL
ACHILLEA_CDN_BASE_URL
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_JWKS_URL
ACHILLEA_YOUTUBE_API_KEY
ACHILLEA_YOUTUBE_CHANNEL_ID
```

`SUPABASE_SECRET_KEY`/`SUPABASE_SERVICE_KEY`, `DATABASE_URL` et les secrets Discord/JWT ne
sont jamais acceptés par l'injecteur Angular. Le fichier public généré `achillea-config.js` est chargé
avant Angular et peut être remplacé au déploiement sans reconstruire les bundles.

Pour la production actuelle, l'API, Socket.IO et Colyseus doivent utiliser des noms DNS HTTPS
ou WSS ; l'injecteur refuse `localhost` et les adresses IP littérales. Le chemin Socket.IO reste
`/socket.io`.

## Uploads Supabase

Les uploads passent par le backend ; le navigateur ne reçoit jamais la clé secrète Supabase.
Le backend utilise `SUPABASE_SECRET_KEY` pour écrire et supprimer ; l'ancien nom
`SUPABASE_SERVICE_KEY` reste seulement un alias de transition. Deux buckets séparent les
usages publics des preuves privées.

| Usage                 | Bucket / préfixe objet | Visibilité                             | Limite                                      | Types                                    |
| --------------------- | ---------------------- | -------------------------------------- | ------------------------------------------- | ---------------------------------------- |
| Proxy web authentifié | `images/proxy/`        | URL publique                           | 6 Mio                                       | PNG, JPEG, WebP, GIF                     |
| Images Discord        | `images/discord/`      | URL publique                           | validation backend                          | PNG, JPEG, WebP, GIF                     |
| Preuves ranked        | `ranked-proofs/proof/` | privé, URL signée (3 600 s par défaut) | 5 Mio décodés, transport texte base64 8 Mio | PNG, JPEG, WebP détectés par magic bytes |

[`infra/achillea/supabase-storage.sql`](../infra/achillea/supabase-storage.sql) décrit le bucket
attendu et supprime d'éventuelles politiques d'écriture navigateur portant les noms Achillea.
Il ne s'exécute pas seul. Il faut d'abord obtenir un dump valide de la base Achillea, relire
la cible et appliquer le SQL sur ce projet uniquement.

Les références persistées pour les nouvelles preuves sont opaques (`supabase-private:…`) ;
le backend génère l'URL signée seulement à la lecture. Les anciennes URL publiques et les
références locales restent lisibles pendant la transition. Une politique de rétention et de
suppression reste à approuver avant l'activation de production.

## Vérifications d'exploitation

Après une activation explicitement autorisée, les sondes attendues sont :

| Sonde                                      | Attendu                                                                       |
| ------------------------------------------ | ----------------------------------------------------------------------------- |
| `http://127.0.0.1:4000/health/check`       | JSON du bot/API ; la disponibilité Discord est un champ, pas la santé du port |
| `http://127.0.0.1:4002/api/health`         | `200` et `{ "ok": true, … }`                                                  |
| TCP `127.0.0.1:4005`                       | port Socket.IO ouvert ; le namespace notifications exige ensuite un JWT       |
| `https://achillea.rosegriffon.fr/`         | shell Angular                                                                 |
| `https://ranked.rosegriffon.fr/api/health` | même santé ranked derrière Nginx                                              |

Les tests statiques ne prétendent pas valider l'état live, la connexion PostgreSQL/Redis,
les permissions du bucket, OAuth, CORS ou les WebSockets. Ces contrôles appartiennent à la
gate d'activation, avec sauvegarde, canary et retour arrière.
