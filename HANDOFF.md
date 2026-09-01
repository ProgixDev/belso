# Handoff — spec 011, the back-office

**Written:** 31/08/2026 · **Branch:** `feat/011-back-office` · **Head:** `745318d` (pushed)
**For:** the next session, on a new machine, with no memory of this one.

Read this first, then [`specs/011-belso-back-office/tasks.md`](specs/011-belso-back-office/tasks.md)
— it carries the task list, the AC coverage, and a "what this phase turned up" section per phase
that is more detailed than anything here.

---

## Where the work stands

**Spec 011 is code-complete. Phases 0–4 are done (T0–T23); Phases 5 and 6 remain (T24–T30).**

All nine acceptance criteria have a test at the altitude the criterion is written at. The client
can sign in, create a listing, write it in French, publish it, translate it later, rename it,
upload and order photographs, and archive it — driven end to end against a production build as
CUJ-06.

Gates, last run on 31/08 before the push:

| Gate               | Result                                  |
| ------------------ | --------------------------------------- |
| `pnpm verify`      | green                                   |
| `pnpm test:db`     | 42 passed                               |
| `CI=true pnpm e2e` | 95 passed, 0 failed, 0 flaky, 3 skipped |

---

## ⚠️ Do this on the OLD machine, before you wipe it

**Copy `~/.ssh/belso_vps` and `~/.ssh/belso_vps.pub` somewhere safe.** They are the only way into
the VPS, they are not in this repository and they cannot be regenerated from it. Without them the
database, the migrations, the backups and the whole of `pnpm test:db` are unreachable, and getting
back in means Hostinger's console.

Better, if you have five minutes: generate a **new** key on the new machine and append its public
half to the server before you leave the old one —

```bash
# on the new machine
ssh-keygen -t ed25519 -f ~/.ssh/belso_vps -C "belso@<new-machine>"

# on the old machine, with the new public key pasted in
ssh belso-vps "echo '<paste ssh-ed25519 …>' >> ~/.ssh/authorized_keys"
```

That also closes a standing risk: the current key **has no passphrase and grants root**
(`docs/security/vps.md`). Moving machines is the natural moment to give the new one a passphrase.

---

## First hour on the new machine

### 1. Clone and install

```bash
git clone https://github.com/ProgixDev/belso.git
cd belso
git checkout feat/011-back-office
pnpm install
```

`pnpm verify` should be green immediately, with no database. That is by design — the site serves
fixtures when `DATABASE_URL` is unset, so a fresh clone can work on the front end without a tunnel.

### 2. SSH access

`~/.ssh/config` needs this entry (the alias is used by `pnpm db:tunnel` and by every script in
`scripts/vps/`):

```
Host belso-vps
    HostName srv1843841.hstgr.cloud
    User root
    IdentityFile ~/.ssh/belso_vps
    IdentitiesOnly yes
```

Then `ssh belso-vps "docker ps"` should list `belso-db-db-1`, `n8n-6w7b-n8n-1`, `traefik-traefik-1`.

### 3. The tunnel

Postgres is bound to the VPS loopback and is not reachable from the internet, deliberately.
Everything local goes through a tunnel, which must be running for `pnpm test:db` and for any e2e
run against a database:

```bash
pnpm db:tunnel        # ssh -N -L 55432:127.0.0.1:5432 belso-vps — leave it running
```

### 4. `.env.local` — regenerate, do not go looking for it

It is gitignored and was never in the repository. Three values, all reissuable:

```bash
# a) the owner password, for DATABASE_URL (local development points at belso_test, never belso)
ssh belso-vps "grep '^POSTGRES_PASSWORD=' /docker/belso-db/.env"

# b) a fresh belso_editor password, for DATABASE_EDITOR_URL
ssh belso-vps 'bash -s' -- belso_editor < scripts/vps/belso-roles.sh
```

Write them into `.env.local`, pointing at **`belso_test`** and port **55432**:

```
DATABASE_URL=postgres://belso:<owner-password-urlencoded>@127.0.0.1:55432/belso_test
DATABASE_EDITOR_URL=postgres://belso_editor:<from-the-script>@127.0.0.1:55432/belso_test
BELSO_E2E_ADMIN_EMAIL=sofia@belso.ma
BELSO_E2E_ADMIN_PASSWORD=<see below>
```

Then reset the e2e account's password to whatever you put in that last line:

```bash
printf '%s' '<the password>' | pnpm admin:user password sofia@belso.ma --stdin
```

**Never point local development at the `belso` database.** `pnpm db:seed` upserts every fixture and
would overwrite the client's own edits; the e2e suite submits real enquiries. Both suites refuse a
database whose name does not match `_test$|^test_|scratch`, and `belso_test` already exists on the
server with migrations 0001–0006 applied and the fixtures seeded.

