interface ModalProps {
  open: boolean;
  title: string;
  /** Max-width class for the modal panel. Defaults to "max-w-md". */
  size?: "sm" | "md" | "lg" | "xl";
  onClose: () => void;
  children: React.ReactNode;
}

const SIZE_CLASSES: Record<string, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
};

export function Modal({
  open,
  title,
  size = "md",
  onClose,
  children,
}: ModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40"
        onClick={onClose}
      />
      {/* Panel */}
      <div
        className={`relative z-50 w-full ${SIZE_CLASSES[size] ?? "max-w-md"} rounded-lg bg-background p-6 shadow-xl max-h-[90vh] overflow-y-auto`}
      >
        {title && (
          <h3 className="text-lg font-semibold text-foreground mb-4">
            {title}
          </h3>
        )}
        {children}
      </div>
    </div>
  );
}
