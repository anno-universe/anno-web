import { Square, Pentagon, CircleDot } from "lucide-react";
import { getLabelColor, getLabelName } from "@/lib/utils/labelMapping";
import type { Annotation2DOutput } from "@/types/annotation";

const typeIcons: Record<string, typeof Square> = {
  box: Square,
  polygon: Pentagon,
  keypoint: CircleDot,
};

interface Props {
  annotations: Annotation2DOutput[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  labelMapping: Record<string, unknown>;
}

export function AnnotationList({
  annotations,
  selectedId,
  onSelect,
  labelMapping,
}: Props) {
  if (annotations.length === 0) {
    return (
      <p className="px-3 py-8 text-center text-xs text-muted-foreground">
        No annotations yet.
        <br />
        Use the toolbar to create one.
      </p>
    );
  }

  return (
    <div className="flex flex-col">
      {annotations.map((ann) => {
        const Icon = typeIcons[ann.annotation_type] ?? CircleDot;
        const isSelected = ann.id === selectedId;
        const labelName = getLabelName(ann.label, labelMapping);
        const labelColor = getLabelColor(ann.label, labelMapping);

        return (
          <button
            key={ann.id}
            onClick={() => onSelect(ann.id)}
            className={`flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-muted ${
              isSelected
                ? "border-l-2 border-primary bg-muted font-medium"
                : "border-l-2 border-transparent"
            }`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full border"
              style={{ backgroundColor: labelColor }}
            />
            <span className="truncate text-foreground">{labelName}</span>
            <span className="ml-auto shrink-0 text-[11px] text-muted-foreground tabular-nums">
              #{ann.id}
            </span>
          </button>
        );
      })}
    </div>
  );
}
