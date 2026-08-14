"use client";

import { LazyMotion, MotionConfig, domAnimation } from "motion/react";

/**
 * Shared animation setup (docs/conventions/motion.md):
 * - LazyMotion + `m` keeps motion out of the main bundle — always import `m` from here
 *   (or "motion/react"), never the full `motion` component.
 * - `strict` makes accidental `motion.*` usage throw in development.
 * - reducedMotion="user" honors prefers-reduced-motion globally.
 */
export { AnimatePresence, m } from "motion/react";

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
