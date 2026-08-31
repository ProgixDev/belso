import { cn } from "@/lib/utils";

type TextareaProps = React.ComponentProps<"textarea">;

/**
 * Multi-line text. The `Input`'s twin, and deliberately its twin: the same
 * border, focus ring and invalid state, so a form built from both does not
 * read as two components from two eras.
 *
 * `field-sizing-content` lets the box grow with what is typed, up to the height
 * the caller sets. A listing description is three sentences or fifteen, and a
 * fixed box is either mostly empty or a two-line window onto a paragraph —
 * which is how descriptions end up short.
 *
 * Native `<textarea>`, no auto-resize script: the CSS does it, so it works
 * before hydration and with JavaScript off.
 */
export function Textarea({ className, rows = 4, ...props }: TextareaProps) {
  return (
    <textarea
      rows={rows}
      className={cn(
        "border-input flex w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs transition-colors outline-none",
        "field-sizing-content min-h-20",
        "placeholder:text-muted-foreground",
        "focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/30",
        className,
      )}
      {...props}
    />
  );
}
