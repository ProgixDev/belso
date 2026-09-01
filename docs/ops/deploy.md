# Deploying Belso

How the site gets onto the VPS, how to put it back, and what to do when it misbehaves. Written to
be followed by someone who has not done it before.

The machine itself — what is exposed, how it is hardened, the database, the nightly backup — is
[security/vps.md](../security/vps.md). This file is only about the application.

## What is running

| Thing            | Where                                                       |
| ---------------- | ----------------------------------------------------------- |
| The app          | `belso-app`, image `belso:<commit sha>`, on `belso-net`     |
| Its config       | `/docker/belso/app.env` — mode 600, root, not in the repo   |
| Its compose file | `/docker/belso/compose.yml`, a copy of `deploy/compose.yml` |
| Photographs      | Docker volume `belso-media`, mounted at `/app/media`        |
| The database     | `belso-db-db-1`, its own stack in `/docker/belso-db/`       |
| The front door   | Traefik, host network, routes by label                      |

`app.env` is the record of what this box is meant to be running. `BELSO_TAG` names the commit,
`BELSO_BASIC_AUTH` holds the pre-launch gate, and the rest is connection details and secrets.

## The site is behind a password

Every request answers `401` without a credential, storefront and back-office alike. This is
deliberate: Traefik obtains a certificate for the hostname, which publishes it to the Certificate
Transparency logs within minutes, so “nobody knows the URL” is not true and never was. The site
must not be reachable with a working contact form before the privacy notice exists (B-9).

```bash
ssh belso-vps 'cat /docker/belso/gate-credentials.txt'    # user:password, for a browser or curl
ssh belso-vps 'bash -s' < scripts/vps/belso-gate.sh       # rotate it, then redeploy
```

Removing the gate is deleting the two `belso-gate` labels from `deploy/compose.yml`, and it is a
reviewed change, not a switch. There is no `off` argument on purpose.

## Deploy

