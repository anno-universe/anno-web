import {
  MousePointer,
  Hand,
  Square,
  Pentagon,
  CircleDot,
  ZoomIn,
  ZoomOut,
  Maximize,
  Trash2,
  Check,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ToolType } from "./StatusBar";

interface Props {
  activeTool: ToolType;
  onToolChange: (tool: ToolType) => void;
  selectedCount: number;
  onDeleteSelected: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  onZoom100: () => void;
  /** True while a keypoint group is being placed (shows finish/cancel). */
  keypointDrafting?: boolean;
  draftCount?: number;
  onFinishKeypoint?: () => void;
  onCancelKeypoint?: () => void;
  /** Hide the keypoint tool button when project config disables it. */
  keypointEnabled?: boolean;
}

function buildTools(keypointEnabled: boolean) {
  const base: Array<{
    id: ToolType;
    icon: typeof MousePointer;
    label: string;
    shortcut: string;
  }> = [
    { id: "select", icon: MousePointer, label: "Select", shortcut: "V" },
    { id: "pan", icon: Hand, label: "Pan", shortcut: "H" },
    { id: "draw-box", icon: Square, label: "Box", shortcut: "B" },
    { id: "draw-polygon", icon: Pentagon, label: "Polygon", shortcut: "P" },
  ];
  if (keypointEnabled) {
    base.push({ id: "draw-point", icon: CircleDot, label: "Keypoint", shortcut: "K" });
  }
  return base;
}

export function AnnotationToolbar({
  activeTool,
  onToolChange,
  selectedCount,
  onDeleteSelected,
  onZoomIn,
  onZoomOut,
  onFitView,
  onZoom100,
  keypointDrafting,
  draftCount,
  onFinishKeypoint,
  onCancelKeypoint,
  keypointEnabled = true,
}: Props) {
  const tools = buildTools(keypointEnabled);

  return (
    <div className="flex w-14 shrink-0 flex-col items-center gap-1 border-r bg-card py-2">
      {/* Keypoint group: finish / cancel (only while placing points) */}
      {keypointDrafting && (
        <>
          <button
            onClick={onFinishKeypoint}
            className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
            title={`Finish keypoint group (${draftCount} pts) — Enter / double-click`}
            aria-label="Finish keypoint group"
          >
            <Check className="h-[18px] w-[18px]" />
          </button>
          <button
            onClick={onCancelKeypoint}
            className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            title="Cancel keypoint group (Esc)"
            aria-label="Cancel keypoint group"
          >
            <X className="h-[18px] w-[18px]" />
          </button>
          <div className="my-2 h-px w-8 bg-border" />
        </>
      )}

      {/* Tool buttons */}
      {tools.map(({ id, icon: Icon, label, shortcut }) => (
        <button
          key={id}
          onClick={() => onToolChange(id)}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-md transition-colors",
            activeTool === id
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
          title={`${label} (${shortcut})`}
          aria-label={`${label} tool`}
        >
          <Icon className="h-[18px] w-[18px]" />
        </button>
      ))}

      {/* Separator */}
      <div className="my-2 h-px w-8 bg-border" />

      {/* Zoom controls */}
      <button
        onClick={onZoomIn}
        className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        title="Zoom In"
        aria-label="Zoom in"
      >
        <ZoomIn className="h-[16px] w-[16px]" />
      </button>
      <button
        onClick={onZoomOut}
        className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        title="Zoom Out"
        aria-label="Zoom out"
      >
        <ZoomOut className="h-[16px] w-[16px]" />
      </button>
      <button
        onClick={onFitView}
        className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        title="Fit View (F)"
        aria-label="Fit view"
      >
        <Maximize className="h-[16px] w-[16px]" />
      </button>
      <button
        onClick={onZoom100}
        className="flex h-8 w-8 items-center justify-center rounded-md text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        title="100% (1)"
        aria-label="100% zoom"
      >
        1:1
      </button>

      {/* Separator */}
      <div className="my-2 h-px w-8 bg-border" />

      {/* Delete */}
      <button
        onClick={onDeleteSelected}
        disabled={selectedCount === 0}
        className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
        title={
          selectedCount > 0 ? `Delete selected (Del)` : "Delete selected"
        }
        aria-label="Delete selected annotation"
      >
        <Trash2 className="h-[18px] w-[18px]" />
      </button>
    </div>
  );
}