**Do not rotate `belso_app`.** Its password is set on the server and held by the deployment; this
machine does not know it and does not need it. `scripts/vps/belso-roles.sh` takes a role argument
precisely so you can provision `belso_editor` alone — rotating `belso_app` invalidates the live
storefront's credential, and the failure only appears at its next process start.

### 5. Prove it

```bash
pnpm verify

pnpm test:db                    # expect 42 passed
PORT=3001 CI=true pnpm e2e      # expect 95 passed, 3 skipped
```

**The variables no longer need exporting.** They did — Next reads `.env.local` and Playwright did
not, so the two disagreed about which database was in play, and the scratch-database guard was
reading a variable the server never used. `scripts/lib/env-local.mjs` and `playwright.config.ts`
now resolve `.env.local` the same way the application does, so `pnpm test:db` and `pnpm e2e` find
the connection on their own. An exported variable still wins, so the old commands also work.

`CI=true` is what makes it build and run `pnpm start` rather than reuse a dev server. Do not drop
it: with `reuseExistingServer` a plain `pnpm e2e` against an occupied port runs the whole suite
against whatever is already listening — which on this machine was a different project's Next
server, on port 3000. Hence `PORT=3001`; any free port will do.

The admin and editor specs skip themselves without `BELSO_E2E_ADMIN_EMAIL` and
`BELSO_E2E_ADMIN_PASSWORD` rather than passing vacuously, so a green summary with ten skips is not
the same as a green summary — check the skip count. Both belong in `.env.local`.

### 6. Two things a fresh machine needs that nothing prompts for

```bash
pnpm exec playwright install chromium   # ~112 MB; without it every browser test fails
```

And `THROTTLE_SECRET` must be set before anything runs in production — `src/core/env.ts` refuses
to boot without it, on every route rather than only `/admin`. `.env.example` carries the
generation command. It is not needed for local development.

---

## What was built (a map, not a tour)

