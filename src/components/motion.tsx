"use client";

import { LazyMotion, MotionConfig, domAnimation, m } from "motion/react";

/**
 * Shared animation setup (docs/conventions/motion.md):
 * - LazyMotion + `m` keeps motion out of the main bundle — always import `m` from here
 *   (or "motion/react"), never the full `motion` component.
 * - `strict` makes accidental `motion.*` usage throw in development.
 * - reducedMotion="user" honors prefers-reduced-motion globally.
 */
export { AnimatePresence } from "motion/react";
export { m };

export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}

/** Shared variants — reuse these; don't re-invent per feature. */

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.2, ease: "easeOut" },
} as const;

export const listItem = {
  initial: { opacity: 0, y: 8, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, scale: 0.98 },
  transition: { type: "spring", stiffness: 300, damping: 30 },
} as const;

/**
 * The reveal: content rises a little and fades as it enters the viewport.
 *
 * One shape used everywhere, because a site that animates each section its own
 * way reads as restless rather than alive. The scene at the top of the landing
 * page is the exception — it has its own scroll timeline and is deliberately
 * left alone.
 *
 * `once` because a reveal that replays every time you scroll back up stops
 * being an entrance and becomes a flicker. `amount: 0.2` fires when a fifth of
 * the element is showing, so tall sections do not wait until they are fully on
 * screen to start.
 *
 * Reduced motion is handled globally by `MotionConfig reducedMotion="user"`,
 * which drops the transform and keeps the fade.
 */
const REVEAL_TAGS = {
  div: m.div,
  section: m.section,
  article: m.article,
  header: m.header,
  nav: m.nav,
  ul: m.ul,
  li: m.li,
  p: m.p,
} as const;

export function Reveal({
  as = "div",
  delay = 0,
  distance = 18,
  className,
  children,
}: {
  as?: keyof typeof REVEAL_TAGS;
  /** Seconds. Index-driven at call sites to stagger a row. */
  delay?: number;
  /** How far it travels, in px. Smaller for small things. */
  distance?: number;
  className?: string;
  children: React.ReactNode;
}) {
  const Tag = REVEAL_TAGS[as];

  return (
    <Tag
      // Hooked so the `<noscript>` rule in the root shell can undo the hidden
      // start state: the initial style is server-rendered, so without JS this
      // content would otherwise never appear.
      data-reveal=""
      className={className}
      initial={{ opacity: 0, y: distance }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay }}
    >
      {children}
    </Tag>
  );
}
