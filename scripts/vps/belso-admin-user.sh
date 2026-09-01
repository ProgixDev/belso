#!/usr/bin/env bash
#
# Create or re-password a back-office account on the **production** database
# (spec 013, T-07b), without the password ever leaving the box.
#
# Ship the source first, then run:
#
#   tar -czf - scripts src tsconfig.json package.json |
#     ssh belso-vps 'rm -rf /docker/belso/admin && mkdir -p /docker/belso/admin &&
#       tar -xzf - -C /docker/belso/admin && chmod 700 /docker/belso/admin'
#
#   ssh belso-vps 'bash -s' -- create sofia@belso.ma "Sofia Belso" < scripts/vps/belso-admin-user.sh
#   ssh belso-vps 'bash -s' -- password sofia@belso.ma             < scripts/vps/belso-admin-user.sh
#   ssh belso-vps 'bash -s' -- list                                < scripts/vps/belso-admin-user.sh
#
# **Why not run `pnpm admin:user` from a workstation over the tunnel.** Because
# it prints the password, and the terminal it prints into is the thing this is
# trying to keep the credential out of: a scrollback, a clipboard, an agent's
# transcript. Same reasoning as `belso-app-env.sh` and the same shape — generate
# on the box, write to a root-only file, print the path and not the value.
#
# The owner collects it in their own session and destroys it:
#
#   ssh belso-vps 'cat /docker/belso/back-office-password.txt'
#   ssh belso-vps 'shred -u /docker/belso/back-office-password.txt'
#
# **Why a container rather than node on the host.** There is no node on the VPS
# and there should not be one — the box runs containers. `belso-deps` already
# holds the locked `pg` from a `--frozen-lockfile` install, so this runs against
# exactly the dependency the repository pins, and `src/` is mounted so the hash
# is written by the same `hashPassword` the sign-in reads.
set -euo pipefail

CONTAINER="belso-db-db-1"
DB_OWNER="belso"
DB_NAME="belso"
IMAGE="belso-deps:latest"
SOURCE="/docker/belso/admin"
SECRET_ENV="/docker/belso-db/.env"
PASSWORD_FILE="/docker/belso/back-office-password.txt"

die() { printf 'belso-admin-user: FAILED — %s\n' "$*" >&2; exit 1; }

COMMAND="${1:-}"
case "$COMMAND" in
  create | password | list) ;;
  *) die "usage: create <email> <display name> | password <email> | list" ;;
esac

EMAIL="${2:-}"
[ "$COMMAND" = "list" ] || [ -n "$EMAIL" ] || die "$COMMAND needs an email address"

# Everything after the email is the display name, joined back together.
#
# **ssh does not preserve the caller's quoting.** `ssh host 'bash -s' -- create
# a@b "Sofia Belso"` reaches the remote shell as one flat string, which splits it
# again into `Sofia` and `Belso` — and the account is then created, successfully,
# called "Sofia". Reading `$3` alone is wrong over ssh however carefully the
# caller quotes, so the name is reassembled here. Same failure this script's own
# `--stdin` fix removed from `admin-user.mjs`, one layer further out.
DISPLAY_NAME=""
if [ "$#" -gt 2 ]; then
  shift 2
  DISPLAY_NAME="$*"
fi
[ "$COMMAND" != "create" ] || [ -n "$DISPLAY_NAME" ] || die "create needs a display name"

command -v docker >/dev/null || die "docker is not on PATH — is this the VPS?"
docker inspect "$CONTAINER" >/dev/null 2>&1 || die "container $CONTAINER is not running"
docker image inspect "$IMAGE" >/dev/null 2>&1 || die "image $IMAGE is missing — build it first"
[ -f "$SOURCE/scripts/admin-user.mjs" ] ||
  die "no source at $SOURCE — ship it with the tar command in this script's header"
[ -f "$SECRET_ENV" ] || die "$SECRET_ENV is missing — where is the owner password?"

# The **owner** role, not `belso_editor`. The editor has no insert on
# `admin_users`, deliberately, so a defect in the back-office cannot mint an
# account for whoever found it (0006_editor_role.sql). Account creation has to
# come from outside the application, and this is outside.
OWNER_PW="$(grep '^POSTGRES_PASSWORD=' "$SECRET_ENV" | cut -d= -f2-)"
[ -n "$OWNER_PW" ] || die "POSTGRES_PASSWORD is empty in $SECRET_ENV"

# Passed as PGPASSWORD rather than embedded in the URL. node-postgres falls back
# to it when the connection string carries no password, which buys two things: no
# percent-encoding step to get wrong — the classic way a correct password becomes
# a failing connection string — and no credential inside a URL, the kind of
# string that ends up in a log line because it looks like configuration.
URL="postgres://${DB_OWNER}@${CONTAINER}:5432/${DB_NAME}"

