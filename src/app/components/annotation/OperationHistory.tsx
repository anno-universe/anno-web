import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { OperationOutput } from "@/types/operation";

const actionColors: Record<string, string> = {
  add: "border-green-200 bg-green-50 text-green-700",
  modify: "border-blue-200 bg-blue-50 text-blue-700",
  delete: "border-red-200 bg-red-50 text-red-700",
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

interface Props {
  operations: OperationOutput[];
}

export function OperationHistory({ operations }: Props) {
  if (operations.length === 0) {
    return (
      <p className="px-3 py-8 text-center text-xs text-muted-foreground">
        No operations recorded.
      </p>
    );
  }

  return (
    <div className="flex flex-col">
      {operations.map((op) => (
        <div
          key={op.id}
          className="flex items-center gap-2 border-b px-3 py-1.5 text-[11px] last:border-b-0"
        >
          <Badge
            variant="outline"
            className={cn(
              "rounded px-1.5 text-[10px]",
              actionColors[op.action] ??
                "border-gray-200 bg-gray-50 text-gray-600"
            )}
          >
            {op.action}
          </Badge>
          <span className="shrink-0 text-muted-foreground">
            {formatTime(op.created_at)}
          </span>
          <span className="text-muted-foreground">
            User#{op.performed_by_id}
          </span>
          <span className="tabular-nums text-foreground">
            {op.from_annotation_id ?? "—"} → {op.to_annotation_id ?? "—"}
          </span>
        </div>
      ))}
    </div>
  );
}