| Where                                       | What                                                                                                                                                 |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/core/db.ts`                            | Two pools. `query` reads as `belso_app`; `editorQuery`/`editorTransaction` write as `belso_editor`. `PostgresError extends DatabaseUnavailableError` |
| `src/core/session.ts` · `session-cookie.ts` | Sessions as a table; the cookie name and paths live in the import-free module so `proxy.ts` can use them on Edge without pulling in `pg`             |
| `src/features/admin/`                       | scrypt passwords, the two-axis login throttle, sign-in                                                                                               |
| `src/features/properties/writes.ts`         | Every catalogue write, one transaction each, version check first                                                                                     |
| `src/features/properties/admin-actions.ts`  | `requireSession()` on line one of every export; publish is stricter than save                                                                        |
| `src/features/properties/media.ts`          | Original kept, one 2560px WebP master, EXIF stripped                                                                                                 |
| `src/app/(admin)/`                          | A **third root layout**, so `<html lang>` is French                                                                                                  |
| `src/app/(system)/media/[...file]/route.ts` | Serves photographs; refuses three independent ways                                                                                                   |
| `db/migrations/0005`, `0006`                | Accounts, sessions, `properties.version` + triggers, deferrable media constraint; `belso_editor` and its grants                                      |
| `db/checks/role-grants.sql`                 | The grants as executable assertions, run by `src/core/role-grants.db.test.ts`                                                                        |

Decisions are recorded in [ADR-0010](docs/architecture/decisions/0010-two-database-roles.md) (two
roles) and [ADR-0011](docs/architecture/decisions/0011-sessions-in-postgres.md) (sessions, scrypt,
no auth library). Read both before changing anything about auth or the role split — they answer
"why not next-auth" and "why not just widen `belso_app`", which are the first two questions anyone
asks.

---

## What remains

**T24–T26 (Phase 5, verification).** Largely satisfied by the runs above, but not ticked, and the
ticking should follow a real run rather than this document:

- **T24** — CUJ-01/03/04/05 must be unchanged. They are. If one of them ever needs its assertion
  edited to pass, that is a red flag, not a fix.
- **T25** — `pnpm verify:db` (migrate + seed + test:db + restore-check) has not been run as one
  command since the recovery; run it. Screenshots exist in `artifacts/screenshots/baseline/` as
  `50-*` through `67-*` and were looked at — two defects came out of doing so — but the task asks
  for them under `artifacts/screenshots/011-belso-back-office/`, which means running with
  `FEATURE=011-belso-back-office`.
- **T26** — CUJ-06 is registered in `docs/product/critical-user-journeys.md`. **The editor's save
  time against the two-core box has not been measured.** Do not assume it; the upload path is
  fifteen sequential decode-and-encode cycles and that is the number worth knowing.

**T27–T30 (Phase 6, ship).**

- **T27 `/security-review` is not optional here** — a new auth surface, a new credential, file
  upload, and PII all landed in one spec.
- **T28 `/review`**, then fix P0/P1.
- **T29 `/feature-report`** → `docs/reports/011-belso-back-office.md`.
- **Worth proposing to the owner: there is no CI.** Every gate here is run by hand. A workflow
  running `pnpm verify` on push — no secrets needed, since the build is meant to work without a
  database — would have caught the prerender failure above before it reached the branch. Not added
  unasked, because it is a decision with a cost.
- **T30 `/update-docs`** — and specifically **reconcile `/plan.md`**, the product roadmap, which
  still promises this work as `specs/003-belso-backoffice` built on self-hosted Supabase that
  ADR-0008 removed. An agent grounding on that file plans against a repository that no longer
  exists.

---

## Traps this session already paid for

Each of these cost real time. They are recorded so they are not paid for twice.

1. **A test that cannot fail is worse than no test.** Three separate instances here: the AC-10
   concurrency test passed with the row lock deleted (the two transactions never overlapped,
   because opening a second connection through the tunnel took longer than the first transaction);
   an e2e assertion matched the page it had not navigated away from, because the admin page's own
   `h1` is the listing title; and a "caption saved" wait passed on a status flag left true by the
   previous action. **Before trusting a new test, break the thing it guards and watch it go red.**
2. **`pnpm e2e` writes to whatever database it is pointed at.** A previous session put a real
   enquiry into the client's live table. Both suites now refuse a non-`_test` database — do not
   weaken that guard, and do not set `BELSO_ALLOW_PROD_TESTS=1` without meaning it exactly.
3. **A stale `pnpm dev` on port 3000 will silently serve months-old code.** Playwright reuses an
   existing server locally. If behaviour makes no sense, check what is listening on 3000 before
   debugging the code.
4. **Editing a file with a string replacement, then formatting it, then "restoring" the edit** —
   the restore lands in the wrong place because the formatter reflowed the anchor. This broke the
   photograph reorder and cost an hour of diagnosing the wrong layer. **Re-run the check
   immediately after restoring it**, not at the end of the phase.
5. **Server Actions called from event handlers swallow rejections.** Nothing above them catches; the
   interface does nothing for ever, with no message and no server log. `PhotographManager.run()`
   has the `catch` that fixes this — keep it.
6. **A backtick inside a template literal ends the template.** SQL comments in `row.ts` must not
   use them.
7. `python`'s `write_text` on Windows writes CRLF unless you pass `newline="\n"`. A shell script
   with CRLF fails on the VPS with a message that looks like a bash version problem.
8. **`pnpm verify` passing locally does not mean it passes on a clean clone.** Next reads
   `.env.local`, so a machine that has one builds with a database configured and a fresh clone does
   not. `/admin/listings` was being prerendered and threw on the unset `DATABASE_EDITOR_URL`,
   failing the whole build — while local `verify` was green. Before pushing, run
   `DATABASE_URL= DATABASE_EDITOR_URL= pnpm build`, or clone the branch somewhere clean and run
   `pnpm verify` there. **There is no CI in this repository** (`.github/` holds a CODEOWNERS file
   and a PR template, no workflows), so nothing else will catch it.

---

## Decisions that are not yours (or mine) to make

These are carried from spec 010 and still open. They gate production, not development.

- **The privacy notice has no owner.** The site now stores names, emails and phone numbers. This
  gates setting a production `DATABASE_URL` at all.
- **Retention is 24 months from collection**; CNIL guidance for prospect data is three years from
  last contact. Expressed as a per-row `expires_at`, so changing it changes one default.
- **No mail provider chosen**, which is why the enquiry inbox and its notification were split out
  into [spec 012](specs/012-belso-inbox/spec.md). Enquiries are stored and nobody is told, while the
  contact page promises a reply within 24 hours.
- **Hostinger snapshots unconfirmed.** The database's own backups are in place and verified
  nightly; the machine's are not.
- **`belso_app`'s password should be rotated deliberately** by whoever holds the deployment.

---

## One process note

The five commits for phases 0–4 sat unpushed for a full session, and were lost when something
deleted `.git` and every root-level file from the working directory. The working tree survived, so
the content was recovered and pushed as the single commit `745318d` — but the granularity is gone,
and that was avoidable.

**Push at every phase boundary.** Not at the end of the day, and not when the branch is "ready".
