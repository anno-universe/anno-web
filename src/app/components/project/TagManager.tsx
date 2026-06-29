import { useRef, useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Check, X, RefreshCw } from "lucide-react";
import { randomLabelColor } from "@/lib/utils/labelMapping";
import {
  createTag,
  updateTag,
  deleteTag,
} from "@/api/tags";
import type { TagOutput } from "@/types/tag";

interface Row {
  key: number; // local stable id
  id: number | null; // null = unsaved
  name: string;
  displayName: string;
  color: string;
  description: string;
  isActive: boolean;
  // tracking original for dirty detection
  original: {
    displayName: string;
    color: string;
    description: string;
    isActive: boolean;
  } | null; // null for unsaved rows
}

interface Props {
  projectId: number;
  tags: TagOutput[];
  onTagsChanged: () => void;
  disabled?: boolean;
}

/**
 * Editor for project-level tag definitions.
 * Visual style mirrors LabelMappingEditor — always-editable rows,
 * same input classes and spacing. Each change persists via the tag REST API.
 */
export function TagManager({
  projectId,
  tags,
  onTagsChanged,
  disabled = false,
}: Props) {
  const counter = useRef(0);
  const [rows, setRows] = useState<Row[]>(() => tagsToRows(tags));

  function tagsToRows(tagList: TagOutput[]): Row[] {
    return tagList.map((t) => ({
      key: counter.current++,
      id: t.id,
      name: t.name,
      displayName: t.display_name,
      color: t.color,
      description: t.description ?? "",
      isActive: t.is_active,
      original: {
        displayName: t.display_name,
        color: t.color,
        description: t.description ?? "",
        isActive: t.is_active,
      },
    }));
  }

  // Sync from external when tags reload (e.g. after API response)
  useEffect(() => {
    setRows(tagsToRows(tags));
  }, [tags]);

  const dirty = useCallback(
    (row: Row): boolean => {
      if (!row.original) return true; // unsaved row is always "dirty"
      return (
        row.displayName !== row.original.displayName ||
        row.color !== row.original.color ||
        row.description !== row.original.description ||
        row.isActive !== row.original.isActive
      );
    },
    []
  );

  const update = (key: number, patch: Partial<Row>) =>
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, ...patch } : r))
    );

  // ---- Persist helpers ----

  async function saveExistingRow(row: Row) {
    if (!row.id || !row.original) return;
    const patch: Record<string, unknown> = {};
    if (row.displayName !== row.original.displayName)
      patch.display_name = row.displayName;
    if (row.color !== row.original.color) patch.color = row.color;
    const desc = row.description.trim();
    if (desc !== row.original.description)
      patch.description = desc || null;
    if (row.isActive !== row.original.isActive)
      patch.is_active = row.isActive;
    if (Object.keys(patch).length === 0) return;

    try {
      await updateTag(projectId, row.id, patch);
      onTagsChanged(); // reload from server to get canonical state
    } catch {
      // non-blocking
    }
  }

  async function createNewRow(row: Row) {
    if (!row.name.trim() || !row.displayName.trim()) return;
    try {
      await createTag(projectId, {
        name: row.name.trim(),
        display_name: row.displayName.trim(),
        color: row.color,
        description: row.description.trim() || undefined,
      });
      onTagsChanged();
    } catch {
      // non-blocking
    }
  }

  function remove(key: number) {
    const row = rows.find((r) => r.key === key);
    if (!row) return;
    setRows((prev) => prev.filter((r) => r.key !== key));
    if (row.id != null) {
      deleteTag(projectId, row.id)
        .then(() => onTagsChanged())
        .catch(() => {});
    }
  }

  function add() {
    setRows((prev) => [
      ...prev,
      {
        key: counter.current++,
        id: null,
        name: "",
        displayName: "",
        color: "#6366F1",
        description: "",
        isActive: true,
        original: null,
      },
    ]);
  }

  return (
    <div className="space-y-2">
      {/* Header — same style as LabelMappingEditor */}
      {rows.length > 0 && (
        <div className="flex gap-2 px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <span className="flex-1">Name</span>
          <span className="flex-1">Display name</span>
          <span className="w-32">Color</span>
          <span className="w-16 text-center">Active</span>
          <span className="w-7" />
        </div>
      )}

      {rows.map((row) => {
        const isNew = row.id == null;
        const isDirty = dirty(row);

        return (
          <div key={row.key} className="flex items-center gap-2">
            {/* Name */}
            {isNew ? (
              <input
                type="text"
                value={row.name}
                onChange={(e) => update(row.key, { name: e.target.value })}
                disabled={disabled}
                placeholder="key"
                className="flex-1 rounded-md border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
              />
            ) : (
              <span className="flex-1 truncate px-3 py-2 font-mono text-sm text-muted-foreground">
                {row.name}
              </span>
            )}

            {/* Display name */}
            <input
              type="text"
              value={row.displayName}
              onChange={(e) => update(row.key, { displayName: e.target.value })}
              onBlur={() => {
                if (!isNew && dirty(row)) saveExistingRow(row);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isNew && dirty(row))
                  saveExistingRow(row);
              }}
              disabled={disabled}
              placeholder="Display name"
              className="flex-1 rounded-md border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
            />

            {/* Color — matches LabelMappingEditor: picker + hex input + randomize */}
            <div className="flex w-32 items-center gap-1.5">
              <input
                type="color"
                value={row.color}
                onChange={(e) => {
                  update(row.key, { color: e.target.value.toUpperCase() });
                  if (!isNew) {
                    const r = rows.find((x) => x.key === row.key);
                    if (r) {
                      const updated = { ...r, color: e.target.value.toUpperCase() };
                      saveExistingRow(updated);
                    }
                  }
                }}
                disabled={disabled}
                className="h-9 w-9 shrink-0 cursor-pointer rounded-md border bg-background p-1 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Tag color"
              />
              <input
                type="text"
                value={row.color}
                onChange={(e) => update(row.key, { color: e.target.value.toUpperCase() })}
                onBlur={() => {
                  if (!isNew && dirty(row)) saveExistingRow(row);
                }}
                disabled={disabled}
                placeholder="#6366F1"
                className="min-w-0 flex-1 rounded-md border bg-background px-2 py-2 font-mono text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => {
                  const newColor = randomLabelColor();
                  update(row.key, { color: newColor });
                  if (!isNew) {
                    const r = rows.find((x) => x.key === row.key);
                    if (r) saveExistingRow({ ...r, color: newColor });
                  }
                }}
                disabled={disabled}
                className="flex h-9 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
                aria-label="Random color"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Active toggle */}
            <div className="w-16 text-center">
              <input
                type="checkbox"
                checked={row.isActive}
                onChange={(e) => {
                  update(row.key, { isActive: e.target.checked });
                  if (!isNew) {
                    const r = rows.find((x) => x.key === row.key);
                    if (r) {
                      saveExistingRow({ ...r, isActive: e.target.checked });
                    }
                  }
                }}
                disabled={disabled || isNew}
                className="h-4 w-4 cursor-pointer rounded border-input text-primary focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>

            {/* Actions */}
            <div className="flex w-7 shrink-0 justify-center">
              {isNew ? (
                <div className="flex gap-0.5">
                  <button
                    type="button"
                    onClick={() => createNewRow(row)}
                    disabled={disabled || !row.name.trim() || !row.displayName.trim()}
                    className="flex h-9 w-7 items-center justify-center rounded-md text-green-600 hover:bg-green-50 disabled:opacity-30"
                    title="Save"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(row.key)}
                    disabled={disabled}
                    className="flex h-9 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                    title="Cancel"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => remove(row.key)}
                  disabled={disabled}
                  className="flex h-9 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                  aria-label="Delete tag"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        );
      })}

      {/* Empty state — same tone as LabelMappingEditor */}
      {rows.length === 0 && (
        <p className="px-1 text-xs text-muted-foreground">
          No tags defined yet. Create tags to track image annotation progress.
        </p>
      )}

      {/* Add button — same style as LabelMappingEditor */}
      {!disabled && (
        <button
          type="button"
          onClick={add}
          className="flex items-center gap-1.5 rounded-md border border-dashed px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
          Add tag
        </button>
      )}
    </div>
  );
}