Every deploy is by hand today. The automated path is spec 013 phase 3 and does not exist yet — see
[when the runner stops](#when-the-runner-stops).

Run `pnpm verify` first. Nothing below checks that the tree is green.

```bash
SHA=$(git rev-parse --short HEAD)

# 1. Ship the committed tree. `git archive`, not a clone: no repository
#    credential goes near the client's box.
git archive --format=tar HEAD | gzip |
  ssh belso-vps 'rm -rf /docker/belso/build && mkdir -p /docker/belso/build &&
                 tar -xzf - -C /docker/belso/build'

# 2. If deploy/compose.yml changed, copy it too. Nothing does this for you.
scp deploy/compose.yml belso-vps:/docker/belso/compose.yml

# 3. Build on the box, tagged with the commit.
ssh belso-vps "cd /docker/belso/build && docker build \
  --build-arg NEXT_PUBLIC_SITE_URL=https://srv1843841.hstgr.cloud \
  -t belso:$SHA ."

# 4. Record the tag, then bring it up.
ssh belso-vps "sed -i 's/^BELSO_TAG=.*/BELSO_TAG=$SHA/' /docker/belso/app.env &&
               cd /docker/belso && docker compose --env-file app.env up -d"
```

**`--env-file app.env` is not optional and is not the same as the `env_file:` line inside the
compose file.** That one fills the container; this one is where compose reads `${BELSO_TAG}` and
`${BELSO_DOMAIN}` for the image name and the Traefik labels. Without it the deploy stops on a
missing `BELSO_TAG`, which is the intended behavior — a silent fall back to `latest` is how you end
up unable to say which commit is serving.

**`NEXT_PUBLIC_SITE_URL` is baked into the image.** It is inlined at build time, so changing the
domain means a rebuild, not a restart. Setting it in `app.env` would do nothing while looking like
it worked, and the sitemap would go on naming the old host.

### Then prove it

A healthy container is not a working site. Point the app at an unreachable database and it comes up
healthy, answers `200`, and serves the “listings cannot be loaded” page — correct behavior, and not
something to deploy over a working catalogue.

```bash
export BELSO_PROBE_AUTH="$(ssh belso-vps 'cat /docker/belso/gate-credentials.txt')"

pnpm ops:check-serving https://srv1843841.hstgr.cloud

BELSO_ADMIN_EMAIL=sofia@belso.ma \
BELSO_ADMIN_PASSWORD="$(ssh belso-vps 'cat /docker/belso/back-office-password.txt')" \
  pnpm ops:check-signin https://srv1843841.hstgr.cloud
```

`check-serving` requires listing URLs in the sitemap, not a `200`. `check-signin` drives a real
browser: a wrong password refused, the real one in, the catalogue visible to the editor role. They
fail for different reasons, which is why there are two — the storefront and the back-office use
different database roles on different connection strings.

## Roll back

A rollback is one line, because the tag is recorded rather than typed.

```bash
ssh belso-vps 'docker images belso --format "{{.Tag}}  {{.CreatedAt}}"'   # what is available

ssh belso-vps "sed -i 's/^BELSO_TAG=.*/BELSO_TAG=<previous sha>/' /docker/belso/app.env &&
               cd /docker/belso && docker compose --env-file app.env up -d"
```

Then re-run the two probes above. A rollback that nobody checked is a guess.

**A rollback does not undo a migration.** Migrations are forward-only; the schema stays where the
bad deploy left it, and an older image meeting a newer schema may fail in ways the probes will
catch but the container will not. If the deploy included a migration, restore the database from a
dump instead — [security/vps.md](../security/vps.md#backups).

## Rotate a secret

Each of these rewrites `app.env` and needs a `docker compose --env-file app.env up -d` afterwards to
take effect.

**Database passwords and the throttle secret.** Rotates `belso_app` and `belso_editor` together and
issues a new `THROTTLE_SECRET`, carrying `BELSO_TAG` and `BELSO_BASIC_AUTH` across the rewrite.

```bash
ssh belso-vps 'bash -s' -- srv1843841.hstgr.cloud < scripts/vps/belso-app-env.sh
```

It is a rotation, not a repair: run it when you mean to change the passwords. Rotating
`THROTTLE_SECRET` resets every rate-limit counter, because they are keyed with it.

**A back-office password.** Ship the source first; the script runs `admin-user.mjs` inside a
container, since the box has no Node.

```bash
tar -czf - scripts src tsconfig.json package.json |
  ssh belso-vps 'rm -rf /docker/belso/admin && mkdir -p /docker/belso/admin &&
                 tar -xzf - -C /docker/belso/admin && chmod 700 /docker/belso/admin'

ssh belso-vps 'bash -s' -- password sofia@belso.ma < scripts/vps/belso-admin-user.sh
ssh belso-vps 'bash -s' -- create nom@belso.ma "Nom Complet" < scripts/vps/belso-admin-user.sh
```

It generates the password on the box, verifies it with the same function the sign-in calls, and
writes it to `/docker/belso/back-office-password.txt` (mode 600, root). Collect it in your own
session and destroy it:

```bash
ssh belso-vps 'cat /docker/belso/back-office-password.txt'
ssh belso-vps 'shred -u /docker/belso/back-office-password.txt'
```

Changing a password signs that account out everywhere. That is the point of it.

## Where the photographs live

Docker volume `belso-media`, mounted at `/app/media`. Declared `external: true`, so `docker compose
down -v` cannot destroy it.

```bash
ssh belso-vps 'docker volume inspect belso-media'
ssh belso-vps 'docker run --rm -v belso-media:/m alpine du -sh /m'
```

**It is the only data on this box the nightly backup does not cover.** `belso-backup.sh` dumps
Postgres and does not touch the filesystem, so until spec 013's T-18 extends it, this volume is the
single copy of every photograph the client has uploaded. Do not treat a database restore as a full
restore.

On a fresh box the volume must exist before the first `up`:

```bash
ssh belso-vps 'docker volume create belso-media'
```

## When the runner stops

**There is no runner yet.** The self-hosted GitHub Actions runner and the `verify` and `deploy`
workflows are spec 013 phase 3 (T-10 to T-12) and have not landed. Until they do, every deploy is
the by-hand sequence above, and nothing deploys on a push.

When they land, this section covers checking `systemctl status actions.runner.*`, its logs, and
re-registering it. Until then, treating this file as though the automation exists is the failure it
is written to prevent.

## When something is wrong

| What you see                                       | What it is                                                                 |
| -------------------------------------------------- | -------------------------------------------------------------------------- |
| `required variable BELSO_TAG is missing a value`   | You forgot `--env-file app.env`. Correct behavior; add the flag.           |
| `401` on everything, including the storefront      | The pre-launch gate. Pass `BELSO_PROBE_AUTH`, or open with the credential. |
| `404` from Traefik, containers healthy             | `BELSO_DOMAIN` was blank, so the router rule matched nothing. Same cause.  |
| Site answers, catalogue empty, `check-serving` red | `DATABASE_URL` is wrong or the database is unreachable. Read the app logs. |
| Storefront fine, sign-in refuses a good password   | `DATABASE_EDITOR_URL`. It is a different role and a different credential.  |
| Disk filling up                                    | Old images. `docker image prune` keeps tagged ones; delete tags by hand.   |

```bash
ssh belso-vps 'docker logs belso-app --tail 50'
ssh belso-vps 'docker ps -a --filter name=belso'
ssh belso-vps 'docker inspect belso-app --format "{{.State.Health.Status}}"'
```

Keep a few old images for rollback and delete the rest by tag — each is roughly half a gigabyte, and
they accumulate one per deploy.

```bash
ssh belso-vps 'docker rmi belso:<old sha>'
```

## Related

- [security/vps.md](../security/vps.md) — the machine, hardening, the database, nightly backups
- [ADR-0013](../architecture/decisions/0013-deploy-from-the-box.md) — why deploys build on the VPS
- [ADR-0012](../architecture/decisions/0012-verify-on-push.md) — why the gate runs where it does
- [ADR-0010](../architecture/decisions/0010-two-database-roles.md) — why there are two connections
- [spec 013](../../specs/013-belso-deploy/spec.md) — the work this documents
