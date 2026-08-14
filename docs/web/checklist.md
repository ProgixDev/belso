# Web production-readiness checklist

The web equivalent of mobile store-readiness: what makes a Next.js app launch-ready. Severity:
**P1** fix before launch · **P2** strongly recommended · **P3** polish. "Auto" = checked by
`pnpm web:check` (`scripts/check-web-readiness.mjs`); "manual" = human review. `web:check` is a
pre-launch gate, not part of `pnpm verify` (the bare skeleton carries placeholder identity).

`id | sev | rule | how to verify | auto?`

```
WEB-IDENTITY      | P1 | Real site identity (name, description, NEXT_PUBLIC_SITE_URL) — not "Next.js Skeleton" | src/core/site.ts + .env | auto
WEB-SEO-META      | P1 | metadataBase + title template + description in layout | inspect layout.tsx / page source | auto + manual
WEB-SEO-OG        | P2 | Open Graph + Twitter card metadata; a real OG image (1200x630) | view-source / social debugger | auto(presence) + manual(image)
WEB-SEO-CANONICAL | P2 | Canonical URLs set (alternates.canonical) | inspect <link rel=canonical> | manual
WEB-SEO-ROBOTS    | P1 | robots.ts serves crawl rules + sitemap; private routes disallowed | GET /robots.txt | auto
WEB-SEO-SITEMAP   | P1 | sitemap.ts lists public routes | GET /sitemap.xml | auto
WEB-SEO-JSONLD    | P2 | JSON-LD structured data for the site/org | view-source | manual
WEB-PWA-MANIFEST  | P2 | manifest.ts with name/icons/theme; real 192/512 + maskable icons | GET /manifest.webmanifest | auto(presence) + manual(icons)
WEB-ERROR-404     | P1 | not-found.tsx with nav back home | visit a bad URL | auto
WEB-ERROR-500     | P1 | global-error.tsx root boundary (renders its own html/body) | trigger an error | auto
WEB-A11Y          | P1 | Keyboard nav, focus-visible, labels, color contrast (WCAG AA) | axe / manual audit | manual
WEB-PERF          | P2 | Core Web Vitals budget (LCP/CLS/INP); next/image; font-display | Lighthouse / PageSpeed | manual
WEB-ANALYTICS     | P2 | Analytics (PostHog) + error tracking (Sentry) wired, behind consent where required | check provider + network | manual
WEB-HEADERS       | P1 | Security headers present; CSP tightened + enforcing | response headers (see SECURITY.md) | manual (set in next.config.ts)
WEB-NOINDEX-PREVIEW| P2 | Non-production/preview deploys are noindex | robots/env per environment | manual
```

## Analytics + error tracking (recommended stack)

- **PostHog** (product analytics, feature flags, session replay) — privacy-first; gate behind
  consent where required. Add `posthog-js` + a client provider in the layout.
- **Sentry** (`@sentry/nextjs`) — errors + performance; wire `captureException` in
  `global-error.tsx` and `error.tsx`; upload source maps in the build.
- Declare what you collect in your privacy policy; respect Do-Not-Track / consent.

## Core Web Vitals

Use `next/image` (sized, lazy below the fold), `next/font` (already used — Geist), avoid layout
shift (reserve space), code-split heavy client components, and budget LCP < 2.5s / CLS < 0.1 /
INP < 200ms. Verify with Lighthouse before launch.
