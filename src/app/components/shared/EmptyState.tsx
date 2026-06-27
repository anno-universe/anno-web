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
        <button
          onClick={action.onClick}
          className="mt-3 text-sm font-medium text-primary underline underline-offset-4 hover:text-primary/80"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
