import { useToastStore } from "@/stores/toastStore";
import { X } from "lucide-react";

const typeStyles: Record<string, string> = {
  success: "border-green-200 bg-green-50 text-green-800",
  error: "border-destructive/50 bg-destructive/10 text-destructive",
  info: "border-blue-200 bg-blue-50 text-blue-800",
};

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm shadow-sm ${typeStyles[toast.type] ?? typeStyles.info}`}
        >
          <span>{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="ml-2 shrink-0 opacity-60 hover:opacity-100"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
