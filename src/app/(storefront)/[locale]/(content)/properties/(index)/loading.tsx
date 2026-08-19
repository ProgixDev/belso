import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeletons rather than a spinner, and shaped like the grid they replace, so the
 * layout does not jump when results arrive (docs/design/quality-bar.md).
 *
 * That only holds if it is kept in step with the card: same container, same
 * columns, same four blocks — photograph, body, facts row, footer.
 */
export default function Loading() {
  return (
    <div className="container-bleed py-[clamp(20px,3vh,36px)]">
      <div className="border-border/60 flex flex-col gap-6 border-b pb-8">
        <Skeleton className="h-10 w-64" />
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-9 w-44" />
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="border-border/70 overflow-hidden rounded-lg border">
            <Skeleton className="aspect-[4/3] w-full rounded-none" />
            <div className="flex flex-col gap-2 px-4 py-4">
              <Skeleton className="h-2.5 w-24" />
              <Skeleton className="h-6 w-36" />
              <Skeleton className="mt-1 h-4 w-4/5" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <div className="border-border/70 border-t px-4 py-2.5">
              <Skeleton className="h-3 w-3/4" />
            </div>
            <div className="border-border/70 flex justify-between border-t px-4 py-2.5">
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-6 w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
