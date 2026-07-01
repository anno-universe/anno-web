import {
  Square,
  Pentagon,
  CircleDot,
  Trash2,
  ChevronDown,
  Check,
  RotateCcw,
  GripVertical,
  Loader2,
} from "lucide-react";
import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  getLabelColor,
  getLabelName,
  labelOptionsFromMapping,
  stableColor,
} from "@/lib/utils/labelMapping";

const typeIcons: Record<string, typeof Square> = {
  box: Square,
  polygon: Pentagon,
  keypoint: CircleDot,
};

/** Minimal shape the card needs — satisfied by Annotation2DOutput and by a
 *  synthetic draft (no id yet, awaiting its first label). */
export interface CardAnnotation {
  id?: number;
  annotation_type: string;
  label: number | null;
}

/**
 * The card's display mode, derived from the annotation state machine.
 * - `view`: read-only — shows label + type + id, no dropdown, no Save/Revert
 * - `edit`: commit surface — label dropdown, Save/Revert with dirty gating
 * - `draft`: freshly-drawn shape awaiting its first label
 */
export type InfoCardMode = "view" | "edit" | "draft";

interface Props {
  annotation: CardAnnotation | null;
  labelMapping: Record<string, unknown>;
  labelOptions?: Array<{ value: number; label: string; color: string }>;
  /** Labels already in use across existing annotations on this image.
   *  Used as dropdown options when no label_mapping is configured. */
  usedLabels?: number[];
  mode: InfoCardMode;
  /** Whether a save API call is in flight. Disables all buttons. */
  saving?: boolean;
  /** Whether the annotation has uncommitted changes (geometry or label).
   *  In edit mode, Save is disabled when this is false. */
  isDirty?: boolean;
  onSave?: () => void;
  onRevert?: () => void;
  onLabelChange: (newLabel: number | null) => void;
  onDelete: () => void;
}

/**
 * Floating property console for the selected (or draft) annotation.
 * Mode-driven: view = display-only, edit = commit surface, draft = label picker.
 * Visual treatment in edit mode darkens to match the map's darkened feature.
 */
