#!/bin/sh
# Sauvegarde de la stack Docker : base Postgres + fichiers uploadés.
#   ./scripts/backup.sh [dossier]   (défaut : ./backups)
# À lancer depuis la racine du projet, par exemple chaque nuit via cron :
#   0 3 * * * cd /srv/saturn && ./scripts/backup.sh >> backups/backup.log 2>&1
# Garde les 14 dernières sauvegardes de chaque type.
set -eu

DEST="${1:-./backups}"
STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$DEST"

# Variables POSTGRES_* depuis le .env de la racine
set -a
. ./.env
set +a

echo "[$STAMP] Dump Postgres"
docker compose exec -T db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom \
  > "$DEST/db-$STAMP.dump"

echo "[$STAMP] Archive des uploads"
docker compose exec -T backend tar -czf - -C /usr/src/app uploads \
  > "$DEST/uploads-$STAMP.tar.gz"

# Rotation
for prefix in db uploads; do
  ls -1t "$DEST"/"$prefix"-* 2>/dev/null | tail -n +15 | xargs -r rm -f
done

echo "[$STAMP] Sauvegarde terminée dans $DEST"
# Restauration :
#   docker compose exec -T db pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean < backups/db-XXXX.dump
#   docker compose exec -T backend tar -xzf - -C /usr/src/app < backups/uploads-XXXX.tar.gz
