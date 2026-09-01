#!/usr/bin/env node
/**
 * Prove uploaded photographs survive a deploy (spec 013, AC-3).
 *
 * **The failure this exists to catch is silent.** Get the volume wrong and
 * everything looks correct: uploads succeed, the gallery renders, the site is
 * fine. The photographs disappear at the next deploy, and the first person to
 * notice is the client opening a listing that used to have pictures. There is
 * no error, no log line, and no backup — `belso-backup.sh` dumps Postgres and
 * does not touch the filesystem, so until T-18 extends it this volume holds the
 * only copy of every photograph she has uploaded.
 *
 * So the check does the thing rather than reading the compose file: writes a
 * marker into the volume through one container, destroys that container,
 * creates a new one from the same image, and reads the marker back.
 *
 * It deliberately does **not** deploy the stack. A compose `up` here would put
 * the application on the box before T-08 says to, and the property under test —
 * a named volume outliving the container that wrote it — needs neither Traefik
 * nor Postgres nor a domain.
 *
 * Runs the docker commands over SSH, as `restore-check.mjs` does, because the
 * VPS has Docker and no Node.
 *
 * Usage: pnpm ops:check-media
 */
import { execFileSync } from "node:child_process";

const HOST = process.env.BELSO_VPS ?? "belso-vps";
const VOLUME = "belso-media";
const IMAGE = process.env.BELSO_IMAGE ?? "belso:latest";
const MARKER = `check-media-${Date.now()}.txt`;
const CONTENT = `written by check-media at ${new Date().toISOString()}`;

const ssh = (script) =>
  execFileSync("ssh", [HOST, "bash", "-s"], { input: script, encoding: "utf8" }).trim();

function step(message) {
  console.log(`check-media: ${message}`);
}

let failed = false;

try {
  step(`volume "${VOLUME}" on ${HOST}, image ${IMAGE}`);
  ssh(`docker volume create ${VOLUME} >/dev/null`);

  /*
   * Written as the `node` user, which is who the application runs as. Writing
   * as root would pass here and fail in production the first time somebody
   * uploads a photograph — a check that is easier to satisfy than the thing it
   * checks is worse than no check.
   */
  step("writing a marker through one container, as the app's own user");
  ssh(`
    docker rm -f check-media-writer >/dev/null 2>&1 || true
    docker run --rm --name check-media-writer \
      -v ${VOLUME}:/app/media --entrypoint sh --user node ${IMAGE} \
      -c 'printf "%s" "${CONTENT}" > /app/media/${MARKER}'
  `);

  step("destroying that container and creating a new one from the same image");
  const readBack = ssh(`
    docker run --rm -v ${VOLUME}:/app/media --entrypoint sh --user node ${IMAGE} \
      -c 'cat /app/media/${MARKER} 2>/dev/null || echo "__MISSING__"'
  `);

  if (readBack !== CONTENT) {
    failed = true;
    console.error(`\ncheck-media ✗ the marker did not survive.`);
    console.error(`  wrote: ${CONTENT}`);
    console.error(`  read:  ${readBack}`);
    console.error(`\n  A photograph uploaded today would not survive the next deploy.`);
  } else {
    step("marker read back intact from a different container");
  }

  /*
   * And the negative case, because "the file was still there" is also what you
   * would see if the volume were never mounted and both containers had simply
   * written to their own filesystems. This asserts the volume is the reason.
   */
  step("confirming the volume is what carried it, not the image");
  const withoutVolume = ssh(`
    docker run --rm --entrypoint sh --user node ${IMAGE} \
      -c 'cat /app/media/${MARKER} 2>/dev/null || echo "__ABSENT__"'
  `);

  if (withoutVolume !== "__ABSENT__") {
    failed = true;
    console.error(`\ncheck-media ✗ the marker is in the image, not the volume.`);
    console.error(`  A container with no volume mounted still found it, so this`);
    console.error(`  check would pass with the volume removed entirely.`);
  } else {
    step("a container without the volume cannot see it — the volume is load-bearing");
  }
} finally {
  ssh(`
    docker run --rm -v ${VOLUME}:/app/media --entrypoint sh ${IMAGE} \
      -c 'rm -f /app/media/${MARKER}' >/dev/null 2>&1 || true
  `);
}

if (failed) process.exit(1);
console.log(`\ncheck-media ✓ photographs written today survive a container replaced tomorrow`);