export function AnnotationInfoCard({
  annotation,
  labelMapping,
  labelOptions,
  usedLabels,
  mode,
  saving = false,
  isDirty = false,
  onSave,
  onRevert,
  onLabelChange,
  onDelete,
}: Props) {
  // Label dropdown state — user opens manually
  const [labelOpen, setLabelOpen] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dropdownPos, setDropdownPos] = useState<{
    left: number;
    top: number;
    width: number;
  } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const labelButtonRef = useRef<HTMLButtonElement>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  // Dismiss label dropdown on outside click
  useEffect(() => {
    if (!labelOpen) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        !(target instanceof HTMLElement && target.closest("[data-label-menu]"))
      ) {
        setLabelOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [labelOpen]);

  useEffect(() => {
    if (!labelOpen) return;

    function positionDropdown() {
      const rect = labelButtonRef.current?.getBoundingClientRect();
      if (!rect) return;
      setDropdownPos({
        left: rect.left,
        top: rect.bottom + 4,
        width: Math.max(192, rect.width),
      });
    }

    positionDropdown();
    window.addEventListener("resize", positionDropdown);
    window.addEventListener("scroll", positionDropdown, true);
    return () => {
      window.removeEventListener("resize", positionDropdown);
      window.removeEventListener("scroll", positionDropdown, true);
    };
  }, [labelOpen, dragOffset]);

  useEffect(() => {
    function handleMove(e: PointerEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      setDragOffset({
        x: drag.originX + e.clientX - drag.startX,
        y: drag.originY + e.clientY - drag.startY,
      });
    }

    function handleUp() {
      dragRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, []);

  // Build fallback options from labels already in use on this image.
  // MUST be before the early return — React hooks must run in the same
  // order on every render, otherwise "Rendered fewer hooks than expected".
  const usedLabelOptions = useMemo(() => {
    const set = new Set<number>();
    if (usedLabels) {
      for (const l of usedLabels) {
        if (l != null) set.add(l);
      }
    }
    // Always include the current annotation's label.
    if (annotation?.label != null) set.add(annotation.label);
    return Array.from(set)
      .sort((a, b) => a - b)
      .map((v) => ({ value: v, label: String(v), color: stableColor(v) }));
  }, [usedLabels, annotation?.label]);

  if (!annotation) return null;

  const Icon = typeIcons[annotation.annotation_type] ?? CircleDot;
  const labelName = getLabelName(annotation.label, labelMapping);
  const labelColor = getLabelColor(annotation.label, labelMapping);
  const options = labelOptions ?? labelOptionsFromMapping(labelMapping);
  const hasMapping = options.length > 0;

  const isEdit = mode === "edit";
  const isDraft = mode === "draft";
  const canSave = isEdit && isDirty && !saving;
  const canRevert = isEdit && !saving;
  const canDelete = !saving;

  return (
    <div
      ref={menuRef}
      className="pointer-events-auto flex select-none items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1.5 text-xs shadow-lg"
      style={{
        whiteSpace: "nowrap",
        transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)`,
      }}
    >
      {/* Drag handle */}
      <button
        type="button"
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          dragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            originX: dragOffset.x,
            originY: dragOffset.y,
          };
          document.body.style.cursor = "grabbing";
          document.body.style.userSelect = "none";
        }}
        className="-ml-1 flex h-5 w-4 cursor-grab items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
        aria-label="Drag annotation panel"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      {/* Type icon */}
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />

      {/* Color dot */}
      <span
        className="h-3 w-3 shrink-0 rounded-full border"
        style={{ backgroundColor: labelColor }}
      />

      {/* Label: dropdown in edit/draft, read-only in view */}
      {mode === "view" ? (
        /* View: read-only label display — no dropdown toggle */
        <span className="max-w-[140px] truncate px-1 py-0.5 font-medium text-foreground">
          {labelName}
        </span>
      ) : hasMapping ? (
        /* Edit or draft: label dropdown from label_mapping */
        <div className="relative">
          <button
            ref={labelButtonRef}
            onClick={() => {
              if (!saving) setLabelOpen((o) => !o);
            }}
            disabled={saving}
            className="flex items-center gap-0.5 rounded px-1 py-0.5 text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            <span className="max-w-[140px] truncate font-medium">
              {annotation.label == null && isDraft ? "Pick label" : labelName}
            </span>
            <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
          </button>

          {labelOpen && dropdownPos &&
            createPortal(
              <div
                data-label-menu
                className="fixed z-[9999] max-h-48 overflow-auto rounded-md border bg-popover py-1 shadow-md"
                style={{
                  left: dropdownPos.left,
                  top: dropdownPos.top,
                  width: dropdownPos.width,
                }}
              >
                {options.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      onLabelChange(opt.value);
                      setLabelOpen(false);
                    }}
                    className={`w-full px-3 py-1.5 text-left text-[11px] hover:bg-muted ${
                      annotation.label === opt.value
                        ? "bg-muted font-medium text-foreground"
                        : "text-foreground"
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full border"
                        style={{ backgroundColor: opt.color }}
                      />
                      {opt.label}
                    </span>
                  </button>
                ))}
              </div>,
              document.body
            )}
        </div>
      ) : (
        /* No mapping: dropdown from used labels + custom number entry (edit/draft only) */
        <div className="relative">
          <button
            ref={labelButtonRef}
            onClick={() => {
              if (!saving) setLabelOpen((o) => !o);
            }}
            disabled={saving}
            className="flex items-center gap-0.5 rounded px-1 py-0.5 text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            <span className="max-w-[140px] truncate font-medium">
              {annotation.label == null && isDraft ? "Pick label" : labelName}
            </span>
            <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
          </button>

          {labelOpen && dropdownPos &&
            createPortal(
              <div
                data-label-menu
                className="fixed z-[9999] max-h-48 overflow-auto rounded-md border bg-popover py-1 shadow-md"
                style={{
                  left: dropdownPos.left,
                  top: dropdownPos.top,
                  width: dropdownPos.width,
                }}
              >
                {usedLabelOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      onLabelChange(opt.value);
                      setLabelOpen(false);
                    }}
                    className={`w-full px-3 py-1.5 text-left text-[11px] hover:bg-muted ${
                      annotation.label === opt.value
                        ? "bg-muted font-medium text-foreground"
                        : "text-foreground"
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full border"
                        style={{ backgroundColor: opt.color }}
                      />
                      {opt.label}
                    </span>
                  </button>
                ))}
              </div>,
              document.body
            )}
        </div>
      )}

      {/* Id badge / new tag / editing indicator */}
      {isDraft ? (
        <span className="text-[10px] text-muted-foreground tabular-nums">
          new
        </span>
      ) : (
        <span className="text-[10px] text-muted-foreground tabular-nums">
          #{annotation.id}
        </span>
      )}

      {/* Save — draft mode. Always visible — the freshly-drawn shape is unsaved by definition. */}
      {isDraft && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSave?.();
              }}
              disabled={saving}
              className="ml-0.5 flex h-5 items-center gap-1 rounded px-1.5 text-[10px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Check className="h-3 w-3" />
              )}
              Save
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Save annotation (Enter)</p>
          </TooltipContent>
        </Tooltip>
      )}

      {/* Save / Revert — edit mode only. Save hidden until something changes. */}
      {isEdit && (
        <>
          {(isDirty || saving) && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSave?.();
                  }}
                  disabled={!canSave}
                  className={`ml-0.5 flex h-5 items-center gap-1 rounded px-1.5 text-[10px] font-medium transition-colors ${
                    canSave
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  }`}
                >
                  {saving ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Check className="h-3 w-3" />
                  )}
                  Save
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Save changes (Enter)</p>
              </TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRevert?.();
                }}
                disabled={!canRevert}
                className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
              >
                <RotateCcw className="h-3 w-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Revert (Esc)</p>
            </TooltipContent>
          </Tooltip>
        </>
      )}

      {/* Delete (existing) / Discard (draft) */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            disabled={!canDelete}
            className="ml-0.5 flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {isDraft
              ? "Discard (don't save)"
              : saving
                ? "Saving…"
                : "Delete annotation"}
          </p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
