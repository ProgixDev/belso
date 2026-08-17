import { cn } from "@/lib/utils";

/**
 * Labelled form field with hint and error wiring.
 *
 * The point of this component is the plumbing that is easy to forget and
 * invisible when missing: `htmlFor`, `aria-invalid`, and an `aria-describedby`
 * that points at whichever of hint/error is actually rendered. A sighted user
 * sees a red message; a screen-reader user gets nothing unless this is right.
 */
export function Field({
  id,
  label,
  error,
  hint,
  required,
  children,
  className,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  /** Receives the wiring it must spread onto the control. */
  children: (props: {
    id: string;
    "aria-invalid": boolean | undefined;
    "aria-describedby": string | undefined;
    required: boolean | undefined;
  }) => React.ReactNode;
  className?: string;
}) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ");

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-foreground text-sm font-medium">
        {label}
      </label>

      {children({
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy || undefined,
        required: required || undefined,
      })}

      {hint && !error && (
        <p id={hintId} className="text-muted-foreground text-xs">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-destructive text-xs font-medium">
          {error}
        </p>
      )}
    </div>
  );
}
