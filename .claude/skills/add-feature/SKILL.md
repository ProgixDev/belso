---
name: add-feature
description: Install a ready-made web feature pack from packs/ into the Next.js app (payments-stripe, chat-realtime, media-upload). Use when the user says "add <feature>", "install the <x> pack", "drop in Stripe/chat/uploads", or wants a prebuilt feature wired up.
argument-hint: [pack-name]
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(cp *), Bash(mkdir *), AskUserQuestion
---

## Context

- Available packs: !`ls -1 packs 2>/dev/null | grep -v '^_' | grep -v README`

## Task

Install the web feature pack **`$ARGUMENTS`** from `packs/<name>/` into the app. These packs are
**web-native** (Server Actions, Route Handlers, shadcn/ui) — never React Native or `expo-*`. Packs
are logic-first: working background + a minimal swappable UI. Catalog + philosophy: `packs/README.md`.

1. **Pick the pack.** If `$ARGUMENTS` is empty or ambiguous, list `packs/` and ask which one
   (AskUserQuestion). Read its `packs/<name>/pack.json` and `README.md`.
2. **Copy the code** from `packs/<name>/src/` into the `installTo` path (default
   `src/features/<name>/`). Preserve structure (`schema.ts`, `actions.ts`, `data.ts`, client
   hooks, `ui/`, `index.ts`). Server Actions keep `"use server"`; client files keep `"use client"`.
3. **Route handlers.** For each `pack.json.routeHandlers` entry, copy `app/...` into `src/app/...`
   (webhooks, OAuth callbacks). Keep them thin — they call into the feature's `actions.ts`/`data.ts`.
4. **Migrations.** If `pack.json.migrations` exist, copy them into `supabase/migrations/` with the
   next free number, then tell the user to run `supabase db reset && supabase test db`.
5. **Pages/routes.** If `pack.json.routes` exist, create the thin `page.tsx` under `src/app/` that
   renders the feature's screen.
6. **Dependencies.** Print the exact install command from `pack.json.deps`
   (e.g. `pnpm add stripe`). Do NOT assume they're installed.
7. **Config / env.** For every `pack.json.env` entry, add it to the right schema —
   **server** secrets to `src/core/env.ts` (guarded by `server-only`, never `NEXT_PUBLIC_`),
   public values to `src/core/env.client.ts` — and to `.env.example`. State dev vs ship.
8. **Verify boundaries.** The copied feature must respect `app → features → shared → core` and be
   imported only via its `index.ts`. Fix stray imports. Confirm no secret is referenced from a
   client component.
9. **Report**: what was copied, the deps, the migration, env to set, and a one-line reminder that
   the UI is a placeholder to replace after the design pass.

Never wire a pack the user didn't ask for, and never paste real API keys. Stripe runs in **test
mode** in dev; entitlement is written only by the trusted webhook (service_role), never the client.
