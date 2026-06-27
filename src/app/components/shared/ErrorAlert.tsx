export function ErrorAlert({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4">
      <p className="text-sm text-destructive">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 text-sm font-medium text-destructive underline underline-offset-4 hover:text-destructive/80"
        >
          Retry
        </button>
      )}
    </div>
  );
}
