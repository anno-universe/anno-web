import { useEffect, useRef } from "react";
import type { TagOutput } from "@/types/tag";

interface Props {
  projectTags: TagOutput[];
  appliedTagIds: Set<number>;
  onSelect: (tagId: number) => void;
  onClose: () => void;
}

/**
 * Dropdown picker for selecting a tag to apply.
 * Renders available project tags, excluding already-applied ones.
 * Dismisses on click outside or Escape.
 */
export function TagPicker({
  projectTags,
  appliedTagIds,
  onSelect,
  onClose,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  const available = projectTags.filter((t) => !appliedTagIds.has(t.id));

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClick);
      document.addEventListener("keydown", handleKey);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  if (available.length === 0) {
    return (
      <div
        ref={ref}
        className="absolute right-0 top-full z-50 mt-1 min-w-[200px] rounded-lg border bg-popover py-2 shadow-lg"
      >
        <p className="px-3 py-2 text-center text-xs text-muted-foreground">
          No tags available.
          <br />
          <span className="text-[11px]">
            Ask a supervisor to define project tags in Settings.
          </span>
        </p>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full z-50 mt-1 min-w-[200px] max-w-[280px] rounded-lg border bg-popover py-1 shadow-lg"
    >
      <p className="px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
        Apply tag
      </p>
      <div className="max-h-[240px] overflow-auto">
        {available.map((tag) => (
          <button
            key={tag.id}
            onClick={() => {
              onSelect(tag.id);
              onClose();
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-muted"
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: tag.color }}
            />
            <span className="truncate text-foreground">
              {tag.display_name || tag.name}
            </span>
            {tag.description && (
              <span className="ml-auto shrink-0 truncate text-[10px] text-muted-foreground max-w-[80px]">
                {tag.description}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
