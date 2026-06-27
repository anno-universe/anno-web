import { clsx } from "clsx";

interface Props {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Accessible label for screen readers */
  label?: string;
}

/**
 * Simple on/off toggle switch. Styled with Tailwind; no external dependency.
 * Follows the WAI-ARIA switch pattern.
 */
export function Switch({ checked, onCheckedChange, disabled, label }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={clsx(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        checked ? "bg-primary" : "bg-muted-foreground/30",
        disabled && "cursor-not-allowed opacity-50"
      )}
    >
      <span
        className={clsx(
          "inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-[18px]" : "translate-x-[2px]"
        )}
      />
    </button>
  );
}
