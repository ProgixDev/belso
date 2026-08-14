# Motion Conventions

Animation library: **Motion** (`motion` package — the successor to Framer Motion). Import from `motion/react`.

## Setup we use

- The app is wrapped in `MotionProvider` (`src/components/motion.tsx`): `LazyMotion` with `domAnimation` features + `MotionConfig reducedMotion="user"`.
- Because of LazyMotion, **use the `m` component, not `motion`**: `import { m } from "motion/react"` → `<m.div …>`. Importing `motion` directly defeats the bundle-size win and fails review.
- `AnimatePresence` for exit animations on conditional/list UI.

## Principles

- **Purposeful, not decorative.** Animate to explain a state change (item added, panel opened, error appeared). If removing the animation loses no information, remove it.
- **Fast and subtle**: 150–300 ms for UI feedback; spring (`type: "spring", stiffness: 300, damping: 30`) for movement, `ease-out` tweens for opacity. Nothing over 500 ms without a product reason.
- **Transform/opacity only** (`x`, `y`, `scale`, `opacity`) — these are GPU-cheap. Animating `width`/`height`/`top` needs justification; prefer `layout` animations.
- **Reduced motion is law.** `reducedMotion="user"` handles most cases; for hand-rolled CSS animations, guard with `motion-safe:`/`motion-reduce:` variants. QA persona checks this.
- Shared patterns (fade-in, list item enter/exit, page transition) live in `src/components/motion.tsx` as exported variants — reuse them; don't re-invent per feature.

## Example (list enter/exit)

```tsx
import { AnimatePresence } from "motion/react";
import { m, listItem } from "@/components/motion";

<AnimatePresence initial={false}>
  {tasks.map((t) => (
    <m.li key={t.id} {...listItem} layout>
      …
    </m.li>
  ))}
</AnimatePresence>;
```
