import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { JobStatus, JobItemStatus } from "@/types/inferenceJob";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-gray-100 text-gray-600 border-gray-200",
  running: "bg-blue-100 text-blue-700 border-blue-200",
  completed: "bg-green-100 text-green-700 border-green-200",
  failed: "bg-red-100 text-red-700 border-red-200",
  cancelling: "bg-amber-100 text-amber-700 border-amber-200",
  cancelled: "bg-muted text-muted-foreground border-muted-foreground/20 line-through",
  done: "bg-green-100 text-green-700 border-green-200",
  skipped: "bg-muted text-muted-foreground border-muted-foreground/20",
};

const PULSE_STATUSES = new Set(["running", "cancelling"]);

interface Props {
  status: JobStatus | JobItemStatus;
  className?: string;
}

export function JobStatusBadge({ status, className }: Props) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.pending;
  const shouldPulse = PULSE_STATUSES.has(status);

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 px-2.5",
        style,
        shouldPulse && "animate-pulse",
        className
      )}
    >
      {shouldPulse && (
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
      )}
      {status}
    </Badge>
  );
}
