# Architecture de Base de Données & Cache Hybride (docs/database.md)

Ce document décrit l'architecture de la base de données du projet **Rose Griffon** (particulièrement pour l'application **Azalée**), le flux de sauvegarde et de mise en cache, ainsi qu'une analyse de la gestion native du SQL par le runtime **Bun**.

---

## 1. Architecture Hybride d'Azalée

Afin d'obtenir une latence minimale, de réduire la charge réseau et de sécuriser l'application en cas de coupure de service externe, Azalée utilise une architecture hybride :

```mermaid
graph TD
    subgraph Client
        Browser[Navigateur / Utilisateur]
    end
    subgraph Apps Next.js (VPS)
        Next[Next.js Server / Bun]
        SQLite[Fichier SQLite Local <br> data/backups/latest.sqlite]
    end
    subgraph Cloud
        SupaPG[Supabase Postgres Cloud]
        BetterAuth[Better Auth Engine]
    end

    Browser -->|Navigation Wiki| Next
    Next -->|Lectures statiques 0.5ms| SQLite
    Next -->|Auth / Profils / Écritures| SupaPG
    BetterAuth -->|Sessions / Users| SupaPG
```

### A. Flux de données
1. **Données statiques du Wiki (Personnages, Techniques, Objets, Drops)** :
   * Stockées originellement sur Supabase Cloud.
   * Exportées localement sur le VPS dans un fichier SQLite portable via le script de backup.
   * **Recommandation** : Brancher les lectures de `api-client.ts` directement sur le fichier SQLite local pour éliminer 100% de la latence réseau en production.
2. **Données dynamiques (Utilisateurs, Sessions, Favoris, Logs d'audit)** :
   * Gérées en temps réel via Supabase Cloud PostgreSQL et l'instance Better Auth.

---

## 2. Analyse Interne : La Gestion Native du SQL par Bun

L'analyse du code source de Bun (dans `src/`) révèle des choix de conception axés sur des performances extrêmes.

### A. SQLite (`bun:sqlite`)
SQLite est la base de données la plus optimisée de Bun en raison de son intégration directe dans le binaire :
* **Compilation Statique** : Le code source de SQLite (`sqlite3.c`) est directement inclus dans l'arbre de compilation de Bun. Aucun chargement dynamique (`dlopen` ou FFI externe) n'est requis.
* **Bindings Basse Latence C++** : Bun définit des liaisons C++ directes avec JavaScriptCore (JSC) via `JSSQLStatement.cpp` et `JSSQLStatement.h`. Les méthodes `run()`, `get()`, `all()`, et `values()` s'exécutent en code machine synchrone sans surcoût.
* **Interface JavaScript** (`src/js/bun/sqlite.ts`) : La classe `Database` de Bun charge le constructeur C++ natif à l'aide d'une macro interne `$cpp` :
  ```typescript
  ({ 0: SQL, 1: internalFieldTuple } = $cpp("JSSQLStatement.cpp", "createJSSQLStatementConstructor"));
  ```

### B. Le SQL Universel (`bun:sql`)
L'API `import { sql } from "bun"` unifie l'accès à PostgreSQL, MySQL et SQLite via les templates littéraux :
* **Architecture JavaScript** (`src/js/bun/sql.ts`) : Ce module gère les pools de connexions et instancie des adaptateurs dédiés (`PostgresAdapter`, `MySQLAdapter`, `SQLiteAdapter`).
* **Adaptateur SQLite** (`src/js/internal/sql/sqlite.ts`) : Il enveloppe le module synchrone `bun:sqlite` mais retourne des promesses pour s'aligner sur l'interface asynchrone globale.
* **Moteur Hybride Zig & Rust (PostgreSQL / MySQL)** :
  * Pour se connecter aux bases réseau, Bun n'utilise pas de librairie JavaScript pure (comme `pg`).
  * Il embarque une **Crate Rust** (`src/sql_jsc`) compilée de manière statique au sein du binaire Bun.
  * Le bas-niveau (sockets TCP, cycle de vie réseau, TLS) est écrit en **Zig**, tandis que le protocole de communication, le parsing binaire des paquets, les itérateurs d'objets (`ObjectIterator.rs`) et l'authentification SASL (`SASL.rs`) sont écrits en **Rust**.
  * Les sockets et données réseau reçus sont injectés directement dans le tas JavaScriptCore sous forme d'objets hôtes natifs (`$ZigGeneratedClasses.PostgresSQLConnection`), garantissant un traitement "zero-copy".

---

## 3. Procédure de Synchronisation & Sauvegarde

### A. Sauvegarde Supabase → SQLite local
Pour générer ou mettre à jour la base de données SQLite locale de production sur le VPS, lancez :
```bash
bun run backup:supabase
```
Ce script (`scripts/ops/backup-supabase-to-sqlite.ts`) :
1. Découvre dynamiquement les tables publiques et leurs colonnes via une connexion PostgreSQL directe.
2. Crée les tables SQLite correspondantes avec les affinités de types adéquates.
3. Transfère les lignes par paquets de 5 000 via des transactions optimisées en mode WAL (Write-Ahead Logging).

### B. Sauvegarde Logique Postgres complète (Supabase CLI)
En cas de besoin de sauvegarde complète de sécurité de la base Postgres distante vers une base locale PostgreSQL 18 :

```bash
# 1. Extraction (Dump)
export DB_URL="postgresql://postgres:[PASSWORD]@db.isbkaeltubqittywibeh.supabase.co:5432/postgres"
supabase db dump --db-url "$DB_URL" -f roles.sql --role-only
supabase db dump --db-url "$DB_URL" -f schema.sql
supabase db dump --db-url "$DB_URL" -f data.sql --use-copy --data-only

# 2. Restauration
export LOCAL_DB_URL="postgresql://postgres:[LOCAL_PASSWORD]@localhost:5432/azalee_local"
psql -d "$LOCAL_DB_URL" -f roles.sql
psql -d "$LOCAL_DB_URL" -f schema.sql
psql -d "$LOCAL_DB_URL" --command 'SET session_replication_role = replica' -f data.sql
```
