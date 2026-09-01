# Spec 013 — The site is on the internet

- **Status:** active
- **Type:** feature
- **Requested by / owner:** Houssem Ferrani
- **Date:** 2026-09-01
- **Slice / areas touched:** no feature slice — `next.config.ts`, a container definition, the VPS's compose and reverse proxy, `.github/` (deploy on push), `docs/` (a runbook). Touches `src/core/env.ts` only if a variable is missing. <!-- used for conflict detection across active specs -->

## Problem (the why)

Spec 011 gave the client a back-office and she cannot reach it. Nothing is deployed: the VPS runs
Traefik and Postgres and nothing that serves the site, there is no container definition, no deploy
script and no runbook. Every feature since spec 004 has been verified on a laptop and has never
been used by the person it was built for.

The database is ahead of the site — production is migrated to `0006` and holds twenty real
listings — so the gap is entirely the application. This is the last thing standing between five
specs of work and a product.

## Desired behavior (the what)

A visitor types the agency's address and gets the site: the catalogue, the neighbourhoods, the map,
a listing, the contact form. The client goes to the same address with `/admin` on the end, signs
in, and edits the catalogue that the visitor is reading — her change is live within a minute or two
of her pressing publish, without anybody being asked to run anything.

Photographs she uploaded last month are still there after the site is next updated. This is worth
stating as behavior rather than leaving to the plan, because the obvious way to build it loses
them.

Publishing a change to the site is one action and needs no ceremony: merging to `main` deploys.
The site is briefly unavailable while it happens, which is acceptable — seconds, not minutes, on a
site whose traffic is a handful of visitors an hour.

When a deploy is broken, going back to the previous version is a documented action somebody can
take at speed, without reconstructing what the previous version was.

## Acceptance criteria

- **AC-1:** Given the agency's domain, when a visitor requests it over plain HTTP, then they arrive
  at the site over HTTPS with a valid certificate, and every public journey (catalogue,
  neighbourhood, listing, map, contact) works against the production database.
- **AC-2:** Given the client is at `/admin` on the public domain, when she signs in and publishes a
  change, then a visitor loading the affected page sees it without anybody deploying anything.
- **AC-3:** Given photographs uploaded through the back-office, when the site is deployed again,
  then those photographs are still served. Given the deployment is recreated from scratch, then
  they are still served.
- **AC-4:** Given a commit is pushed to `main`, when it builds, then it is running on the VPS
  without a human running a command; and given it does **not** build, then the deploy stops and the
  previously running version is still serving.
- **AC-5:** Given a deploy that started and left the site broken, when the documented rollback is
  followed, then the previous version is serving again, and the person doing it did not have to
  work out which version that was.
- **AC-6:** Given a deploy whose new container cannot read the catalogue, when the deploy runs, then
  it does not replace the running version, and the probe that decides this requires listings rather
  than a 200. The application's own behaviour on database loss is unchanged and deliberately so
  (spec 010, AC-5): it serves the outage page and does not exit.
- **AC-7:** Given the site is live, when the deployment's configuration is inspected, then no
  secret is present in the repository, in the image, or in any log line.

## Out of scope

- **Any second environment.** No staging, no preview deployments. One box, one site — the client
  has one, and a staging deployment nobody looks at is a second thing to keep in sync (ADR-0006).
- **Zero-downtime deploys.** A few seconds of unavailability is accepted; blue-green is more moving
  parts than a low-traffic agency site earns, and two versions briefly sharing one database is a
  worse failure than a 502.
- **Monitoring, alerting and uptime checks.** Worth having, not this spec — and meaningless before
  there is something to monitor.
- **A CDN, image CDN, or edge caching.** The box serves what it serves; measure before adding.
- **Scaling of any kind.** Two shared cores, one container, no replicas.
- **Moving the database.** It is already on this VPS, migrated and backed up nightly with a
  rehearsed restore.
- **The enquiry inbox** — [spec 012](../012-belso-inbox/spec.md), and independent of this.

## CUJ impact

- No new journey. **Every existing CUJ becomes true of the real site** rather than of a laptop —
  which is the point of the spec and is not a change to any of them.
- CUJ-01 through CUJ-06 must pass against the deployed site at least once, by hand, before this is
  called done. Their e2e suite continues to run locally.

## Preconditions (not open questions — they gate the ship, not the plan)

- **B-2, the domain.** There is none. Nothing here can be finished without it, and it is the only
  precondition that blocks AC-1 outright.
- **B-9, the privacy notice.** Going live means the contact form starts storing real names, emails
  and phone numbers, so this stops being a documentation debt and becomes the thing that decides
  whether the site may lawfully be public. It has been open since spec 010. It gates the deploy
  even though nothing technical depends on it.

## Amended after testing

**AC-6 originally said the application must refuse to start without a database.** Testing it showed
that would contradict spec 010, whose AC-5 deliberately keeps the site up and honest during an
outage — an unreachable database today produces a healthy container serving "indisponible", which
is correct and tested by `db-down.spec.ts`. Implementing the criterion as written would have
replaced a graceful outage page with a crash-looping container on a live site.

The requirement underneath it was about deploys, not the application, and AC-6 now says so.

## Resolved before planning

- **What gates a deploy: `pnpm verify`.**
  [ADR-0012](../../docs/architecture/decisions/0012-verify-on-push.md) is accepted, and AC-4 depends
  on it. A commit reaches the VPS only if lint, types, the tests and the build all pass. The weaker
  option — letting the deploy job discover a broken build — was rejected: it catches the failure
  that reached a branch during spec 011 and not a failing test, and after this spec the difference
  is the client's live website rather than a branch.
- **The credential points outward.** The VPS registers itself with GitHub and pulls work; GitHub
  never holds a key to the box. The conventional inbound SSH deploy key was rejected because a
  GitHub compromise would then be a root compromise of a machine that also runs the client's n8n.
  Recorded as [ADR-0013](../../docs/architecture/decisions/0013-deploy-from-the-box.md).
- **The agency owns the domain**, and grants access to point records. They keep the asset if the
  relationship ends, and the renewal is not on a developer's card. AC-1 waits on them, which is the
  right trade.
