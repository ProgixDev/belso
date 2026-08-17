import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The top of the results page: what the visitor asked for, how much of it we
 * found, and a way out of the search (AC-2, AC-3).
 *
 * The query is echoed back inside a quoted span rather than interpolated into a
 * sentence — it is untrusted text, and React escapes it, but giving it its own
 * element also stops a long paste from destroying the heading's line length.
 */
export function ResultsHeader({
  title,
  count,
  query,
  searchedForLabel,
  clearLabel,
  clearHref,
  sortControl,
}: {
  title: string;
  /** Already pluralised and formatted by the caller — this component does not know the locale. */
  count: string;
  query?: string;
  searchedForLabel: string;
  clearLabel: string;
  clearHref: string;
  sortControl: React.ReactNode;
}) {
  return (
    <div className="border-border/60 flex flex-col gap-6 border-b pb-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-[family-name:var(--font-archivo)] text-3xl font-extrabold tracking-tight sm:text-4xl">
          {title}
        </h1>

        {query ? (
          <p className="text-muted-foreground text-sm">
            {searchedForLabel} <span className="text-foreground font-medium">“{query}”</span>
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-muted-foreground text-sm" role="status">
          {count}
        </p>

        <div className="flex items-center gap-4">
          {query ? (
            <Link
              href={clearHref}
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-xs")}
            >
              {clearLabel}
            </Link>
          ) : null}
          {sortControl}
        </div>
      </div>
    </div>
  );
}
