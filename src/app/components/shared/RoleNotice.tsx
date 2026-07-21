import { cn } from "@/lib/utils";

/**
 * Consistent read-only banner shown on supervisor-only pages. `area` names the
 * section that can't be changed here (e.g. "project settings", "API keys",
 * "member management", "inference runs").
 */
export function RoleNotice({
  area = "project settings",
  className,
}: {
  area?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-md border bg-muted/50 px-4 py-3 text-sm text-muted-foreground",
        className
      )}
    >
      You have view-only access to {area}. Only supervisors can make changes;
      workers can annotate images.
    </div>
  );
}
