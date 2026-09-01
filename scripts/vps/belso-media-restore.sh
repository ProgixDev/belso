#!/usr/bin/env bash
#
# Put photographs back into the media volume from a nightly archive
# (spec 013, T-18).
#
#   ssh belso-vps 'bash -s' -- list                       < scripts/vps/belso-media-restore.sh
#   ssh belso-vps 'bash -s' -- one 2026/09/villa.jpg      < scripts/vps/belso-media-restore.sh
#   ssh belso-vps 'bash -s' -- all                        < scripts/vps/belso-media-restore.sh
#
# An older archive than the newest: add `--archive=belso-media-<stamp>.tgz`
# anywhere in the arguments.
#
# **The half of a backup that is usually missing.** `belso-backup.sh` writes the
# archive and verifies it lists the right number of files, which proves the file
# is readable — not that anybody knows how to get a photograph out of it at the
# moment one is needed. That is the difference between a backup and a restore,
# and it is only ever discovered on the bad day.
#
# `one` is the case that actually happens: the client deletes a listing's
# photograph by mistake and wants it back. Restoring the whole volume to recover
# one file would also revert every upload since the archive was taken.
#
# Paths are given as they appear inside the volume, without a leading slash —
# `list` prints them in exactly that form.
set -euo pipefail

BACKUP_DIR="/root/backups/belso"
MEDIA_VOLUME="belso-media"
TAR_IMAGE=postgres:17-alpine

die() { printf 'belso-media-restore: FAILED — %s\n' "$*" >&2; exit 1; }

# The archive is a named option and the path is everything else, because **ssh
# does not preserve the caller's quoting**: `bash -s -- one 'riad médina.jpg'`
# reaches the remote shell as one flat string, which splits it again into `riad`
# and `médina.jpg`. Photograph filenames have spaces in them, so reading `$2` as
# the path would fail on exactly the files most likely to need restoring — and
# fail by reporting that the file is not in the archive, which reads as a broken
# backup rather than a broken argument.
ARCHIVE=""
POSITIONAL=()
for argument in "$@"; do
  case "$argument" in
    --archive=*) ARCHIVE="${argument#--archive=}" ;;
    *) POSITIONAL+=("$argument") ;;
  esac
done
set -- "${POSITIONAL[@]+"${POSITIONAL[@]}"}"

MODE="${1:-}"
case "$MODE" in
  list | one | all) ;;
  *) die "usage: list | one <path> | all   [--archive=belso-media-<stamp>.tgz]" ;;
esac

command -v docker >/dev/null || die "docker is not on PATH — is this the VPS?"

if [ "$MODE" = "list" ]; then
  printf '\nArchives in %s:\n' "$BACKUP_DIR"
  ls -1t "$BACKUP_DIR"/belso-media-*.tgz 2>/dev/null | head -20 | while read -r file; do
    printf '  %s  %s\n' "$(basename "$file")" "$(stat -c '%y' "$file" | cut -d. -f1)"
  done
  newest="$(ls -1t "$BACKUP_DIR"/belso-media-*.tgz 2>/dev/null | head -1)"
  [ -n "$newest" ] || die "no media archives yet — has belso-backup.sh run since T-18?"
  printf '\nFiles in the newest (%s):\n' "$(basename "$newest")"
  docker run --rm -v "${BACKUP_DIR}:/out:ro" "$TAR_IMAGE" \
    sh -c "tar -tzf /out/$(basename "$newest") | grep -v '/\$' | sed 's|^\./||'" | head -40
  exit 0
fi

TARGET=""
if [ "$MODE" = "one" ]; then
  shift
  TARGET="$*"
  [ -n "$TARGET" ] || die "one needs the path of the file to restore — run \`list\` to see them"
fi

# Newest by default. Named explicitly when the newest already contains the
# mistake — a photograph deleted on Tuesday is not in Wednesday's archive.
if [ -z "$ARCHIVE" ]; then
  ARCHIVE="$(basename "$(ls -1t "$BACKUP_DIR"/belso-media-*.tgz 2>/dev/null | head -1)")"
  [ -n "$ARCHIVE" ] || die "no media archives in ${BACKUP_DIR}"
fi
[ -f "${BACKUP_DIR}/${ARCHIVE}" ] || die "no archive named ${ARCHIVE} in ${BACKUP_DIR}"

docker volume inspect "$MEDIA_VOLUME" >/dev/null 2>&1 \
  || die "volume ${MEDIA_VOLUME} does not exist"

if [ "$MODE" = "one" ]; then
  # Checked before extracting, so a mistyped path says so instead of silently
  # restoring nothing and reporting success.
  # `$TARGET` arrives as an argument to `sh -c`, not interpolated into it. It is
  # an operator-supplied path, this container runs as root with the whole backup
  # directory mounted — every database dump, so every enquiry — and a path
  # containing a single quote would have closed the string and run whatever
  # followed. Not reachable today, because `media.ts` names uploads
  # `<uuid>/master.webp` from sniffed bytes and never from the filename; but this
  # script's own header advertises restoring files with spaces and accents in
  # them, so the input it invites is not the input the application produces.
  docker run --rm -v "${BACKUP_DIR}:/out:ro" "$TAR_IMAGE" \
    sh -c 'tar -tzf "/out/$1" | sed "s|^\./||" | grep -qxF "$2"' _ "$ARCHIVE" "$TARGET" \
    || die "${TARGET} is not in ${ARCHIVE} — run \`list\` to see what is"

  docker run --rm -v "${MEDIA_VOLUME}:/media" -v "${BACKUP_DIR}:/out:ro" "$TAR_IMAGE" \
    tar -xzf "/out/${ARCHIVE}" -C /media "./${TARGET}"

  printf '\nbelso-media-restore: restored %s from %s\n' "$TARGET" "$ARCHIVE"
else
  # Additive, not a replacement: extracting over the volume puts back what is
  # missing and overwrites what shares a name, and leaves everything uploaded
  # since the archive alone. Wiping first would turn "restore a lost file" into
  # "lose every photograph added this week", which is a worse accident than the
  # one being repaired.
  docker run --rm -v "${MEDIA_VOLUME}:/media" -v "${BACKUP_DIR}:/out:ro" "$TAR_IMAGE" \
    tar -xzf "/out/${ARCHIVE}" -C /media

  count=$(docker run --rm -v "${MEDIA_VOLUME}:/media:ro" "$TAR_IMAGE" \
    sh -c 'find /media -type f | wc -l')
  printf '\nbelso-media-restore: extracted %s over the volume\n' "$ARCHIVE"
  printf '  the volume now holds %s file(s)\n' "$count"
  printf '  files uploaded since the archive were left in place, not removed\n'
fi
