/**
 * The chapter opening the about sheet established: index, name, a hairline rule
 * running to the edge, and the place set small and tracked at the far right.
 *
 * It is a component rather than a copied block because it is now the one thing
 * holding the page together. Below the scene the site is ordinary content in
 * ordinary document flow — no sticky stages, no scrubbed timelines — so the
 * only thing telling a visitor "a new chapter starts here" is this rule.
 */
export function SectionMasthead({
  index,
  name,
  place,
  tone = "paper",
}: {
  index: string;
  name: string;
  place: string;
  /** `ink` inverts for the one dark band, so the rule and the small caps stay quiet on it. */
  tone?: "paper" | "ink";
}) {
  const onInk = tone === "ink";

  return (
    <header className="flex items-baseline gap-[clamp(12px,1.4vw,22px)]">
      <span
        aria-hidden="true"
        className={`font-serif text-[clamp(1.6rem,2.2vw,2.3rem)] leading-none font-medium [font-variant-numeric:lining-nums] ${
          onInk ? "text-background/40" : "text-foreground/30"
        }`}
      >
        {index}
      </span>

      <h2
        className={`font-serif text-[clamp(1.5rem,2vw,2.1rem)] leading-none font-semibold tracking-[0.01em] whitespace-nowrap ${
          onInk ? "text-background" : "text-foreground"
        }`}
      >
        {name}
      </h2>

      <span
        aria-hidden="true"
        className={`h-px min-w-6 flex-auto -translate-y-[0.35em] ${
          onInk ? "bg-background/25" : "bg-foreground/20"
        }`}
      />

      {/* Hidden rather than wrapped on narrow screens: it is a caption, and
       * wrapping it breaks the single baseline the rule is drawn along. */}
      <span
        className={`hidden text-[10px] font-semibold tracking-[0.22em] whitespace-nowrap uppercase sm:block ${
          onInk ? "text-background/55" : "text-foreground/50"
        }`}
      >
        {place}
      </span>
    </header>
  );
}

/**
 * The section's headline. A `p`, not a heading: the masthead above already
 * carries the `h2`, and two headings would read as two sections to anything
 * navigating by structure.
 */
export function SectionStatement({ children }: { children: React.ReactNode }) {
  return (
    <p className="max-w-[13ch] text-[clamp(1.9rem,3.4vw,3.6rem)] leading-[0.98] font-bold tracking-[-0.025em] uppercase">
      {children}
    </p>
  );
}
