# Pack: payments-stripe (web)

Stripe subscriptions, the secure way: **Checkout** and the **billing portal** via Server Actions, and
a **signature-verified webhook** that is the *only* writer of entitlement. Logic-first; UI is a shadcn
placeholder. Runs in **test mode** in dev (test keys only — no real charges).

## What you get

- `actions.ts` — `startCheckout({ priceId })`, `openBillingPortal()` (Server Actions; redirect to
  Stripe's hosted pages). They never grant entitlement themselves.
- `app/api/stripe/webhook/route.ts` — verifies the Stripe signature, then writes
  `public.subscriptions` via the **service_role** client. The browser can't reach this path.
- `data.ts` — `getMyEntitlement()` (RLS read for RSC gating), plus service-role writers used only by
  the webhook.
- `stripe.ts` — `server-only` Stripe client (secret key can't reach the browser).
- `schema.ts` — Zod input + `mapStripeStatus` (Stripe status → our entitlement status).
- `ui/paywall.tsx` — **placeholder** subscribe/manage UI.
- `supabase/0010_stripe_customers.sql` — user ↔ Stripe customer mapping (SELECT-own; server-written).
  The `subscriptions` entitlement table already exists from `0004`.

## Install

```
/add-feature payments-stripe
pnpm add stripe
# apply supabase/0010_stripe_customers.sql, then:
supabase db reset
```

Env (add to the schemas + `.env.example`):

```
STRIPE_SECRET_KEY=sk_test_xxx        # server-only (src/core/env.ts). TEST key in dev.
STRIPE_WEBHOOK_SECRET=whsec_xxx      # server-only. From `stripe listen`.
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_STRIPE_PRICE_ID=price_xxx   # a test-mode Price for the billing page
```

Forward webhooks locally:

```
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

## Security — why entitlement is trustworthy

The client **cannot** grant itself Pro. `subscriptions` is SELECT-only under RLS; the single writer
is the webhook, which (a) verifies the Stripe signature so a forged POST is rejected, and (b) uses
the service_role key that bypasses RLS — server-side only. Checkout/portal actions run on the server
with the user's cookie session. Secret keys live in `src/core/env.ts` behind `server-only`; nothing
sensitive is ever `NEXT_PUBLIC_`. This is the web mirror of the Expo `payments-revenuecat` pack,
which writes the same server-owned `subscriptions` table.
