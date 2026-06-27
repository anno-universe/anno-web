import { cn } from "@/lib/utils";

const roleStyles: Record<string, string> = {
  supervisor:
    "border-blue-200 bg-blue-50 text-blue-700",
  worker:
    "border-gray-200 bg-gray-50 text-gray-600",
  admin:
    "border-purple-200 bg-purple-50 text-purple-700",
};

export function ProjectRoleBadge({ role }: { role: string | null }) {
  const normalized = role?.toLowerCase() ?? "none";
  const style =
    roleStyles[normalized] ??
    "border-gray-200 bg-gray-50 text-gray-500";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        style
      )}
    >
      {role ?? "—"}
    </span>
  );
}
