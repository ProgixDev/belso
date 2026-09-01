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
APP_ENV="/docker/belso/app.env"
# Named per account, and it was not until a second account was about to exist.
# One shared file means provisioning a colleague silently overwrites the
# password of whoever was provisioned before them — and since it is the only
# copy by design, "silently" means "destroys". The address is sanitised because
# it lands in a filename.
PASSWORD_DIR="/docker/belso"

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
[ "$COMMAND" != "create" ] || [ -f "$SECRET_ENV" ] ||
  die "$SECRET_ENV is missing — where is the owner password?"
[ "$COMMAND" = "create" ] || [ -f "$APP_ENV" ] ||
  die "$APP_ENV is missing — run belso-app-env.sh first"

# **`create` uses the owner. Nothing else does.**
#
# The editor has no `insert` on `admin_users`, deliberately, so a defect in the
# back-office cannot mint an account for whoever found it
# (`0006_editor_role.sql`). Account creation therefore has to come from outside
# the application, and this is outside.
#
# But that migration also grants `belso_editor` `select, update on admin_users`
# and all four verbs on `admin_sessions` — which is everything `password` (an
# update plus a session sweep) and `list` need. Withholding `insert` is the only
# thing it does. This script originally read the superuser password for all three
# subcommands, so the routine operation, the one run precisely when somebody
# thinks a password is known, was pulling the highest-privilege credential on the
# box off disk for no reason. A security review found it.
PGPASSWORD=""
if [ "$COMMAND" = "create" ]; then
  PGPASSWORD="$(grep '^POSTGRES_PASSWORD=' "$SECRET_ENV" | cut -d= -f2-)"
  [ -n "$PGPASSWORD" ] || die "POSTGRES_PASSWORD is empty in $SECRET_ENV"

  # Passed as PGPASSWORD rather than embedded in the URL. node-postgres falls
  # back to it when the connection string carries no password, which buys two
  # things: no percent-encoding step to get wrong — the classic way a correct
  # password becomes a failing connection string — and no credential inside a
  # URL, the kind of string that ends up in a log line because it looks like
  # configuration.
  DATABASE_URL="postgres://${DB_OWNER}@${CONTAINER}:5432/${DB_NAME}"
  ROLE_USED="$DB_OWNER (insert on admin_users is the owner's alone)"
else
  DATABASE_URL="$(grep '^DATABASE_EDITOR_URL=' "$APP_ENV" | cut -d= -f2-)"
  [ -n "$DATABASE_URL" ] || die "DATABASE_EDITOR_URL is missing from $APP_ENV"
  ROLE_USED="belso_editor"
fi

# `ts-alias-hook` is not used here because there is nothing for it to do:
# `admin-user.mjs` imports `password.ts` by its real path with its real
# extension, and `password.ts` imports only `node:crypto`. No alias, no stub.
#
# It is not that the hook could not run. An earlier version of this comment said
# the hook's `module-typescript` format needed a newer Node than this image
# carries; that was invented, and T-19 disproved it by running
# `measure-upload.mjs` through the hook on this exact image. The strip-types flag
# is likewise belt and braces — Node has stripped types without asking since
# 22.18 — kept only so this does not depend on the image's minor version.
NODE_FLAGS="--experimental-strip-types --disable-warning=ExperimentalWarning"
NODE_FLAGS="$NODE_FLAGS --disable-warning=MODULE_TYPELESS_PACKAGE_JSON"

# **Exported, and passed with the value-less `-e VAR` form.**
#
# `docker run -e VAR=value` puts the value into the docker CLI's argv, and
# `/proc/<pid>/cmdline` is world-readable. Measured on this box rather than
# argued: a canary password set that way was read by the unprivileged `belso-ci`
# account out of three separate processes, on a machine that also runs the
# client's n8n. `/proc/<pid>/environ` is owner-only, and the value-less form
# tells docker to copy the variable from this shell's environment instead.
#
# An earlier version of this file asserted "piped, never an argument: an argument
# is visible in `ps`" about the account password — twenty lines above passing the
# **superuser** credential exactly that way. A security review caught it. The
# comment was right about the principle and the code did the opposite, which is
# the worst of both: reviewers read the claim and move on.
NODE_OPTIONS="$NODE_FLAGS"
CANDIDATE=""
export DATABASE_URL PGPASSWORD EMAIL CANDIDATE NODE_OPTIONS

# One definition of how the container is run, because the write and the check
# must reach the same database as the same role. Two copies of this drift.
in_container() {
  docker run --rm -i --network belso-net \
    -v "${SOURCE}/scripts:/app/scripts:ro" \
    -v "${SOURCE}/src:/app/src:ro" \
    -e DATABASE_URL -e PGPASSWORD -e EMAIL -e CANDIDATE -e NODE_OPTIONS \
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

PASSWORD_FILE="${PASSWORD_DIR}/password-$(printf '%s' "$EMAIL" | tr -c 'A-Za-z0-9' '-').txt"

# Same recipe as `admin-user.mjs`'s own `generate()`: 18 random bytes as
# base64url, so it is URL- and shell-safe and nobody has to think about quoting.
CANDIDATE="$(head -c 18 /dev/urandom | base64 | tr '+/' '-_' | tr -d '=')"

# Written before the account changes, and with a restrictive umask rather than a
# later chmod: between `printf >` and `chmod` the file is world-readable, and
# this box also runs the client's n8n. Written *first* because a password set in
# the database and lost on the way to the file is an account nobody can enter.
(umask 077; printf '%s\n' "$CANDIDATE" > "$PASSWORD_FILE")
chown root:root "$PASSWORD_FILE"

# Piped, never an argument: an argument is visible in `ps` to every process on
# the box. `admin-user.mjs` reads stdin when `--stdin` is present, and filters
# the flag out of the positional arguments so it cannot land in the display name.
# Output discarded because the command prints the password it was handed.
if [ "$COMMAND" = "create" ]; then
  printf '%s' "$CANDIDATE" | in_container scripts/admin-user.mjs create "$EMAIL" "$DISPLAY_NAME" --stdin > /dev/null
else
  printf '%s' "$CANDIDATE" | in_container scripts/admin-user.mjs password "$EMAIL" --stdin > /dev/null
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

printf '  role:     %s\n' "$ROLE_USED"
printf '  password: %s (mode %s, %s)\n' \
  "$PASSWORD_FILE" "$(stat -c '%a' "$PASSWORD_FILE")" "$(stat -c '%U:%G' "$PASSWORD_FILE")"
printf '\n  Collect it in your own session, then destroy it:\n'
printf "    ssh belso-vps 'cat %s'\n" "$PASSWORD_FILE"
printf "    ssh belso-vps 'shred -u %s'\n" "$PASSWORD_FILE"
printf '\n  Nothing was printed. That file is the only copy.\n'