# Node 22 needs telling to strip types; 23+ does it unasked. The repository's
# `ts-alias-hook` is deliberately not used: `admin-user.mjs` imports
# `password.ts` by its real path with its real extension, so there is no alias to
# resolve, and the hook's `module-typescript` format needs a newer Node than this
# image carries.
NODE_FLAGS="--experimental-strip-types --disable-warning=ExperimentalWarning"
NODE_FLAGS="$NODE_FLAGS --disable-warning=MODULE_TYPELESS_PACKAGE_JSON"

# One definition of how the container is run, because the create and the check
# must reach the same database as the same role. Two copies of this drift.
in_container() {
  docker run --rm -i --network belso-net \
    -v "${SOURCE}/scripts:/app/scripts:ro" \
    -v "${SOURCE}/src:/app/src:ro" \
    -e DATABASE_URL="$URL" \
    -e PGPASSWORD="$OWNER_PW" \
    -e EMAIL="$EMAIL" \
    -e CANDIDATE="${NEW_PW:-}" \
    -e NODE_OPTIONS="$NODE_FLAGS" \
    "$IMAGE" node "$@"
}

# `< /dev/null` on every call that is not fed by a pipe, and it is load-bearing.
#
# This script arrives over ssh as `bash -s`, so **its own source is on stdin**.
# `docker run -i` attaches that stdin to the container, which drains the rest of
# the script bash has not read yet — the first run created the account and then
# stopped dead before verifying it, printing nothing at all and exiting 0. A
# silent success is the worst possible failure for a command whose entire job is
# to attest that a credential works.
if [ "$COMMAND" = "list" ]; then
  in_container scripts/admin-user.mjs list < /dev/null
  exit 0
fi

# Same recipe as `admin-user.mjs`'s own `generate()`: 18 random bytes as
# base64url, so it is URL- and shell-safe and nobody has to think about quoting.
NEW_PW="$(head -c 18 /dev/urandom | base64 | tr '+/' '-_' | tr -d '=')"

# Written before the account changes, and with a restrictive umask rather than a
# later chmod: between `printf >` and `chmod` the file is world-readable, and
# this box also runs the client's n8n. Written *first* because a password set in
# the database and lost on the way to the file is an account nobody can enter.
(umask 077; printf '%s\n' "$NEW_PW" > "$PASSWORD_FILE")
chown root:root "$PASSWORD_FILE"

# Piped, never an argument: an argument is visible in `ps` to every process on
# the box. `admin-user.mjs` reads stdin when `--stdin` is present, and filters
# the flag out of the positional arguments so it cannot land in the display name.
# Output discarded because the command prints the password it was handed.
if [ "$COMMAND" = "create" ]; then
  printf '%s' "$NEW_PW" | in_container scripts/admin-user.mjs create "$EMAIL" "$DISPLAY_NAME" --stdin > /dev/null
else
  printf '%s' "$NEW_PW" | in_container scripts/admin-user.mjs password "$EMAIL" --stdin > /dev/null
fi

# **The done-check, run rather than asserted.** See check-admin-password.mjs: it
# verifies the stored hash with the function the sign-in calls, so this reports
# that the credential works and not merely that a command exited zero.
VERDICT="$(in_container scripts/vps/check-admin-password.mjs < /dev/null)"

printf '\nbelso-admin-user: %s %s on the %s database\n' \
  "$([ "$COMMAND" = "create" ] && echo "created" || echo "re-passworded")" "$EMAIL" "$DB_NAME"

case "$VERDICT" in
  OK) printf '  verified: verifyPassword accepts it against the stored hash\n' ;;
  DISABLED) die "the password verifies but disabled_at is set — run \`pnpm admin:user enable\`" ;;
  NO-ROW) die "no row for $EMAIL after $COMMAND — the write did not land" ;;
  *) die "the stored hash does not match the password just written ($VERDICT)" ;;
esac

printf '  password: %s (mode %s, %s)\n' \
  "$PASSWORD_FILE" "$(stat -c '%a' "$PASSWORD_FILE")" "$(stat -c '%U:%G' "$PASSWORD_FILE")"
printf '\n  Collect it in your own session, then destroy it:\n'
printf "    ssh belso-vps 'cat %s'\n" "$PASSWORD_FILE"
printf "    ssh belso-vps 'shred -u %s'\n" "$PASSWORD_FILE"
printf '\n  Nothing was printed. That file is the only copy.\n'
