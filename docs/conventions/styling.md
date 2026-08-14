# Styling Conventions

## Tailwind CSS v4

- Config is **CSS-first**: design tokens live in `src/app/globals.css` under `@theme` (colors, radii, fonts). There is no `tailwind.config` for tokens — edit the CSS.
- Use tokens, not raw values: `bg-primary text-primary-foreground rounded-lg` — never `bg-[#3b82f6]` outside one-off prototypes. If a value repeats twice, it becomes a token.
- Class order is enforced by `prettier-plugin-tailwindcss`; don't fight it.
- Conditional classes via the `cn()` helper (`@/lib/utils`) — never string concatenation.
- Responsive: mobile-first (`p-4 md:p-6`). Dark mode: `dark:` variants against tokens, not literal colors.

## shadcn/ui = our design system seed

- Components in `src/components/ui/` are **owned code**, added via `pnpm dlx shadcn@latest add <component>` and then adapted. Edit them; that's the point.
- Build feature UI from these primitives. Adding a new dependency for UI (date pickers, modals, dropdowns) requires checking shadcn/Radix first and an ADR if you go elsewhere.
- Variants are defined with `cva` inside the component file — variants in the component, layout at the call site:
  - Component owns: color, typography, padding, radius, states.
  - Call site owns: margin, width, grid/flex placement.

## Layout

- Flex/grid utilities at the parent; avoid absolute positioning except for overlays.
- Spacing scale only (`gap-2`, `p-4`…); no arbitrary `mt-[13px]`.
- Page width/gutters come from the shared `container` pattern in `globals.css`.

## Quality bar (what reviewers look for)

- No visual drift: same radius, shadow, and spacing tokens as sibling UI.
- Interactive states are designed: hover, focus-visible, active, disabled — all of them.
- Empty, loading, and error states styled, not afterthoughts.
- Screenshot evidence: any visual change shows up in `/verify-ui` shots — look at them before declaring done.
