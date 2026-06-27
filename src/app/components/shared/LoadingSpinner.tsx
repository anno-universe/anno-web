export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
    </div>
  );
}
