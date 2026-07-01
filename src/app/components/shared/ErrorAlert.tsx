import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/**
 * Destructive error banner with an optional retry action.
 * Thin composition over the shadcn Alert primitive so every call site
 * stays on the same visual language.
 */
export function ErrorAlert({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertDescription>
        <span>{message}</span>
        {onRetry && (
          <Button
            variant="link"
            size="xs"
            onClick={onRetry}
            className="h-auto p-0 text-destructive underline underline-offset-4 hover:text-destructive/80"
          >
            Retry
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
