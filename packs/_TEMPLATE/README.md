# Pack: example-feature (template)

One paragraph: what this web pack adds and how it's separated from the app. Logic-first; UI is a
shadcn placeholder. State the dev-key story (ideally **key-free**, or test-mode only).

## What you get

- `actions.ts` — `"use server"` Server Actions (the logic).
- `schema.ts` — Zod schemas validated at every server boundary.
- `data.ts` — Supabase queries where needed.
- `app/...route.ts` — route handler(s) copied into `src/app/` (webhooks, callbacks).
- `ui/` — **minimal** shadcn screen(s), tagged to replace after the design pass.
- `supabase/00xx_*.sql` — RLS-first migration(s), if any.

## Install

```
/add-feature example-feature
```

## Keys / config

- List each env var, where it lives (**server** in `src/core/env.ts`, or `NEXT_PUBLIC_*` in
  `env.client.ts`), and whether it's needed for dev vs ship.

## Security

- What RLS protects, what's server-owned, what must never reach the browser.
