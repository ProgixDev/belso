import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  title: string;
  description?: string;
  /** Optional icon/illustration slot — apps plug their own icon set. */
  icon?: ReactNode;
  /** Optional action slot — typically a <Button /> or link. */
  action?: ReactNode;
  className?: string;
};

/**
 * Empty state — purpose + one action, never just "no data". A real screen state
 * required by the quality bar. Icon/action are slots so each app stays on-brand.
 */
export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 px-6 text-center", className)}>
      {icon ? <div className="text-muted-foreground mb-1">{icon}</div> : null}
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {description ? <p className="text-muted-foreground max-w-prose text-sm">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
