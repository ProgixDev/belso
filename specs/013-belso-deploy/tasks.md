# Tasks 013 — The site is on the internet

Ordered, executable, checkboxed. An agent works top-to-bottom, ticks boxes as it commits, and never
reorders silently. `[P]` marks tasks safe to parallelize. Every task names its files and its
done-check.

**This spec touches a live machine that is not ours.** Two rules override the usual loop. Nothing
here runs against the client's box without the step above it having been verified — the sequencing
is the safety mechanism, not bureaucracy. And every task that changes the VPS says how to undo
itself; a task that cannot be undone is written as two.

## Phase 0 — the container, entirely local (no VPS)

- [ ] **T-01** `output: "standalone"` in `next.config.ts` · done: `pnpm build` still green and
      `.next/standalone/server.js` exists
- [ ] **T-02** `Dockerfile` (multi-stage: deps → build → runtime on `node:22-alpine`, non-root
      user, `HEALTHCHECK` hitting a static route) and `.dockerignore` (must exclude `.env*`,
      `.git`, `artifacts/`, `node_modules`) · done: `docker build` succeeds and
      `docker history --no-trunc` shows no secret and no `.env` layer (**AC-7**, first half)
- [ ] **T-03** Run the image locally against `belso_test` through the tunnel · done: the catalogue
      renders and `/admin` redirects to sign-in, from the container, on a laptop

## Phase 1 — the two things that will fail first

Deliberately before any deploy machinery. Both are cheap now and expensive after go-live.

- [ ] **T-04** `deploy/compose.yml` with a **named volume for `MEDIA_ROOT`**, and `pnpm ops:check-media`
      — a script that writes a file into the volume, recreates the container, and reads it back ·
      done: the check passes, and passes again after `docker compose down` without `-v` (**AC-3**)
- [ ] **T-05** Prove the boot guard survives containerisation: run the image with a deliberately
      wrong `DATABASE_URL` · done: the container exits non-zero rather than serving, and
      `docker compose up -d` leaves the previous container running (**AC-6**)

## Phase 2 — the VPS, still without a domain

Each task states its undo. The site is not public at the end of this phase; it is reachable at the
VPS hostname.

- [ ] **T-06** **Spike:** confirm Traefik (`network_mode: host`, Docker provider,
      `exposedbydefault=false`) routes to a bridged container by label · done: a throwaway
      `whoami` container answers on the VPS hostname · **undo:** `docker rm -f` the throwaway. Stop
      here and re-plan the routing if it does not
- [ ] **T-07** Provision production configuration on the box — `THROTTLE_SECRET` (`openssl rand -base64 32`),
      `DATABASE_EDITOR_URL` via `scripts/vps/belso-roles.sh belso_editor`, `MEDIA_ROOT`,
      `NEXT_PUBLIC_SITE_URL` · done: present in the compose env file, `chmod 600`, owned by root,
      and **not** in the repository · **undo:** the file is new; delete it
- [ ] **T-08** Deploy by hand, once, to the VPS hostname · done: the catalogue serves the twenty
      real listings from the production database, and `/admin` signs in · **undo:**
      `docker compose down` — the site was not public, so there is nothing to restore
- [ ] **T-09** [P] `docs/ops/deploy.md`: deploy, roll back, rotate a secret, what to do when the
      runner stops, and where the media volume lives · done: a second person could follow it

## Phase 3 — automation

- [ ] **T-10** `.github/workflows/verify.yml` (ADR-0012) · done: a push runs `pnpm verify` and a
      deliberately broken commit on a branch goes red · **needs the protect-paths hook lifted**
- [ ] **T-11** Register the self-hosted runner: scoped to this repository, **non-root user**,
      systemd unit, token not committed · done: it appears online in GitHub and survives a reboot ·
      **undo:** `./config.sh remove` on the box and delete the runner in GitHub (**AC-7**, ADR-0013)
- [ ] **T-12** `.github/workflows/deploy.yml`: on push to `main`, **needs** the verify job, then
      pulls, builds and restarts on the runner; tags the image with the commit sha · done: a green
      push deploys and `docker ps` shows the new sha · **needs the hook lifted**
- [ ] **T-13** Prove the gate: merge a commit that fails a test · done: no deploy happens and the
      previous container is still `Up` (**AC-4**)
- [ ] **T-14** Prove the rollback from the runbook, cold, with a stopwatch · done: previous version
      serving, elapsed time recorded; **if a step was missing, fix the runbook, not the memory of
      it** (**AC-5**)

## Phase 4 — the parts that need the domain (blocked on B-2)

- [ ] **T-15** Point DNS at the VPS; Traefik obtains a certificate · done: `curl -I http://<domain>`
      redirects to HTTPS with a valid certificate (**AC-1**, first half)
- [ ] **T-16** Set `NEXT_PUBLIC_SITE_URL` to the real domain and redeploy · done: the sitemap and
      the JSON-LD carry the real host, not `localhost:3000` — **this needs a rebuild, not a
      restart**, because it is inlined at build time
- [ ] **T-17** Walk CUJ-01/03/04/05 by hand on the live site, and CUJ-06 end to end: sign in,
      publish, see it public · done: screenshots captured into
      `artifacts/screenshots/013-belso-deploy/` (**AC-1**, **AC-2**)

## Phase 5 — the gaps this spec created

- [ ] **T-18** Extend `scripts/vps/belso-backup.sh` to the media volume, with a restore check · done:
      a photograph deleted from the volume is recoverable from a backup. **Not optional and not
      deferred:** the client's photographs become the only unbacked-up data on the box the moment
      T-08 lands
- [ ] **T-19** Re-run `pnpm measure:upload` on the deployed box · done: the real number replaces the
      ~460ms projection in `specs/011-belso-back-office/tasks.md`, which was measured with nothing
      else competing for the cores

## Phase 6 — review & ship

- [ ] **T-20** `/security-review` — a new runtime surface, a new credential, a persistent agent on
      the client's box
- [ ] **T-21** `/review`; fix P0/P1
- [ ] **T-22** `/feature-report` → `docs/reports/013-belso-deploy.md`
- [ ] **T-23** `/update-docs` — `docs/ops/deploy.md` indexed, `docs/architecture/overview.md` gains
      the deployed shape, spec index → shipped

## Preconditions outside this list

- **B-2, the domain** — blocks Phase 4. Phases 0–3 and 5 do not wait for it.
- **B-9, the privacy notice** — blocks go-live, not the work. The site must not be publicly
  reachable with a working contact form before it exists.

## AC coverage (mirror of plan.md — keep ticked in sync)

- [ ] AC-1 → T-15, T-17 · [ ] AC-2 → T-17 · [ ] AC-3 → T-04
- [ ] AC-4 → T-12, T-13 · [ ] AC-5 → T-14 · [ ] AC-6 → T-05 · [ ] AC-7 → T-02, T-07, T-11
