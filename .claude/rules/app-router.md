---
paths:
  - "src/app/**"
---

# Working in src/app (digest — full rules: docs/conventions/react.md, docs/architecture/overview.md)

- Pages/layouts are Server Components that **compose**; no `"use client"`, no business logic here — that belongs in a feature slice.
- Import features only via their public API: `@/features/<name>` (never deep paths).
- Every feature route ships `loading.tsx` and `error.tsx`.
- Mutations = server actions in the owning feature, zod-validated. Route handlers only for genuine HTTP APIs/webhooks.
- Prefer `searchParams` for filter/tab/pagination state before reaching for a store.
