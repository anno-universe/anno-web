import {
  useRef,
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import { Plus, Trash2, RefreshCw } from "lucide-react";
import { randomLabelColor } from "@/lib/utils/labelMapping";
import type { TagOutput, TagCreateInput, TagUpdateInput } from "@/types/tag";

interface Row {
  key: number; // local stable id
  id: number | null; // null = new (not yet created on server)
  name: string;
  displayName: string;
  color: string;
  description: string;
  isActive: boolean;
  original: {
    displayName: string;
    color: string;
    description: string;
    isActive: boolean;
  } | null; // null for new rows
}

export interface TagManagerHandle {
  collectChanges: () => {
    creates: TagCreateInput[];
    updates: { id: number; patch: TagUpdateInput }[];
    deletes: number[];
  };
}

interface Props {
  tags: TagOutput[];
  disabled?: boolean;
}

/**
 * Editor for project-level tag definitions.
 * All edits are local — the parent's Save button triggers persistence
 * via the imperative `collectChanges()` handle.
 */
export const TagManager = forwardRef<TagManagerHandle, Props>(
  function TagManager({ tags, disabled = false }, ref) {
    const counter = useRef(0);
    const deletedIds = useRef<Set<number>>(new Set());
    const [rows, setRows] = useState<Row[]>(() => tagsToRows(tags));

    function tagsToRows(tagList: TagOutput[]): Row[] {
      return tagList
        .filter((t) => !deletedIds.current.has(t.id))
        .map((t) => ({
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

    // Sync when parent reloads tags (after save)
    useEffect(() => {
      setRows(tagsToRows(tags));
    }, [tags]);

    useImperativeHandle(ref, () => ({
      collectChanges() {
        const creates: TagCreateInput[] = [];
        const updates: { id: number; patch: TagUpdateInput }[] = [];
        const deletes = Array.from(deletedIds.current);

        for (const row of rows) {
          if (row.id == null) {
            // New row
            if (row.name.trim() && row.displayName.trim()) {
              creates.push({
                name: row.name.trim(),
                display_name: row.displayName.trim(),
                color: row.color,
                description: row.description.trim() || undefined,
              });
            }
          } else if (row.original) {
            // Existing row — compute diff
            const patch: TagUpdateInput = {};
            if (row.displayName !== row.original.displayName)
              patch.display_name = row.displayName;
            if (row.color !== row.original.color) patch.color = row.color;
            const desc = row.description.trim();
            if (desc !== row.original.description)
              patch.description = desc || null;
            if (row.isActive !== row.original.isActive)
              patch.is_active = row.isActive;
            if (Object.keys(patch).length > 0) {
              updates.push({ id: row.id, patch });
            }
          }
        }

        return { creates, updates, deletes };
      },
    }));

    function update(key: number, patch: Partial<Row>) {
      setRows((prev) =>
        prev.map((r) => (r.key === key ? { ...r, ...patch } : r))
      );
    }

    function remove(key: number) {
      const row = rows.find((r) => r.key === key);
      if (!row) return;
      if (row.id != null) {
        deletedIds.current.add(row.id);
      }
      setRows((prev) => prev.filter((r) => r.key !== key));
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
        {rows.length > 0 && (
          <div className="flex gap-2 px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <span className="flex-1">Name</span>
            <span className="flex-1">Display name</span>
            <span className="w-32">Color</span>
            <span className="w-16 text-center">Active</span>
            <span className="w-7" />
          </div>
        )}

        {rows.map((row) => (
          <div key={row.key} className="flex items-center gap-2">
            {/* Name */}
            {row.id == null ? (
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
              onChange={(e) =>
                update(row.key, { displayName: e.target.value })
              }
              disabled={disabled}
              placeholder="Display name"
              className="flex-1 rounded-md border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
            />

            {/* Color */}
            <div className="flex w-32 items-center gap-1.5">
              <input
                type="color"
                value={row.color}
                onChange={(e) =>
                  update(row.key, { color: e.target.value.toUpperCase() })
                }
                disabled={disabled}
                className="h-9 w-9 shrink-0 cursor-pointer rounded-md border bg-background p-1 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Tag color"
              />
              <input
                type="text"
                value={row.color}
                onChange={(e) =>
                  update(row.key, { color: e.target.value.toUpperCase() })
                }
                disabled={disabled}
                placeholder="#6366F1"
                className="min-w-0 flex-1 rounded-md border bg-background px-2 py-2 font-mono text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() =>
                  update(row.key, { color: randomLabelColor() })
                }
                disabled={disabled}
                className="flex h-9 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
                aria-label="Random color"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Active */}
            <div className="w-16 text-center">
              <input
                type="checkbox"
                checked={row.isActive}
                onChange={(e) =>
                  update(row.key, { isActive: e.target.checked })
                }
                disabled={disabled}
                className="h-4 w-4 cursor-pointer rounded border-input text-primary focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>

            {/* Delete */}
            <button
              type="button"
              onClick={() => remove(row.key)}
              disabled={disabled}
              className="flex h-9 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
              aria-label="Delete tag"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}

        {rows.length === 0 && (
          <p className="px-1 text-xs text-muted-foreground">
            No tags defined yet. Create tags to track image annotation progress.
          </p>
        )}

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
);
