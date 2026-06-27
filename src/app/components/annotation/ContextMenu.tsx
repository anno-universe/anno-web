import type { LucideIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export interface ContextMenuAction {
  label: string;
  icon: LucideIcon;
  shortcut?: string;
  destructive?: boolean;
}

interface Props {
  x: number;
  y: number;
  actions: ContextMenuAction[];
  onAction: (index: number) => void;
  onDismiss: () => void;
}

/**
 * Right-click context menu rendered via portal at screen coordinates.
 * Dismisses on click outside, Escape, or action selection.
 */
export function ContextMenu({ x, y, actions, onAction, onDismiss }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onDismiss();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onDismiss();
    }
    // Delay to avoid the same right-click event dismissing it
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClick);
      document.addEventListener("contextmenu", handleClick);
      document.addEventListener("keydown", handleKey);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("contextmenu", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onDismiss]);

  // Adjust position to stay within viewport
  const adjustedX = Math.min(x, window.innerWidth - 180);
  const adjustedY = Math.min(y, window.innerHeight - actions.length * 32 - 8);

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[9999] min-w-[150px] rounded-lg border bg-popover py-1 shadow-lg animate-in fade-in zoom-in-95"
      style={{ left: adjustedX, top: adjustedY }}
      role="menu"
    >
      {actions.map((action, i) => {
        const Icon = action.icon;
        return (
          <button
            key={i}
            onClick={() => {
              onAction(i);
              onDismiss();
            }}
            className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-muted ${
              action.destructive
                ? "text-destructive hover:bg-destructive/10"
                : "text-foreground"
            }`}
            role="menuitem"
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1">{action.label}</span>
            {action.shortcut && (
              <span className="text-[10px] text-muted-foreground">
                {action.shortcut}
              </span>
            )}
          </button>
        );
      })}
    </div>,
    document.body
  );
}
