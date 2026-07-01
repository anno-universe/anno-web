import { Button } from "@/components/ui/button";

export function EmptyState({
  message,
  action,
}: {
  message: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
      {action && (
        <Button
          variant="link"
          onClick={action.onClick}
          className="mt-3 text-primary"
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
