#!/usr/bin/env bash
#
# Give `belso_app` and `belso_editor` their passwords.
#
# The migrations create both roles with `login` and **no password**, so they
# exist and cannot authenticate until this runs (`0004_app_role.sql`,
# `0006_editor_role.sql`). That is deliberate: a password in a committed file is
# a password in every clone, every fork and every backup of the repository.
#
# This closes a dangling reference. `0004` has named `scripts/vps/belso-app-role.sh`
# since spec 010 and no such file was ever written — so the one instruction for
# making the least-privilege role usable pointed at nothing. Both roles are done
# here, because provisioning them separately is how one gets forgotten.
#
# Run it on the VPS:
#
#   ssh belso-vps 'bash -s' < scripts/vps/belso-roles.sh                  # both
#   ssh belso-vps 'bash -s' -- belso_editor < scripts/vps/belso-roles.sh  # one
#
# **Naming a role is the normal case, not the exotic one.** Setting a password
# is also rotating it, and rotating `belso_app` invalidates the credential the
# live storefront is holding: the site keeps serving on its existing pool and
# then fails on the next process start, which is a deploy or a reboot, at a
# moment nobody has connected to this command. So provision the role you mean.
#
# It prints the connection strings once and stores nothing. They are not
# recoverable afterwards, which is the point.
set -euo pipefail

CONTAINER="belso-db-db-1"
DB_OWNER="belso"
DB_NAME="belso"
HOST="127.0.0.1"
PORT="5432"

die() { printf 'belso-roles: FAILED — %s\n' "$*" >&2; exit 1; }

command -v docker >/dev/null || die "docker is not on PATH — is this the VPS?"
docker inspect "$CONTAINER" >/dev/null 2>&1 || die "container $CONTAINER is not running"

# 24 bytes of urandom, base64. Long enough that nothing about it needs thought,
# and `tr -d` strips the characters that would need URL-encoding in a
# connection string — a password containing `/` or `+` is the classic way a
# working password becomes a failing one on the way into an environment file.
generate() {
  head -c 24 /dev/urandom | base64 | tr -d '=+/' | head -c 32
}

set_password() {
  local role="$1" password="$2"

  # Piped in rather than passed as an argument: an argument is visible in `ps`
  # for as long as the command runs, and this one runs on a box the client's
  # n8n also uses.
  #
  # `format('%I … %L')` quotes the identifier and the literal, so neither can
  # end the statement early. `alter role` takes no parameters, so the quoting
  # has to be explicit here rather than left to a driver — which is exactly the
  # situation `format` exists for.
  # `-q` and `-o /dev/null`: psql would otherwise print `DO` into the middle
  # of the connection strings below, which is the sort of noise that gets
  # copied into an environment file along with the value.
  docker exec -i "$CONTAINER" psql -q -o /dev/null -v ON_ERROR_STOP=1 -U "$DB_OWNER" -d "$DB_NAME" <<SQL
do \$\$
begin
  execute format('alter role %I with password %L', '${role}', \$pw\$${password}\$pw\$);
end
\$\$;
SQL
}

ROLES=("$@")
[ ${#ROLES[@]} -gt 0 ] || ROLES=(belso_app belso_editor)

# Which environment variable each role's connection string belongs in. Printed
# with the value, because "here is a password" without "here is where it goes"
# is how a rotation ends up half-applied.
variable_for() {
  case "$1" in
    belso_app) printf 'DATABASE_URL' ;;
    belso_editor) printf 'DATABASE_EDITOR_URL' ;;
    *) die "unknown role $1 — this script provisions belso_app and belso_editor" ;;
  esac
}

for role in "${ROLES[@]}"; do
  variable_for "$role" >/dev/null
  exists=$(docker exec "$CONTAINER" psql -tAU "$DB_OWNER" -d "$DB_NAME" \
    -c "select 1 from pg_roles where rolname = '${role}'")
  [ "$exists" = "1" ] || die "role ${role} does not exist — run \`pnpm db:migrate\` first"
done

printf '\nbelso-roles: copy these now — they are not stored anywhere.\n\n'

for role in "${ROLES[@]}"; do
  password="$(generate)"
  set_password "$role" "$password"
  printf '  %s=postgres://%s:%s@%s:%s/%s\n' \
    "$(variable_for "$role")" "$role" "$password" "$HOST" "$PORT" "$DB_NAME"
done

cat <<'EOF'

The two must never be set to the same value: the split is the control, and a
fallback would hand the public storefront the ability to rewrite the catalogue
(ADR-0010).

For local development the port is the tunnel's — 55432, see `pnpm db:tunnel`.
EOF
