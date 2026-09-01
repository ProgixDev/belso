#!/usr/bin/env bash
#
# Issue the credential that keeps the deployed site out of public view
# (spec 013, T-08b).
#
#   ssh belso-vps 'bash -s' < scripts/vps/belso-gate.sh
#   cd /docker/belso && docker compose --env-file app.env up -d
#
# **Why this exists.** T-08 deployed to the VPS hostname on the understanding
# that this is "not public". That is not true. Traefik obtains a Let's Encrypt
# certificate for the hostname, which publishes it to the Certificate
# Transparency logs within minutes, and those logs are scraped continuously.
# Within the hour the site was reachable by anyone, serving the client's real
# catalogue, with a working contact form and a `robots.txt` saying `Allow: /`.
#
# Spec 013's own preconditions forbid precisely that. B-9 says the site must not
# be publicly reachable with a working contact form before the privacy notice
# exists, and that notice is still eight headings each reading "Section à
# rédiger." A stranger's name, email and phone number would be stored under a
# policy nobody has written.
#
# **Turning the gate off is a diff, not a flag.** The basic-auth labels live in
# `deploy/compose.yml`; removing them is part of T-16, reviewed like any other
# change. There is deliberately no `off` here — a site going public is not the
# sort of thing that should be one argument away, and an empty
# `basicauth.users` is a broken middleware rather than an open door, so a flag
# would fail in a way nobody could read.
#
# Run it again to rotate. The credential is generated on the box and written to
# a root-only file: printed as a path, never as a value.
set -euo pipefail

TARGET_DIR="/docker/belso"
ENV_FILE="${TARGET_DIR}/app.env"
CREDENTIAL_FILE="${TARGET_DIR}/gate-credentials.txt"
USER_NAME="belso"

die() { printf 'belso-gate: FAILED — %s\n' "$*" >&2; exit 1; }

[ -f "$ENV_FILE" ] || die "$ENV_FILE is missing — run belso-app-env.sh first"
command -v openssl >/dev/null || die "openssl is not on PATH"

PASSWORD="$(head -c 18 /dev/urandom | base64 | tr '+/' '-_' | tr -d '=')"

# `-apr1`: a format Traefik's basicauth accepts and openssl can produce, so the
# box does not need apache2-utils installed for `htpasswd`.
HASH="$(openssl passwd -apr1 "$PASSWORD")"

# The hash contains `$`, which compose reads as the start of a variable, so each
# one is doubled — compose collapses `$$` back to `$` when it substitutes.
#
# Doubled with sed and not with `${HASH//$/$$}`: in a bash replacement `$$` is
# the shell's own process id, so that expansion would write a number into the
# hash and the gate would reject the password it had just generated.
ESCAPED="$(printf '%s' "$HASH" | sed 's/\$/$$/g')"

# Rewritten rather than appended to, so running this twice does not leave two
# assignments of one key and a coin flip over which compose reads.
# Beside app.env, not in /tmp, and removed however this exits: the temp file is a
# **complete copy of app.env** — both connection strings and the throttle secret —
# so a failure between writing it and moving it would strand every production
# secret in a world-readable directory until it was swept days later.
#
# And `|| true` is gone. grep exits 1 for "no lines matched", which is the normal
# first run, but it also exits 2 for a real error — and the next line truncates
# app.env to whatever the temp file holds. Masking both meant a read failure
# emptied the deployment's configuration.
TMP="$(mktemp -p "$TARGET_DIR" app.env-XXXXXX)"
chmod 600 "$TMP"
trap 'rm -f "$TMP"' EXIT

grep -v '^BELSO_BASIC_AUTH=' "$ENV_FILE" > "$TMP" || [ "$?" = "1" ] ||
  die "could not read $ENV_FILE — refusing to rewrite it"
cat "$TMP" > "$ENV_FILE"

{
  printf '\n# Basic auth over the whole router until B-2 has a domain and B-9 has a\n'
  printf '# written privacy notice (spec 013, T-08b). The doubled dollars are for\n'
  printf '# compose, which collapses them on substitution.\n'
  printf 'BELSO_BASIC_AUTH=%s:%s\n' "$USER_NAME" "$ESCAPED"
} >> "$ENV_FILE"

(umask 077; printf '%s:%s\n' "$USER_NAME" "$PASSWORD" > "$CREDENTIAL_FILE")
chown root:root "$CREDENTIAL_FILE"

printf '\nbelso-gate: issued a credential for %s\n' "$USER_NAME"
printf '  credential: %s (mode %s, %s)\n' \
  "$CREDENTIAL_FILE" "$(stat -c '%a' "$CREDENTIAL_FILE")" "$(stat -c '%U:%G' "$CREDENTIAL_FILE")"
printf '\n  Apply it:  cd %s && docker compose --env-file app.env up -d\n' "$TARGET_DIR"
printf '  Collect it: ssh belso-vps '"'"'cat %s'"'"'\n' "$CREDENTIAL_FILE"
printf '\n  Nothing was printed. That file is the only copy.\n'
