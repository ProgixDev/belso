# Spec 013 — The site is on the internet

- **Status:** draft
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
- **AC-6:** Given the application cannot reach the database at boot, then it refuses to start rather
  than starting and serving a catalogue it cannot read — and the previously running version keeps
  serving.
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

## Open questions

- [ ] **Deploying on push to `main` puts a bad merge straight on the live site, and nothing
      currently gates `main`.** [ADR-0012](../../docs/architecture/decisions/0012-verify-on-push.md)
      proposes running `pnpm verify` on push and is `Proposed`; this spec's AC-4 assumes something
      decides whether a commit builds before it is deployed. Either that ADR is accepted and this
      depends on it, or AC-4's gate is the deploy job itself building the image and stopping on
      failure. The second is workable and weaker — it catches a broken build and not a failing test.
- [ ] **Automatic deploys need credentials the repository does not have.** A deploy key or token
      reaching the VPS from GitHub is the first secret this project stores outside the VPS, and
      ADR-0006's objection to cloud surfaces applies to it more than it did to CI. Worth an ADR of
      its own, or a decision to reverse the trigger to a manual command.
- [ ] **Who owns the domain and the DNS?** Registrar, and whether the agency or the developer holds
      the account, decides who can complete AC-1 and who is called when a certificate stops
      renewing.
