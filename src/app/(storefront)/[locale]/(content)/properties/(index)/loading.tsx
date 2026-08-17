import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeletons rather than a spinner, and shaped like the grid they replace, so the
 * layout does not jump when results arrive (docs/design/quality-bar.md).
 */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-12">
      <div className="border-border/60 flex flex-col gap-6 border-b pb-8">
        <Skeleton className="h-10 w-64" />
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-9 w-44" />
        </div>
      </div>

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="border-border/70 overflow-hidden rounded-xl border">
            <Skeleton className="aspect-[4/3] w-full rounded-none" />
            <div className="flex flex-col gap-3 p-5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-5 w-4/5" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="mt-2 h-5 w-32" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
