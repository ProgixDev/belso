import { cn } from "@/lib/utils";

/**
 * Loading placeholder. Use skeletons (not a bare spinner) for content loads >1s so
 * the layout doesn't jump — see docs/design/quality-bar.md. Size it with className
 * (e.g. "h-4 w-32"). The pulse respects prefers-reduced-motion (Tailwind's
 * motion-reduce variant disables it).
 */
export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(
        "bg-muted animate-pulse rounded-md motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  );
}
