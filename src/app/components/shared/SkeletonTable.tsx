import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface SkeletonTableProps {
  rows?: number;
  className?: string;
}

function SkeletonTable({ rows = 5, className }: SkeletonTableProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Skeleton className="h-9 w-full rounded-md" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-12 w-full rounded-md"
          style={{ opacity: 1 - i * 0.12 }}
        />
      ))}
    </div>
  );
}

function SkeletonTableWithThumbs({ rows = 5, className }: SkeletonTableProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Skeleton className="h-9 w-full rounded-md" />
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-md border px-3 py-2"
        >
          <Skeleton className="size-10 shrink-0 rounded" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

export { SkeletonTable, SkeletonTableWithThumbs };
