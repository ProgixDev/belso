# Design quality bar (web)

Premium UI is **a small, fixed, named system applied with restraint and consistency.** "Vibe-coded"
UI fails because it makes ad-hoc decisions and reaches for tool defaults — the statistical average
of all training data. Premium = **intentional deviation from defaults, inside a disciplined system.**

> **The skeleton ships the default shadcn neutral theme + a purple-gradient instinct — those are the
> recognizable AI tells. Rebrand the theme tokens (`src/app/globals.css`) per app** before you ship.
> Geist (the default font) is a reasonable distinctive choice; Inter/system as a brand face is not.

## Premium-UI checklist (a brief must demand it; a review must verify it)

**Spacing & layout**

- 4/8px grid from a named scale; generous whitespace ("too much, then remove"); a consistent
  container max-width; mobile-first then 768/1024/1440.
- Inner spacing ≤ outer (proximity = grouping). Click/tap targets comfortable (≥40px high).

**Typography**

- One modular scale (~1.25), base ~16; max ~2 weights, none under 400; de-emphasize via color/size.
  A distinctive typeface (not Inter/Arial/system as the brand face).

**Color**

- Full palette as role tokens (shadcn oklch vars); no on-the-fly lighten/darken; no pure black/white.
  60-30-10; accent only for primary/active/focus. WCAG AA (4.5:1 text, 3:1 UI). **No default
  Tailwind colors, no purple-on-white gradient.**

**Depth & dark mode**

- Single light source; one elevation system; layered, color-tinted shadows (never one pure-black).
  Dark mode = dark-grey base + desaturated accents, designed/tested independently — not inverted hex.

**States (every page)**

- Empty (purpose + one CTA), loading (skeleton/shimmer >1s; progress >10s — not a bare spinner),
  error (inline, plain-language, recovery), success. Plus 404/500, auth, paywall, settings.

**Motion**

- 150–300ms; real easing (no linear except spin); exits faster than enters; one signature transition;
  animate transform/opacity (not layout); respect `prefers-reduced-motion`.

**Accessibility (web-specific, non-negotiable)**

- Full keyboard nav + **visible focus rings**; semantic landmarks + heading order; labelled controls;
  no layout shift (reserve space); color is never the only signal.

## Reject-worthy tells (amateur)

Default shadcn theme shipped as-is; purple-on-white gradient hero; a three-icon-box features row;
center-everything; lorem ipsum or single-length data; one fuzzy pure-black shadow on every card;
dark mode that's just inverted light mode; missing empty/error/loading states; removed/invisible
focus rings; gray-on-gray low-contrast text.

## Rebrand checklist (per app — kills the "default template" look)

1. Replace the oklch role tokens in `src/app/globals.css` (light + dark) with a real, distinctive
   palette — keep the role names so components don't change.
2. Choose a brand typeface (or keep Geist deliberately).
3. Set real site identity (`src/core/site.ts` + `NEXT_PUBLIC_SITE_URL`) — `pnpm web:check` flags leftovers.
4. Define one signature interaction + branded microcopy voice.

## How this is enforced

The design brief (`docs/templates/claude-design-prompt.md`) bakes the contract + DO-NOT list in; the
`/design-prompt` skill fills it and self-critiques; the build pass + the `ux-reviewer` persona check
this same list. Components reference role tokens, never raw color (`docs/conventions/styling.md`).
