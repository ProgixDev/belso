---
name: new-component
description: Scaffold a new shared UI primitive in src/components/ui — shadcn/ui-style, token-driven, accessible, dark-mode-ready, with a test. Use when the user wants to add a reusable UI element (button, card, badge, skeleton, etc.) to the kit.
argument-hint: [ComponentName]
allowed-tools: Read, Write, Glob, Grep
---

## Task

Add `$ARGUMENTS` to the shared UI kit (`src/components/ui`), matching the existing primitives
EXACTLY. This is the "lean core + generate on demand" model — only add what a feature needs.

1. **Read the contract first:** `docs/design/quality-bar.md`, `docs/conventions/styling.md`, and an
   existing primitive (`src/components/ui/button.tsx`, `card.tsx`, `input.tsx`) to copy the shape
   (named export, `cva` variants where it makes sense, `cn()` for class merging).
2. **Confirm the need** if the variants/props or the consuming feature are unclear — don't pre-build
   unused surface.
3. **Create `src/components/ui/<kebab-name>.tsx`:**
   - Named export; props typed via `React.ComponentProps<...>` + (if variants) `VariantProps`.
   - Styling via Tailwind + **shadcn role tokens only** (`bg-primary`, `text-muted-foreground`,
     `border-input`, …) — never raw hex. Light/dark comes free from the tokens.
   - Accessible: focus-visible ring, semantic element/role, labelled; respects reduced motion if animated.
4. **Test:** add `src/components/ui/__tests__/<kebab-name>.test.tsx` (Vitest + `@testing-library/react`):
   renders, key prop/state behaviour, role/label present.
5. **Self-check** against the module-boundary rules + the quality-bar checklist.

Return the file(s) created + a one-line usage example.
