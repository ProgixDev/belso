---
paths:
  - "e2e/**"
  - "src/**/*.test.*"
---

# Writing tests (digest — full rules: docs/conventions/testing.md)

- Assert behavior through public APIs: `getByRole`/`getByLabel` first (doubles as a11y check); `data-testid` is the escape hatch.
- Stores: instantiate via `createXStore()`, call actions, assert `getState()` — no React needed.
- No sleeps — await conditions. No real network in unit tests. Fake timers for time.
- Every e2e journey step captures evidence with `shot(page, "name")` from `e2e/utils/shot.ts`; screenshots land in `artifacts/screenshots/${FEATURE:-baseline}/`.
- A bug fix without a regression test is not done (Definition of Done).
- E2E specs map 1:1 to CUJs — update `docs/product/critical-user-journeys.md` when journeys change.
