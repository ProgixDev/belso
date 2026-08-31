import { cn } from "@/lib/utils";

/** A downward chevron, `currentColor`-neutral so it reads in either theme. */
const CHEVRON =
  'url("data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="2" opacity="0.6">' +
      '<path d="M6 9l6 6 6-6"/></svg>',
  ) +
  '")';

type SelectProps = React.ComponentProps<"select"> & {
  /** `{ value, label }` pairs. The label is what a person reads. */
  options: readonly { value: string; label: string }[];
  /** Shown first and unselectable, for a field with no sensible default. */
  placeholder?: string;
};

/**
 * A native `<select>`, and native on purpose.
 *
 * The obvious alternative is a listbox built from `<div>`s with a popover, which
 * is what most component libraries ship and what a designer will ask for. It
 * costs: keyboard handling, focus trapping, type-ahead, screen-reader
 * announcements, and a mobile experience that is worse than the one the
 * operating system already provides. The back-office has four of these — a
 * neighbourhood, a type, a state, a currency — used by three people, one of whom
 * will be on a phone in a car. The platform's control wins every one of those.
 *
 * Styled to match `Input` so the two sit together in a form. The arrow is drawn
 * with a background image rather than an overlaid element, because an overlay
 * would sit above the control and swallow the click that opens it.
 */
export function Select({ className, options, placeholder, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        "border-input flex h-9 w-full appearance-none rounded-md border bg-transparent py-1 pr-8 pl-3 text-sm shadow-xs transition-colors outline-none",
        "bg-[right_0.5rem_center] bg-no-repeat",
        "focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/30",
        className,
      )}
      /*
       * The chevron as an inline style rather than a Tailwind arbitrary value.
       * Tailwind treats a space in an arbitrary value as the end of the class,
       * so an inlined SVG — which needs spaces for `viewBox` and attributes —
       * silently emits no rule at all. The select then looks exactly like a
       * text input, which is how it shipped in the first screenshot: nothing
       * on screen said "Quartier" was a dropdown.
       *
       * A background image rather than an overlaid element, because an overlay
       * sits above the control and swallows the click that opens it.
       */
      style={{ backgroundImage: CHEVRON, backgroundSize: "1rem", ...props.style }}
      {...props}
    >
      {placeholder ? (
        // `value=""` rather than no value, so a form that requires this field
        // can tell "not chosen" from "chosen the first one".
        <option value="" disabled>
          {placeholder}
        </option>
      ) : null}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
