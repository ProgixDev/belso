# 0013 — Deploy by pulling from the box, not by pushing into it

- **Status:** Accepted
- **Date:** 2026-09-01
- **Deciders:** Houssem Ferrani
- **Context:** [spec 013](../../../specs/013-belso-deploy/spec.md), which deploys on push to `main`

## Context

Spec 013 deploys the site when `main` moves, which means something has to reach the VPS without a
person. The conventional arrangement is an inbound one: a private key in GitHub's secrets, and
GitHub opens an SSH connection to the box.

That box is not ours. It is the client's Hostinger VPS, it runs their n8n alongside our Postgres,
and `docs/security/vps.md` already records that the only key to it grants root and has no
passphrase. An inbound deploy key means a GitHub account compromise — a stolen token, a malicious
action in a dependency, a misconfigured fork workflow — is a root compromise of the client's
machine and everything else on it. The blast radius is not our application; it is their business.

ADR-0006 removed cloud surfaces partly to avoid exactly this kind of coupling, and its objection
applies far more forcefully to a credential than it did to a CI check that holds no state.

## Decision

**The VPS pulls. GitHub is never given a way in.**

A self-hosted GitHub Actions runner registers itself from the box, holds an outbound connection,
and executes the deploy locally when `main` passes `pnpm verify` ([ADR-0012](0012-verify-on-push.md)).
The credential is minted by the box, scoped to this repository, and revocable from either end. No
inbound port opens; nothing is added to `authorized_keys`.

## Alternatives considered

| Option                                  | Why not                                                                                                                                                                                                                                                                                 |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SSH deploy key in GitHub secrets**    | The conventional answer, and it inverts the trust: GitHub becomes a credential store whose compromise reaches the client's box as root. For a client machine running a third-party workload beside ours, that is a risk we are choosing on their behalf without being able to bound it. |
| **A webhook the VPS listens for**       | Opens an inbound port and needs its own authentication, which is the same problem with more surface and a service we would then own.                                                                                                                                                    |
| **A cron that polls `git` for changes** | No credential either way and genuinely simpler, but the feedback is wrong: a failed deploy is discovered minutes later by whoever thinks to look, and spec 013's AC-4 asks for the previous version to keep serving, which needs the deploy to know it failed.                          |
| **Deploy by hand over SSH**             | The status quo and entirely defensible — the owner chose automatic. Recorded because reversing the trigger is the cheapest way out if the runner becomes a maintenance burden.                                                                                                          |

## Consequences

- Positive: GitHub holds no key to the client's infrastructure, and revoking the runner is one
  command on either side. No inbound firewall change; `docs/security/vps.md`'s "only 22, 80 and
  443" stays true.
- Negative / accepted trade-offs: a persistent agent on the client's box that executes code from
  GitHub — so the trust that used to point inward now points outward, at the repository. A
  compromised `main` runs commands on their VPS. ADR-0012's gate reduces but does not remove this,
  and the honest mitigation is that pushing to `main` already required repository access.
- Also negative: it is one more thing on two shared cores, and one more thing to notice when it
  stops. If it goes unnoticed, deploys silently stop happening — which is a failure mode worth
  preferring to the alternative, since a stopped deploy leaves the site as it was.
- Follow-ups: the runner must be scoped to this repository and not the organisation, must not run
  as root, and its registration token must not be committed — asserted by spec 013's AC-7.
