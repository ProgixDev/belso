---
name: web-readiness
description: Audit the app for web production-readiness before launch (SEO, PWA, error pages, a11y, perf). Use before a deploy/launch, or when the user mentions going live, SEO, Lighthouse, or production-readiness.
allowed-tools: Read, Grep, Glob, AskUserQuestion, Bash(pnpm run web:check*), Bash(node scripts/check-web-readiness.mjs*)
---

## Context

- Automated checks: !`node scripts/check-web-readiness.mjs 2>&1 | tail -30`

## Task

Produce a launch-readiness verdict from the automated output above plus the manual rules in
`docs/web/checklist.md` (the `WEB-*` catalog).

1. **Report the automated findings** (`WEB-*` with severity): identity, metadata, robots, sitemap,
   manifest, 404/500 pages.
2. **Walk the MANUAL rules**, marking each PASS / FAIL / NEEDS-INPUT with its rule ID:
   - Security headers + CSP enforcing (WEB-HEADERS — see SECURITY.md).
   - Accessibility: keyboard nav + visible focus, headings, contrast AA (WEB-A11Y).
   - Core Web Vitals budget; `next/image`; no layout shift (WEB-PERF).
   - Real OG image (1200×630) + canonical URLs (WEB-SEO-OG/CANONICAL).
   - Analytics + error tracking wired, behind consent where required (WEB-ANALYTICS).
   - Preview/non-prod deploys are noindex (WEB-NOINDEX-PREVIEW).
3. End with `## Verdict: READY | BLOCKED` (any P1 FAIL ⇒ BLOCKED) and the exact next actions, citing
   rule IDs and `docs/web/checklist.md`.
