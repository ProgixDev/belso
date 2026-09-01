# Plan 013 — The site is on the internet

- **Spec:** [spec.md](spec.md) (all open questions resolved: **yes** — 2026-09-01)
- **Author:** Houssem Ferrani (+ Claude) · **Date:** 2026-09-01

## Approach

Build the application into a standalone container, run it on the VPS beside Postgres, and let
Traefik — already there, already terminating TLS for n8n — route the domain to it. `main` deploys
itself: `pnpm verify` runs on push ([ADR-0012](../../docs/architecture/decisions/0012-verify-on-push.md)),
and only if it passes does a runner **on the box** pull the change and restart the container
([ADR-0013](../../docs/architecture/decisions/0013-deploy-from-the-box.md)). Nothing reaches in
from outside.

The trade-off taken is simplicity over availability, as the spec asks: one container, stopped and
replaced, a few seconds of 502. What that buys is a deployment a person can hold in their head at
2am, and a rollback that is one command against a tagged image rather than a procedure.

**The two things this plan is actually about** are not the container. They are the media volume and
the boot guard. Photographs live on the filesystem, so the default containerisation destroys them
on the next deploy and nobody notices until the client opens a listing. And the app must fail to
start rather than start wrong, so that a bad configuration leaves the previous version serving
instead of replacing a working site with a broken one.

## Placement (per `docs/architecture/module-boundaries.md`)

No feature slice, no routes, no components. This spec adds operational surface, not application
surface — which is why the placement table is mostly empty and that is the correct outcome.

| What                | Where                          | Notes                                                                         |
| ------------------- | ------------------------------ | ----------------------------------------------------------------------------- |
| Build output        | `next.config.ts`               | `output: "standalone"` — the only change to application configuration         |
| Container           | `Dockerfile`, `.dockerignore`  | Repo root; multi-stage, non-root, no secrets in any layer                     |
| Runtime composition | `deploy/compose.yml`           | New directory. App + volume + Traefik labels. Postgres stays in its own stack |
| Deploy job          | `.github/workflows/deploy.yml` | **Protected path** — needs the hook lifted, as `verify.yml` does              |
| Runbook             | `docs/ops/deploy.md`           | New. Deploy, roll back, rotate a secret, what to do when the runner stops     |
| Env                 | `.env.example`                 | `NEXT_PUBLIC_SITE_URL` and `MEDIA_ROOT` documented for production             |

## Data & state

- **Server data:** unchanged. The application already reads Postgres over a pool; in production it
  reaches it over the Docker network rather than an SSH tunnel, which is a connection string and
  nothing else.
- **Client state:** none. No feature work here.
- **Actions:** none added.
- **The state that matters is on disk.** `MEDIA_ROOT` becomes a named volume mounted into the
  container. The original photographs and their WebP masters are the only data the database does
  not hold and the only data with no backup — `belso-backup.sh` dumps Postgres and does not touch
  the filesystem. This plan mounts the volume; **backing it up is named as a risk below, not
  quietly assumed.**

## Acceptance criteria → verification mapping

| AC       | Proven by                                                                                                                                                                                                                                                                                 |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AC-1** | Manual, once, against the real domain, walking CUJ-01/03/04/05 — plus `curl -I http://<domain>` asserting a 308 to HTTPS and a valid certificate. Recorded in `docs/reports/013-belso-deploy.md`                                                                                          |
| **AC-2** | Manual: publish a change in `/admin` on the live site, load the public page in a second browser, see it. This is CUJ-06 against production and is the acceptance for the whole spec                                                                                                       |
| **AC-3** | `deploy/media-volume.db.test.ts` is the wrong shape — this is infrastructure, so: a scripted check (`pnpm ops:check-media`) that writes a file into the volume, recreates the container, and reads it back. Run in T-04 and recorded                                                      |
| **AC-4** | Two real pushes: one green (deploys), one with a deliberately failing test on a branch merged to a scratch ref (does not deploy, previous container still `Up`). Evidence is the Actions run plus `docker ps`                                                                             |
| **AC-5** | Follow `docs/ops/deploy.md`'s rollback from a cold read, with a stopwatch, and record the elapsed time. If it needs a step that is not written down, the runbook is wrong                                                                                                                 |
| **AC-6** | `pnpm ops:check-serving` against a container pointed at an unreachable database: it must fail, because the catalogue is empty. Against a healthy one it must pass. The container itself stays up and serves the outage page either way — that is spec 010's AC-5 and is not being changed |
| **AC-7** | `pnpm secrets:check` in the pipeline, plus a manual `docker history` and `docker inspect` for the image and `journalctl` for the runner, asserting no credential appears                                                                                                                  |

**AC-3 and AC-6 are the two that will actually fail first** — AC-6 already did, by contradicting spec 010 before a line was written for it. It is reworded in the spec, not quietly reinterpreted here.

**Original note:**, and both are cheap to check and
expensive to discover late. They are sequenced early in `tasks.md` for that reason.

## Risks & unknowns

- **The media volume has no backup.** `belso-backup.sh` dumps Postgres nightly with a rehearsed
  restore; the photographs have nothing. This plan makes that gap load-bearing by putting the
  client's only copies on a volume on one box. **De-risked by T-18**, which extends the backup
  script to the media directory — not deferred, because the first upload after go-live is the
  moment the gap starts costing something irreversible.
- **Two shared cores now run a Next.js server as well as Postgres, n8n and a runner.** The measured
  upload cost is ~460ms per photograph projected (`pnpm measure:upload`), which was comfortable
  when nothing else competed. De-risked by measuring again after deploy (T-19) rather than assuming
  the projection survives contention.
- **A self-hosted runner executes repository code on the client's box.** Accepted in ADR-0013 with
  its mitigations; T-11 scopes it to this repository, runs it as a non-root user, and asserts the
  registration token is not committed.
- **Unknown: whether Traefik's existing configuration will route a second service cleanly.** It
  uses the Docker provider with `exposedbydefault=false`, so labels should be sufficient — but it
  is `network_mode: host`, which changes how it reaches a bridged container. **Spike in T-06**
  before the rest of the composition is written.
- **Unknown: the domain does not exist yet.** Everything through T-14 can be built and tested
  against the VPS's hostname; T-15 onward waits on B-2. The plan is sequenced so that the wait is
  at the end rather than the beginning.
- **B-9, the privacy notice, gates go-live and not the work.** Nothing here is blocked by it; the
  final cutover is. Named so it is not discovered on the day.

## Overlap check

Active specs: **009** (map view) — no overlap. It touches `src/features/properties` and a route;
this touches no application code beyond one line of `next.config.ts`. Nothing to sequence.

Spec **012** (inbox) is `draft` and independent: it adds a mail provider and a reading surface,
neither of which this plan constrains. If 012 lands first it deploys through this pipeline; if this
lands first, 012 is a normal push.
