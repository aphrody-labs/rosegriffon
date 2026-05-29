#!/usr/bin/env bash
# backup-postgres.sh — Sauvegarde logique complète de Supabase (roles, schema, data).
# Usage : bash scripts/ops/backup-postgres.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKUP_DIR="$ROOT/data/backups/postgres-$(date +%Y-%m-%d-%H%M)"
DATABASE_URL="${DATABASE_URL:-}"

if [ -z "$DATABASE_URL" ]; then
	# Tenter de charger depuis le .env.local
	if [ -f "$ROOT/apps/azalee/.env.local" ]; then
		DATABASE_URL=$(grep "^DATABASE_URL=" "$ROOT/apps/azalee/.env.local" | cut -d= -f2- | tr -d '"')
	fi
fi

if [ -z "$DATABASE_URL" ]; then
	echo "ERREUR: La variable DATABASE_URL n'est pas définie." >&2
	exit 1
fi

mkdir -p "$BACKUP_DIR"

echo "▸ [1/3] Sauvegarde des rôles..."
supabase db dump --db-url "$DATABASE_URL" -f "$BACKUP_DIR/roles.sql" --role-only

echo "▸ [2/3] Sauvegarde du schéma..."
supabase db dump --db-url "$DATABASE_URL" -f "$BACKUP_DIR/schema.sql"

echo "▸ [3/3] Sauvegarde des données..."
supabase db dump --db-url "$DATABASE_URL" -f "$BACKUP_DIR/data.sql" --use-copy --data-only

echo "✓ Sauvegarde Postgres complétée dans : $BACKUP_DIR"

# Créer une archive tar.gz
ARCHIVE="${BACKUP_DIR}.tar.gz"
tar -czf "$ARCHIVE" -C "$ROOT/data/backups" "$(basename "$BACKUP_DIR")"
rm -rf "$BACKUP_DIR"

echo "✓ Archive compressée créée : $ARCHIVE"
