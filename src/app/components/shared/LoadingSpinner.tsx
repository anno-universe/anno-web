import { cn } from "@/lib/utils";

/**
 * Inline spinner sized by className (default 1rem). Use inside buttons and other
 * inline contexts so they keep their natural size while an action is in flight.
 */
export function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "size-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground",
        className
      )}
    />
  );
}

/** Page-scale loading indicator: a centered spinner with padding. */
export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center p-8">
      <Spinner className="size-6" />
    </div>
  );
}
