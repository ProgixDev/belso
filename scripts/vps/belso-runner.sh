#!/usr/bin/env bash
#
# Register the self-hosted GitHub Actions runner on the VPS (spec 013, T-11,
# ADR-0013).
#
# The registration token arrives on **stdin**, so this file has to be on the box
# first — `ssh 'bash -s'` already uses stdin for the script itself:
#
#   scp scripts/vps/belso-runner.sh belso-vps:/root/belso-runner.sh
#   gh api -X POST repos/ProgixDev/belso/actions/runners/registration-token \
#     --jq .token | ssh belso-vps 'bash /root/belso-runner.sh'
#
# Piped rather than passed as an argument for the usual reason — an argument is
# visible in `ps` to every process on a box that also runs the client's n8n —
# and piped rather than echoed so the token never reaches a terminal, a
# scrollback or an agent's transcript. It is short-lived, but a short-lived
# credential in a log is still a credential in a log.
#
# **The runner user is deliberately not in the `docker` group.** That group is
# root-equivalent: a member can start a container with the host filesystem
# mounted. Adding the runner to it would hand every workflow run root on the
# client's machine, which is the exact outcome ADR-0013 chose the pull model to
# avoid — it would have moved the risk from "GitHub is compromised" to "anyone
# who can run a workflow", not removed it.
#
# So this installs the runner with no privileges at all. What it is allowed to
# do arrives with T-12, as one root-owned script and one narrow sudoers rule, so
# the privileged half is reviewed on the box rather than living in a YAML file
# that a pull request can edit.
#
# Undo: `sudo -u belso-ci /opt/actions-runner/config.sh remove --token <fresh>`,
# then delete the runner in GitHub's settings.
set -euo pipefail

RUNNER_VERSION="2.337.0"
RUNNER_SHA256="70920811a4f8ad4328818682bca5c6469c1c942fab52448868071d0063816613"
RUNNER_USER="belso-ci"
RUNNER_HOME="/opt/actions-runner"
REPO_URL="https://github.com/ProgixDev/belso"
RUNNER_NAME="belso-vps"
RUNNER_LABELS="self-hosted,linux,x64,belso-vps"

die() { printf 'belso-runner: FAILED — %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" = "0" ] || die "run this as root — it creates a user and a systemd unit"

TOKEN="$(cat)"
[ -n "$TOKEN" ] || die "no registration token on stdin — see the header for how to pipe one"

# Checked for shape, because "non-empty" is not the same as "a token".
#
# The first run of this was fed the *error message* from a `gh api` call that had
# failed — the pipeline delivered it exactly as though it were the token, and the
# script carried on and handed it to `config.sh`, which spent thirty seconds
# retrying against GitHub before failing with `Bad credentials`. The real
# problem, an insufficiently scoped token, was three screens further up. A
# registration token is a single run of uppercase letters and digits.
printf '%s' "$TOKEN" | grep -qE '^[A-Z0-9]{20,}$' \
  || die "that does not look like a registration token — did the command producing it fail? Its output is what arrived on stdin."

# --- the user ----------------------------------------------------------------
# A login shell because the runner's own service scripts expect one, but no
# password and no group beyond its own. It cannot use docker, cannot sudo, and
# owns nothing outside its home.
if ! id "$RUNNER_USER" >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash "$RUNNER_USER"
  passwd --lock "$RUNNER_USER" >/dev/null
  printf 'belso-runner: created user %s\n' "$RUNNER_USER"
else
  printf 'belso-runner: user %s already exists\n' "$RUNNER_USER"
fi

if id -nG "$RUNNER_USER" | tr ' ' '\n' | grep -qx docker; then
  die "$RUNNER_USER is in the docker group — that is root on this box; remove it and re-run"
fi

# --- the runner --------------------------------------------------------------
mkdir -p "$RUNNER_HOME"
chown "$RUNNER_USER:$RUNNER_USER" "$RUNNER_HOME"

TARBALL="actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"
if [ ! -f "${RUNNER_HOME}/config.sh" ]; then
  cd "$RUNNER_HOME"
  curl -fsSL -o "$TARBALL" \
    "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/${TARBALL}" \
    || die "downloading the runner failed"

  # Checked, not trusted. This is a binary that will execute code from the
  # repository on the client's machine; verifying it costs one line.
  echo "${RUNNER_SHA256}  ${TARBALL}" | sha256sum -c - \
    || die "checksum mismatch on ${TARBALL} — do not install it"

  tar xzf "$TARBALL"
  rm -f "$TARBALL"
  chown -R "$RUNNER_USER:$RUNNER_USER" "$RUNNER_HOME"
  printf 'belso-runner: installed runner %s\n' "$RUNNER_VERSION"
else
  printf 'belso-runner: runner already unpacked at %s\n' "$RUNNER_HOME"
fi

# --- register ----------------------------------------------------------------
# `--replace` so re-running rebinds this name instead of accumulating dead
# runners in GitHub's list. `--unattended` because there is no terminal here.
#
# The token goes in through the environment of a single `sudo -u` call rather
# than on the command line, so it is not in `ps` for the seconds registration
# takes. `config.sh` writes `.credentials`, which is the durable secret — the
# registration token is spent at this point.
sudo -u "$RUNNER_USER" env RUNNER_TOKEN="$TOKEN" bash -c "
  cd '$RUNNER_HOME' &&
  ./config.sh --unattended --replace \
    --url '$REPO_URL' \
    --token \"\$RUNNER_TOKEN\" \
    --name '$RUNNER_NAME' \
    --labels '$RUNNER_LABELS' \
    --work _work
" || die "config.sh failed — the token may have expired (they last an hour)"

chmod 600 "${RUNNER_HOME}/.credentials" "${RUNNER_HOME}/.runner" 2>/dev/null || true

# --- systemd -----------------------------------------------------------------
# The runner's own installer, which writes an `actions.runner.*` unit with
# Restart=always and enables it, so it comes back after a reboot.
cd "$RUNNER_HOME"
./svc.sh install "$RUNNER_USER" || die "svc.sh install failed"
./svc.sh start || die "svc.sh start failed"

UNIT="$(systemctl list-units --type=service --all --no-legend 'actions.runner.*' | awk '{print $1}' | head -1)"

printf '\nbelso-runner: registered %s\n' "$RUNNER_NAME"
printf '  user:    %s (no docker group, no sudo)\n' "$RUNNER_USER"
printf '  labels:  %s\n' "$RUNNER_LABELS"
printf '  unit:    %s\n' "${UNIT:-unknown}"
printf '  enabled: %s\n' "$(systemctl is-enabled "${UNIT:-nonexistent}" 2>/dev/null || echo unknown)"
printf '  active:  %s\n' "$(systemctl is-active "${UNIT:-nonexistent}" 2>/dev/null || echo unknown)"
printf '\n  It can do nothing yet. T-12 grants exactly one privileged command.\n'
