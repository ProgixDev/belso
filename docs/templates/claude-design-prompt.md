# Claude Design Prompt — {{Project name}}

> Filled by `/design-prompt` from project context + the design-token contract, then pasted into
> Claude Design. **Design intent only — no code, no component names, no class names.** Built to
> defeat "vibe-coded" output: a token contract, specific reference anchors, mandatory states, and an
> explicit DO-NOT list. The bar is `docs/design/quality-bar.md`.

---

## 0. Role (set the altitude)

You are a senior product designer with a print-design background who obsesses over spacing,
hierarchy, and restraint, designing a responsive web app. **Apply the design system below — do not
invent a new aesthetic.** Premium design is a small, fixed, named system applied consistently;
avoid the statistical-average defaults of AI design.

## 1. Product surface (concrete, not vague)

- **What this is, in one sentence:** {{the product + the core action + the emotional register}}
- **Pages to design (name each):** {{e.g. landing, dashboard, detail, settings, sign-in, pricing}}
- **For each page: the real content, fields, and actions** — use **realistic sample data**, never
  lorem ipsum (real data lays out differently: "$1,284.50", "3 days ago", a 28-character name).

## 2. Context of use (who / when / why / where)

- **User + the moment:** {{persona, the job, time pressure}}
- **Devices:** mobile + desktop (design **mobile-first**, then scale to 768/1024/1440).
- **Appearance:** design **both light and dark** (not one inferred from the other).

## 3. Brand & aesthetic anchors (escape the average)

- **Tone (2–4 words):** {{e.g. calm, editorial, high-contrast, trustworthy}}
- **Named references:** {{"like [real product]'s [specific quality]"}} (Linear, Vercel, Stripe…).
- **A specific/cultural anchor (optional but powerful):** {{an era, medium, or place — NOT "clean and modern"}}
- **Attach 3–5 reference images** (Pinterest / Behance / Dribbble); one line each on **what to
  borrow — the visual, not the function.**

## 4. Design-token contract (use ONLY these — the anti-vibe-coding contract)

> Tokens live in `src/app/globals.css` (shadcn/ui oklch variables) + tailwind. **The default theme
> is the neutral shadcn slate — rebrand it per app** (the default look + a purple gradient is a
> vibe-coded tell). Replace the palette below; keep the role structure.

- **Color (roles, not hues):** background / foreground; card / popover; **primary** (one CTA/active
  color, 60-30-10); muted / accent; semantic destructive / success. Full ramp, no pure black/white.
  Dark mode = dark-grey base + desaturated accents (not inverted hex).
- **Type:** one modular scale (~1.25), base 16; **max ~2 weights**; de-emphasize via color/size, not
  weight. **A distinctive typeface** — the skeleton ships Geist (fine) but consider a brand face;
  never default to Inter/Arial/system.
- **Spacing:** 4/8px grid; generous whitespace (start with too much, then remove); container max-width.
- **Radii & depth:** one radius scale (the `--radius` token); ONE elevation system; **layered,
  color-tinted shadows** (never a single pure-black shadow). No shadow soup.
- **Motion:** 150–300ms; real easing (no linear except spin); exits faster than enters; one signature
  transition; respect `prefers-reduced-motion`.

## 5. Required states for EVERY page (not just the happy path)

Empty (purpose + one CTA), loading (skeleton/shimmer for >1s; progress for >10s — not a bare
spinner), error (inline, plain-language, recovery path), success. Plus, where relevant: **auth**
(sign in/up, value-first), **404 / 500**, **paywall/pricing** (plan, price, what-you-get), **settings**
(grouped, with the account-deletion path), **onboarding/empty-first-run**.

## 6. Accessibility (non-negotiable)

WCAG AA contrast (4.5:1 text / 3:1 UI); **full keyboard navigation + visible focus rings**; semantic
landmarks/headings; labels; don't rely on color alone; respect reduced motion; no layout shift.

## 7. DO NOT (forbid the defaults)

- Default shadcn neutral theme shipped as-is; purple/indigo gradients on white; default Tailwind colors.
- Inter/Arial/system default fonts as the brand face.
- A three-icon-box "features" row; center-everything layouts; shadow soup / nested cards.
- Pure black or pure white; lorem ipsum; inventing tokens outside the contract.

## 8. Process & self-critique (how to deliver)

Work in passes: (1) layout & hierarchy → (2) tokens/theme → (3) content & states → (4) motion/polish
→ (5) responsive (test 375 / 768 / 1440). Give **3 distinct directions** for the first page. After
rendering, **self-critique against this brief + `docs/design/quality-bar.md`** and list refinements.

## 9. Out of scope (this pass)

- {{anything explicitly deferred}}

---

_Export the screens; the implementation pass (Claude Code) reads the same token contract + the
quality bar when building the pages._
