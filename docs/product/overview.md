# Product Overview

> **This file is a template placeholder.** When you clone the skeleton for a real project, this is the FIRST file to fill in — every agent grounds product decisions here. Keep it under a page.

## What this product is

NEXTJS-SKELETON itself is the product right now: a canonical starting point for our company's websites and web apps, plus the demo feature used to prove the harness end-to-end (`task-list`).

For a real project, replace with: the one-paragraph pitch — who the user is, the problem, the bet.

## Users

| User                      | Wants                                          | Success looks like                                                      |
| ------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------- |
| Engineers & AI agents     | Start a project with quality encoded           | First feature shipped on day one without process questions              |
| PMs / designers / testers | Ship via specs and reviews, not by asking devs | A spec becomes a verified, reported PR without synchronous hand-holding |

## What we will NOT do (anti-goals)

- No multi-app monorepo (see ADR-0001) — clone per project instead.
- No backend platform here: the skeleton stubs persistence; real projects add their data layer behind `features/*/actions.ts` and record it in an ADR.

## Current feature map

Living per-feature docs: [features/](features/README.md). Journeys that must never break: [critical-user-journeys.md](critical-user-journeys.md).

## Glossary

| Term         | Meaning here                                                        |
| ------------ | ------------------------------------------------------------------- |
| CUJ          | Critical user journey — an e2e-tested, screenshot-evidenced path    |
| Slice        | A `src/features/<name>` vertical module                             |
| Harness      | Everything that steers agents: docs, gates, skills, hooks, personas |
| Painted door | UI experiment with a no-op backend (see process/painted-door.md)    |
