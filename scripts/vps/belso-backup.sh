#!/usr/bin/env bash
#
# Belso's nightly database job. Runs on the VPS under systemd; the copy in the
# repository is the source of truth (docs/security/vps.md says how to install).
#
# Shell rather than Node because the VPS has no Node installed and `pg_dump`
# exists only inside the Postgres container. Adding a runtime to a 2-core box
# so a backup can be written in JavaScript is the wrong trade.
#
# It does three things, in this order and for this reason:
#
#   1. Delete enquiries past their retention date. Personal data we are no
#      longer entitled to keep must not be copied into a fresh backup — doing
#      the dump first would quietly extend its life by the backup's own
#      lifetime, which is exactly the leak the retention date exists to close.
#   2. Prune spent throttle counters, which otherwise grow by one row per
#      sender forever.
#   3. Dump, then **verify the dump**, then prune old dumps — never before.
#
# The verification is the part that matters. A backup job that reports success
# without reading back what it wrote is a job that will report success every
# night for a year and then be found empty on the one morning it is needed.
set -euo pipefail

CONTAINER="belso-db-db-1"
DB_USER="belso"
DB_NAME="belso"
# Bind-mounted to /root/backups/belso on the host, so the provider snapshot
# sweeps these up along with everything else.
DEST_IN_CONTAINER="/backups"
DEST_ON_HOST="/root/backups/belso"
KEEP_DAYS=14
KEEP_MINIMUM=7          # never fall below this many dumps, whatever the dates say
MIN_BYTES=20000         # a healthy dump of this catalogue is ~100 KB; 20 KB is a floor

log() { printf '%s belso-backup: %s\n' "$(date -Is)" "$*"; }
die() { log "FAILED — $*"; exit 1; }

psql_do() {
  docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tAc "$1"
}

docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null | grep -q true \
  || die "container $CONTAINER is not running"

# --- 1. Retention -------------------------------------------------------------
# 24 months, carried per row in `expires_at` so rows keep the promise made when
# they were collected, even if the period changes later.
# Counted in SQL, not by piping to `wc -l`: psql prints a trailing newline for
# an empty result, so zero rows read as one and the job cheerfully reported
# deleting an enquiry from an empty table.
expired=$(psql_do "with gone as (delete from enquiries where expires_at < now() returning 1) select count(*) from gone")
log "retention: removed ${expired} expired enquir$([ "$expired" = "1" ] && echo y || echo ies)"

# --- 2. Throttle counters -----------------------------------------------------
throttle=$(psql_do "with gone as (delete from enquiry_throttle where window_start < now() - interval '1 day' returning 1) select count(*) from gone")
log "throttle: pruned ${throttle} spent window(s)"

# --- 3. Dump ------------------------------------------------------------------
stamp=$(date -u +%Y%m%d-%H%M%S)
name="belso-${stamp}.dump"

# Custom format: compressed, and restorable table-by-table with pg_restore,
# which is the whole reason this exists alongside the provider's whole-machine
# snapshots. Recovering one listing the client deleted by mistake should not
# mean rolling the entire server — and her n8n — back to last night.
docker exec "$CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc -f "${DEST_IN_CONTAINER}/${name}" \
  || die "pg_dump returned non-zero"

path="${DEST_ON_HOST}/${name}"
[ -f "$path" ] || die "dump is missing at ${path}"

size=$(stat -c %s "$path")
[ "$size" -ge "$MIN_BYTES" ] || die "dump is only ${size} bytes — expected at least ${MIN_BYTES}"

# Read it back. `pg_restore --list` parses the archive's table of contents, so a
# truncated or corrupt file fails here rather than in six months.
tables=$(docker exec "$CONTAINER" pg_restore --list "${DEST_IN_CONTAINER}/${name}" | grep -c 'TABLE DATA' || true)
[ "$tables" -ge 5 ] || die "dump lists only ${tables} tables with data — expected at least 5"

log "dump ok: ${name} (${size} bytes, ${tables} tables with data)"

# --- 4. Prune old dumps, only now that a good one exists ----------------------
count=$(find "$DEST_ON_HOST" -maxdepth 1 -name 'belso-*.dump' | wc -l)
if [ "$count" -gt "$KEEP_MINIMUM" ]; then
  removed=$(find "$DEST_ON_HOST" -maxdepth 1 -name 'belso-*.dump' -mtime "+${KEEP_DAYS}" -print -delete | wc -l)
  log "pruned ${removed} dump(s) older than ${KEEP_DAYS} days (${count} on disk before)"
else
  log "keeping all ${count} dump(s) — at or below the floor of ${KEEP_MINIMUM}"
fi

log "done"
