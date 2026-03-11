import { Skeleton } from "@/components/ui/skeleton";

export function SkeletonHorizontal() {
  return (
    <div className="flex gap-3 overflow-hidden px-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex-shrink-0 w-[160px] rounded-xl border border-border p-3.5 space-y-3">
          <Skeleton className="h-11 w-11 rounded-full mx-auto" />
          <Skeleton className="h-3 w-20 mx-auto" />
          <Skeleton className="h-2.5 w-16 mx-auto" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 px-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border p-4 space-y-3">
          <div className="flex items-start gap-3">
            <Skeleton className="h-12 w-12 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-2.5 w-28" />
            </div>
          </div>
          <div className="flex gap-1.5">
            <Skeleton className="h-4 w-16 rounded-full" />
            <Skeleton className="h-4 w-12 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
