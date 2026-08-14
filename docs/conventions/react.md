# React Conventions

## Server-first

- **Server Components by default.** A file gets `"use client"` only when it needs state, effects, refs, browser APIs, or event handlers — and then it should be a _leaf_, not a page.
- Pages/layouts in `src/app/` compose; they contain no business logic and no `"use client"`. Push interactivity down into feature components.
- Data flows down via props from RSC; mutations go up via Server Actions (`features/<x>/actions.ts`, zod-validated, `"use server"` at top of file).
- Don't pass non-serializable values across the RSC/client boundary.

## Components

- One exported component per file; colocate small private subcomponents below it.
- Props: a named `type XProps`; destructure in the signature; no `React.FC`.
- Prefer composition (`children`, slots) over configuration (boolean prop explosions). Three related booleans = redesign as a `variant` union.
- Derive, don't sync: compute values during render instead of mirroring props into state. `useEffect` is a last resort for _external_ systems only — never for data transformation.
- Keys are stable IDs, never array indexes on dynamic lists.
- Use `Suspense` + streaming for slow data; every feature route ships `loading.tsx` and `error.tsx`.

## Accessibility (non-negotiable)

- Semantic elements first (`button`, `nav`, `label` + `htmlFor`). Click handlers on `div`s fail review.
- Every input has a label; every icon-only button has `aria-label`; focus states are never removed, only styled.
- Modals/popovers come from shadcn/ui (Radix) — never hand-rolled — so focus trapping and ARIA come for free.

## Performance

- Measure before memoizing. React Compiler-era code rarely needs `useMemo`/`useCallback`; reach for them only with evidence (profiler, INP).
- `next/image` for images, `next/font` for fonts, `next/dynamic` for heavy client-only islands.
- Keep client bundles lean: no server-only libs in client files (`server-only` package guards `core/env`).

## File anatomy (feature component)

```tsx
"use client";

import { useTaskListStore } from "../store";
import { Button } from "@/components/ui/button";

type TaskRowProps = { id: string };

export function TaskRow({ id }: TaskRowProps) {
  // 1. hooks  2. derived values  3. handlers  4. render
}
```
