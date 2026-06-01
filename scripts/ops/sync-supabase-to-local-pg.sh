#!/usr/bin/env bash
# sync-supabase-to-local-pg.sh — Unifie le Postgres LOCAL `rose_griffon` avec
# Supabase Cloud (source de verite). Le local est un replica jetable : on le
# remet en parite (schema public + donnees) depuis Supabase, pour qu'il
# s'accorde avec ce que voient les apps (azalee/website/bot), le cron et le
# mirror SQLite.
#
# Pourquoi : `DATABASE_URL` root pointe sur le pg local (socket, sandbox dev),
# alors que TOUTES les apps + le cron ecrivent sur Supabase. Le local DRIFT
# (ex. zukan_order=0 vs 5463, table `orders` absente, colonnes/types decales).
#
# Methode (robuste aux Supabase-ismes) :
#   1. Prep local en superuser : extensions triviales, roles Supabase, schema
#      `auth` + stubs `auth.uid()/role()/jwt()` (pour les DEFAULT des CREATE TABLE).
#   2. Reset : DROP SCHEMA public CASCADE; CREATE SCHEMA public.
#   3. pg_dump -Fc (format custom) du schema public Supabase -> fichier /tmp.
#   4. pg_restore --disable-triggers (FK off) en superuser -> local. Les refs
#      Supabase-only (FK vers auth.users, supabase_vault) echouent sans bloquer.
#   5. Post : DISABLE RLS + GRANT a `ubuntu` (role de connexion root) sur tout
#      public — sinon la RLS heritee rend le replica VIDE pour ubuntu.
#   6. Verification parite par table (count local vs Supabase) + canari zukan.
#
# Secret : le mot de passe pg Supabase est lu depuis apps/azalee/.env.local et
# utilise par pg_dump cote ubuntu ; il n'est JAMAIS affiche. Le dump /tmp ne
# contient que des donnees publiques (pas la chaine de connexion).
#
# Idempotent / re-jouable. Lecture seule cote Supabase.
# Usage : bash scripts/ops/sync-supabase-to-local-pg.sh
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOCALDB="rose_griffon"
DUMP="/tmp/supa_public.dump"
LOG="/tmp/sync_local_pg.log"
: > "$LOG"

# --- Source de verite : URL pg directe Supabase (jamais echo) ---
SUPA="$(grep -m1 '^DATABASE_URL=' "$ROOT/apps/azalee/.env.local" | cut -d= -f2- | tr -d '"')"
if [ -z "$SUPA" ]; then
	echo "ERREUR: DATABASE_URL Supabase introuvable dans apps/azalee/.env.local" >&2
	exit 1
fi
case "$SUPA" in
	*supabase.co*) : ;;
	*) echo "ERREUR: DATABASE_URL ne pointe pas sur Supabase (securite)" >&2; exit 1 ;;
esac

SU="sudo -n -u postgres psql -X -v ON_ERROR_STOP=0 -d $LOCALDB"

echo "Unification pg local <- Supabase Cloud (schema public)"
echo "  local=$LOCALDB  dump=$DUMP  log=$LOG"

# --- 1+2. Prep + reset du schema public en superuser ---
echo "  prep (extensions, roles, stubs auth) + reset schema public..."
$SU -q >>"$LOG" 2>&1 <<'SQL'
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticator NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS 'SELECT NULL::uuid';
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS 'SELECT NULL::text';
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS 'SELECT NULL::jsonb';
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO public;
GRANT USAGE ON SCHEMA public TO ubuntu;
SQL

# --- 3. Dump custom-format du schema public Supabase ---
echo "  pg_dump Supabase (schema public, format custom)..."
if ! pg_dump "$SUPA" --schema=public --no-owner --no-privileges -Fc -f "$DUMP" 2>>"$LOG"; then
	echo "ERREUR: pg_dump Supabase a echoue (voir $LOG)" >&2
	exit 1
fi
echo "  dump: $(du -h "$DUMP" | cut -f1)"

# --- 4. Restore en superuser (FK off, erreurs Supabase-only tolerees) ---
echo "  pg_restore -> local (FK desactivees)..."
# pg_restore continue par defaut sur erreur (pas de -e) : les refs Supabase-only
# (FK vers auth.users, supabase_vault) sont signalees sans bloquer le reste.
sudo -n -u postgres pg_restore --no-owner --no-privileges --disable-triggers \
	--superuser=postgres -d "$LOCALDB" "$DUMP" >>"$LOG" 2>&1 || true

# --- 5. Replica utilisable par le role de connexion `ubuntu` (RLS off + grants) ---
echo "  post-restore: DISABLE RLS + GRANT ubuntu sur public..."
$SU -q >>"$LOG" 2>&1 <<'SQL'
DO $$
DECLARE r record;
BEGIN
	FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
		BEGIN EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', r.tablename); EXCEPTION WHEN others THEN NULL; END;
		BEGIN EXECUTE format('GRANT ALL ON public.%I TO ubuntu', r.tablename); EXCEPTION WHEN others THEN NULL; END;
	END LOOP;
END $$;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO ubuntu;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO ubuntu;
SQL

# --- 6. Verification parite par table (count local vs Supabase) ---
echo ""
echo "Verification parite (local vs Supabase) :"
SYNC_TBLS="$(LC_ALL=C; psql "$SUPA" -X -tAc "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name" 2>>"$LOG")"
build_counts() { echo "$SYNC_TBLS" | awk 'NF{printf "%sSELECT %d AS i, count(*) AS c FROM public.\"%s\"", (n++?" UNION ALL ":""), NR, $0}'; }
COUNTQ="$(build_counts)"
LOCAL_COUNTS="$(mktemp)"; SUPA_COUNTS="$(mktemp)"
$SU -tAc "$COUNTQ ORDER BY i" 2>>"$LOG" | tr -d ' ' > "$LOCAL_COUNTS"
psql "$SUPA" -X -tAc "$COUNTQ ORDER BY i" 2>>"$LOG" | tr -d ' ' > "$SUPA_COUNTS"

i=0; drift=0; ok=0
while IFS= read -r t; do
	[ -z "$t" ] && continue
	i=$((i+1))
	lc="$(awk -F'|' -v k="$i" '$1==k{print $2}' "$LOCAL_COUNTS")"
	sc="$(awk -F'|' -v k="$i" '$1==k{print $2}' "$SUPA_COUNTS")"
	if [ "$lc" = "$sc" ] && [ -n "$lc" ]; then
		ok=$((ok+1))
	else
		drift=$((drift+1))
		printf "  DRIFT %-34s local=%s supabase=%s\n" "$t" "${lc:-MISSING}" "${sc:-?}"
	fi
done <<< "$SYNC_TBLS"

echo ""
echo "Resultat : $ok tables en parite, $drift en ecart (detail: $LOG)."
ZO="$($SU -tAc "SELECT count(*) FROM inagle_characters WHERE zukan_order IS NOT NULL" 2>>"$LOG" | tr -d ' ')"
MK="$($SU -tAc "SELECT zukan_order FROM inagle_characters WHERE zukan_hash='k/d/w/dwho-wi8ruk' LIMIT 1" 2>>"$LOG" | tr -d ' ')"
echo "Canari local : zukan_order set=$ZO, Mark Evans #${MK:-?}"
rm -f "$LOCAL_COUNTS" "$SUPA_COUNTS"
