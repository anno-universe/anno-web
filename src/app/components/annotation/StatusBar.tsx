export type ToolType =
  | "select"
  | "pan"
  | "draw-box"
  | "draw-polygon"
  | "draw-point"
  | "sam-point"
  | "sam-box";

const toolNames: Record<ToolType, string> = {
  select: "Select",
  pan: "Pan",
  "draw-box": "Box",
  "draw-polygon": "Polygon",
  "draw-point": "Keypoint",
  "sam-point": "SAM Point",
  "sam-box": "SAM Box",
};

interface Props {
  activeTool: ToolType;
  mouseX: number | null;
  mouseY: number | null;
  zoomPercent: number;
  drawPreview?: string;
}

export function StatusBar({
  activeTool,
  mouseX,
  mouseY,
  zoomPercent,
  drawPreview,
}: Props) {
  return (
    <div className="flex h-7 items-center justify-between border-t bg-muted/50 px-3 font-mono text-[11px] text-muted-foreground select-none">
      <div className="flex items-center gap-3">
        <span>
          Tool: <span className="text-foreground">{toolNames[activeTool]}</span>
        </span>
        {drawPreview && (
          <span className="text-foreground">{drawPreview}</span>
        )}
      </div>
      <div className="flex items-center gap-3">
        {mouseX != null && mouseY != null && (
          <span>
            x:{" "}
            <span className="text-foreground tabular-nums">
              {mouseX.toFixed(1)}
            </span>{" "}
            y:{" "}
            <span className="text-foreground tabular-nums">
              {mouseY.toFixed(1)}
            </span>
          </span>
        )}
        <span>
          zoom:{" "}
          <span className="text-foreground tabular-nums">
            {zoomPercent}%
          </span>
        </span>
      </div>
    </div>
  );
}
