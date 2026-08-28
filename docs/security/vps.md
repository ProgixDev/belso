# The VPS — what it is and how it is locked down

The server Belso will run on, and the state it was put into on 2026-08-28. ADR-0006 makes the
repo the only operating surface, so this is the home for these facts rather than someone's
memory. ADR-0008 is why we have a server at all.

## The machine

|          |                                                                              |
| -------- | ---------------------------------------------------------------------------- |
| Host     | `srv1843841.hstgr.cloud` (Hostinger, AS47583)                                |
| Location | Paris, Île-de-France — deliberate: the buyer audience is French and European |
| OS       | Ubuntu 24.04 LTS                                                             |
| Size     | 2 vCPU · 7.8 GB RAM · 96 GB disk                                             |
| Access   | SSH key only, as `root`. Alias `belso-vps` in `~/.ssh/config`                |

It is **shared with the client's n8n**, which has been running since 2026-07-20 and is not ours
to disturb. Anything we deploy shares 2 cores with it.

## What is public

Only ports **22, 80 and 443**. Everything web-facing is fronted by **Traefik** (host network),
which terminates TLS with Let's Encrypt and redirects HTTP to HTTPS. Adding a service means a
compose file with `traefik.enable=true` and a `Host()` rule — no nginx config, no certificate
handling.

## Hardening applied, and why each one

**n8n was serving its login over plain HTTP on port 32770.** Its compose file published the
container port (`ports: - "5678"`), which Docker maps to a random host port on `0.0.0.0`.
Traefik never needed it — it reaches n8n on the bridge IP — so the publication existed only as
exposure. Removed.

**`ufw`: default deny inbound, allow 22/80/443.**

**A `DOCKER-USER` policy, because ufw alone is not enough.** Docker writes its own iptables
rules ahead of ufw's, so a published container port is reachable from the internet even with the
firewall set to deny — that is exactly how n8n ended up exposed. The rules in
`/etc/ufw/after.rules` drop anything arriving on `eth0` destined for a container. Nothing in a
container is directly reachable; everything public goes through Traefik on the host.

> This matters most for what comes next. A Postgres container published carelessly would
> otherwise be open to the internet.

Verified rather than assumed: a test container published on `:9999` answered `200` on localhost
and was unreachable from outside, with container egress intact.

**SSH: password authentication off, root by key only.** The drop-in is
`/etc/ssh/sshd_config.d/01-hardening.conf`, and **the `01-` prefix is load-bearing**. `sshd`
takes the _first_ value it sees for a keyword, and cloud-init rewrites
`50-cloud-init.conf` with `PasswordAuthentication yes` on boot. A `99-` file would be read too
late and silently do nothing. Confirmed still `no` after a reboot.

**`fail2ban`** on the `sshd` jail (systemd backend), and **`unattended-upgrades`** for security
patches. All 26 pending packages applied and the box rebooted onto kernel 6.8.0-138.

## Standing obligations

- **Never publish a database port.** Postgres talks to the app over a Docker network, with no
  `ports:` entry. The `DOCKER-USER` rules are a safety net, not permission to be careless.
- **The root password that existed before 2026-08-28 was shared over chat.** It no longer opens
  SSH, but it may still be the Hostinger panel password — that one has to be rotated in the panel.
- **Backups are Hostinger snapshots** (spec 010), which are configured in the panel and cannot be
  seen or verified from inside the machine. Someone must confirm they are actually enabled.
- Traefik reports a newer release available on most days; it is pinned to `latest` and only
  updates when the image is pulled.

## Belso's database

`postgres:17-alpine` in `/docker/belso-db/`, volume `belso_db_data`, initialised
`--locale=C` so `ORDER BY` does not depend on the host's locale.

**The only published port is bound to `127.0.0.1`.** That distinction is the whole
security story: publishing on `0.0.0.0` would put Postgres on the public internet and the
firewall would not save us, for the reason given above. Bound to loopback it is reachable only
from the host — which means only over an SSH tunnel:

```bash
pnpm db:tunnel        # ssh -N -L 55432:127.0.0.1:5432 belso-vps
```

The password lives only in `/docker/belso-db/.env` (`chmod 600`) and has never been written
anywhere else. The app reaches the database by service name on `belso-net` and does not use the
published port at all.

## Backups

`/usr/local/bin/belso-backup.sh` — installed from `scripts/vps/belso-backup.sh` in the
repository, which is the source of truth. Nightly at 03:20 UTC via `belso-backup.timer`
(`Persistent=true`, so a box that was off runs it on the next boot rather than skipping a day).

It deletes expired enquiries **before** dumping, not after: personal data past its retention
date must not be copied into a fresh backup, which would silently extend its life by the
backup's own lifetime. Then it dumps, **reads the dump back** with `pg_restore --list`, and only
prunes older dumps once a good one exists.

That read-back is the point. A job that reports success without verifying what it wrote will
report success every night for a year and be found empty on the morning it is needed. Both
failure paths were tested by causing them: with the container stopped it exits 1 and writes
nothing, and `pg_restore` rejects a truncated archive.

```bash
systemctl list-timers belso-backup.timer     # is it scheduled
journalctl -u belso-backup -n 20             # has it been running
pnpm db:restore-check                        # prove a dump actually restores
```

`pnpm db:restore-check` restores the newest dump into a scratch database and runs the site's own
golden snapshot against it — so what is proven is not "rows exist" but "the site would serve the
same catalogue from this backup". The scratch database is dropped afterwards, including on
failure.

**The gap that remains, and it is the client's to close:** these dumps live on the same disk as
the database they protect. They survive a bad migration or a deleted listing; they do not
survive losing the machine. That is covered only by Hostinger's snapshots, which are configured
in the provider's panel and cannot be seen or verified from inside the VPS — **someone has to
confirm they are switched on.** Until then this is protection against mistakes, not against loss.
