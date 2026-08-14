# Feature packs (web)

A library of **ready-made, self-contained feature modules** for this Next.js app, built **web-native**
— Server Components, Server Actions, Route Handlers, the browser File API, and shadcn/ui. Packs live
here, **parked and inactive**: `packs/` is excluded from the app (tsconfig, ESLint, the build), so it
adds **zero weight** and never ships until you opt one in.

> These are **not** the Expo packs. Each pack here is designed for Next.js idioms — no React Native,
> no `expo-*`. The mobile equivalents live in `EXPO-SKELETON/packs/`.

You activate a pack with the **`/add-feature <pack>`** skill, which copies it into `src/features/`,
adds any route handler under `src/app/`, runs the migration, and prints the config it needs.

## Principles

1. **Logic-first, UI-thin.** Each pack ships the **background**: server actions, route handlers,
   data layer, schemas, realtime, migrations — fully wired. UI is a **minimal shadcn placeholder**
   (tagged `// DESIGN: replace after Claude Design`). Real screens come from the design pass.
2. **No API keys to develop.** Packs work in dev with **zero keys** where possible (Supabase
   Realtime for chat, Supabase Storage for uploads). Stripe uses **test mode** (test keys only).
3. **Separated, not wired.** A pack does nothing until installed. You can keep many packs in the
   repo without any of them touching the app you're building.
4. **Secure by default.** RLS-first migrations, Zod at every server boundary, **secrets server-side
   only** (`src/core/env.ts`, `server-only`) — never `NEXT_PUBLIC_*`. Entitlement is server-owned:
   only a trusted route (Stripe webhook, service_role) writes `subscriptions`.

## How to use

```
/add-feature payments-stripe     # copies the pack into src/features/ + src/app/api, wires it, prints config
```

Or by hand: copy `packs/<name>/src/*` into `src/features/<name>/`, copy any `app/` route handlers
into `src/app/`, run the migration in `packs/<name>/supabase/`, install the deps from `pack.json`,
and follow `packs/<name>/README.md`.

## Catalog

Status: ✅ ready · 🟡 planned · ⬜ to build.

| Pack              | Status | What it includes (background)                                                                                                          | Dev keys              |
| ----------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| `payments-stripe` | ✅     | Stripe Checkout (server action) + webhook route handler that writes the server-owned `subscriptions` table, `useEntitlement`, test-mode | none (Stripe test mode) |
| `chat-realtime`   | ✅     | Supabase Realtime DMs/groups: migration + member-scoped RLS, server actions (send/read), client subscribe hook; thread stub            | none                  |
| `media-upload`    | ✅     | Private Supabase Storage bucket, per-user folder RLS, signed-URL reads, upload server action + browser-File client; upload stub         | none                  |

## Anatomy of a pack

See [`_TEMPLATE/`](_TEMPLATE/). Every pack has:

```
packs/<name>/
├── pack.json          # manifest: deps, env, migrations, route handlers, post-install notes
├── README.md          # what it does, how it's separated, what keys to ship
├── src/               # copied into src/features/<name>/ on install
│   ├── schema.ts      # Zod schemas + types
│   ├── actions.ts     # "use server" Server Actions (the logic)
│   ├── data.ts        # data layer (Supabase queries) where needed
│   ├── *-client.tsx   # "use client" hooks/providers where needed
│   └── ui/            # MINIMAL shadcn UI (replace after design)
├── app/               # route handlers copied into src/app/ (e.g. api/.../route.ts)
└── supabase/          # RLS-first migrations the pack needs, if any
```
