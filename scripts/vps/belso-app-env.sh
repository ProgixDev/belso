#!/usr/bin/env bash
#
# Provision the application's runtime configuration on the VPS (spec 013, T-07).
#
# Writes /docker/belso/app.env — the file `deploy/compose.yml` reads — and sets
# the two database role passwords to match it. Nothing is printed but key names.
#
#   ssh belso-vps 'bash -s' -- <domain> < scripts/vps/belso-app-env.sh
#
# **Why this exists beside `belso-roles.sh` rather than inside it.** That script
# prints connection strings for a person to copy into a file. This one writes the
# file. The difference matters: copying is the step where a credential passes
# through a terminal, a clipboard, an agent's context or a chat log, and the
# whole point of generating secrets on the box is that they never leave it.
# `belso-roles.sh` remains the right tool when a human is rotating a role by
# hand; this is the right one when a machine is provisioning a deployment.
#
# Idempotent in the only sense that matters: run it again and you get new
# passwords and a rewritten file, consistent with each other. It is a rotation,
# not a repair — run it when you mean to rotate.
set -euo pipefail

CONTAINER="belso-db-db-1"
DB_OWNER="belso"
DB_NAME="belso"
TARGET_DIR="/docker/belso"
TARGET="${TARGET_DIR}/app.env"

DOMAIN="${1:-}"
[ -n "$DOMAIN" ] || { printf 'belso-app-env: FAILED — pass the domain as an argument\n' >&2; exit 1; }

die() { printf 'belso-app-env: FAILED — %s\n' "$*" >&2; exit 1; }

command -v docker >/dev/null || die "docker is not on PATH — is this the VPS?"
docker inspect "$CONTAINER" >/dev/null 2>&1 || die "container $CONTAINER is not running"

# Same recipe as belso-roles.sh: 32 characters with the URL-hostile ones
# stripped, because a password containing / or + is the classic way a correct
# password becomes a failing connection string.
generate() { head -c 24 /dev/urandom | base64 | tr -d '=+/' | head -c 32; }

set_password() {
  local role="$1" password="$2"
  # Piped, never an argument: an argument is visible in `ps` to every process on
  # a box that also runs the client's n8n. `format('%I … %L')` quotes both the
  # identifier and the literal so neither can end the statement early.
  docker exec -i "$CONTAINER" psql -q -o /dev/null -v ON_ERROR_STOP=1 -U "$DB_OWNER" -d "$DB_NAME" <<SQL
do \$\$
begin
  execute format('alter role %I with password %L', '${role}', \$pw\$${password}\$pw\$);
end
\$\$;
SQL
}

for role in belso_app belso_editor; do
  exists=$(docker exec "$CONTAINER" psql -tAU "$DB_OWNER" -d "$DB_NAME" \
    -c "select 1 from pg_roles where rolname = '${role}'")
  [ "$exists" = "1" ] || die "role ${role} does not exist — run \`pnpm db:migrate\` against ${DB_NAME} first"
done

APP_PW="$(generate)"
EDITOR_PW="$(generate)"
THROTTLE="$(head -c 32 /dev/urandom | base64)"

set_password belso_app "$APP_PW"
set_password belso_editor "$EDITOR_PW"

mkdir -p "$TARGET_DIR"

# Keys this script does not own, carried across the rewrite.
#
# It writes the whole file, which is right for the values it generates and wrong
# for the ones added later: `BELSO_TAG` records which commit this box is meant to
# be running, and `BELSO_BASIC_AUTH` holds the pre-launch gate. Dropping them
# turns a routine password rotation into a stopped deploy and an unreachable
# site — both fail closed, and neither has anything to do with rotating a
# password.
CARRIED=""
if [ -f "$TARGET" ]; then
  CARRIED="$(grep -E '^(BELSO_TAG|BELSO_BASIC_AUTH)=' "$TARGET" || true)"
fi

# Written with a restrictive umask rather than chmod'd afterwards: between
# `cat >` and `chmod` the file is world-readable, and on a shared box that
# window is not hypothetical.
( umask 077; cat > "$TARGET" <<ENV
# Runtime configuration for the Belso site. Written by scripts/vps/belso-app-env.sh.
#
# NOT IN THE REPOSITORY, and must never be. Regenerate rather than recover it:
# the passwords here are the only copies, deliberately.
#
# NEXT_PUBLIC_SITE_URL is deliberately absent. Next inlines it at build time, so
# setting it here would do nothing while looking like it worked — the sitemap and
# the JSON-LD would go on claiming localhost:3000. It is a build argument; see
# the Dockerfile.

# The storefront's connection. Reads the catalogue, inserts an enquiry, and
# cannot write a listing (ADR-0010).
DATABASE_URL=postgres://belso_app:${APP_PW}@${CONTAINER}:5432/${DB_NAME}

# The back-office's connection. The only role that writes listings, and it
# cannot delete one.
DATABASE_EDITOR_URL=postgres://belso_editor:${EDITOR_PW}@${CONTAINER}:5432/${DB_NAME}

# Keys both rate limiters' HMAC. Without it they key on a bare hash of an email
# address, and src/core/env.ts refuses to boot in production (SEC-RATE-002).
THROTTLE_SECRET=${THROTTLE}

# Where uploaded photographs land inside the container. The compose file mounts
# the belso-media volume here; this is the only data on the box Postgres does
# not hold.
MEDIA_ROOT=/app/media

# The host Traefik routes to, used by the router label in compose.yml.
BELSO_DOMAIN=${DOMAIN}
ENV
)

if [ -n "$CARRIED" ]; then
  printf '\n# Carried across the rewrite — see the note above where these are read.\n' >> "$TARGET"
  printf '%s\n' "$CARRIED" >> "$TARGET"
fi

chown root:root "$TARGET"

printf '\nbelso-app-env: wrote %s\n' "$TARGET"
printf '  keys: %s\n' "$(grep -oE '^[A-Z_]+=' "$TARGET" | tr -d '=' | tr '\n' ' ')"
printf '  mode: %s  owner: %s\n' "$(stat -c '%a' "$TARGET")" "$(stat -c '%U:%G' "$TARGET")"
printf '  domain: %s\n' "$DOMAIN"
printf '\n  belso_app and belso_editor passwords were rotated to match this file.\n'
printf '  Nothing was printed. The file is the only copy.\n'
