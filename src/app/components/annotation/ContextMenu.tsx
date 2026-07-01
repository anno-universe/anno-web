import type { LucideIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
 * Right-click context menu anchored at screen coordinates.
 * Built on the Radix DropdownMenu primitive with a zero-size virtual anchor
 * positioned at (x, y) — this keeps the map's cursor-coordinate placement while
 * delegating dismiss (click-outside / Escape), focus, and collision handling to
 * Radix. Rendered only while a menu is active; closing it calls `onDismiss`.
 */
export function ContextMenu({ x, y, actions, onAction, onDismiss }: Props) {
  return (
    <DropdownMenu
      open
      onOpenChange={(open) => {
        if (!open) onDismiss();
      }}
    >
      <DropdownMenuTrigger asChild>
        <span
          aria-hidden
          className="pointer-events-none fixed size-0"
          style={{ left: x, top: y }}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="right" sideOffset={2}>
        {actions.map((action, i) => {
          const Icon = action.icon;
          return (
            <DropdownMenuItem
              key={i}
              variant={action.destructive ? "destructive" : "default"}
              onSelect={() => onAction(i)}
            >
              <Icon />
              <span className="flex-1">{action.label}</span>
              {action.shortcut && (
                <DropdownMenuShortcut>{action.shortcut}</DropdownMenuShortcut>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
