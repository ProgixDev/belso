import { Skeleton } from "@/components/ui/skeleton";

/**
 * The list reads the whole catalogue over a connection that, from a laptop, is
 * an SSH tunnel to Paris. A blank screen for that half-second reads as broken.
 */
export default function LoadingListings() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-10 w-48" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    </div>
  );
}
