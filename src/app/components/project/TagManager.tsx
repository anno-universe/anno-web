import {
  useRef,
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import { Plus, Trash2, RefreshCw } from "lucide-react";
import { randomLabelColor } from "@/lib/utils/labelMapping";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableCell, TableRow } from "@/components/ui/table";
import { SettingsTable } from "@/components/project/SettingsTable";
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

interface TagChanges {
  creates: TagCreateInput[];
  updates: { id: number; patch: TagUpdateInput }[];
  deletes: number[];
}

const TAG_COLUMNS = [
  { key: "name", header: "Name" },
  { key: "display-name", header: "Display name" },
  { key: "color", header: "Color", className: "w-40" },
  { key: "active", header: "Active", className: "w-24 text-center" },
  { key: "actions", className: "w-12" },
] as const;

export interface TagManagerHandle {
  collectChanges: () => TagChanges;
}

interface Props {
  tags: TagOutput[];
  disabled?: boolean;
  onDirtyChange?: (isDirty: boolean) => void;
}

function collectTagChanges(rows: Row[], deletedIds: Set<number>): TagChanges {
  const creates: TagCreateInput[] = [];
  const updates: { id: number; patch: TagUpdateInput }[] = [];
  const deletes = Array.from(deletedIds);

  for (const row of rows) {
    if (row.id == null) {
      if (row.name.trim() && row.displayName.trim()) {
        creates.push({
          name: row.name.trim(),
          display_name: row.displayName.trim(),
          color: row.color,
          description: row.description.trim() || undefined,
        });
      }
      continue;
    }

    if (!row.original) continue;

    const patch: TagUpdateInput = {};
    if (row.displayName !== row.original.displayName) {
      patch.display_name = row.displayName;
    }
    if (row.color !== row.original.color) patch.color = row.color;
    const description = row.description.trim();
    if (description !== row.original.description) {
      patch.description = description || null;
    }
    if (row.isActive !== row.original.isActive) {
      patch.is_active = row.isActive;
    }
    if (Object.keys(patch).length > 0) {
      updates.push({ id: row.id, patch });
    }
  }

  return { creates, updates, deletes };
}

function hasTagChanges(changes: TagChanges): boolean {
  return (
    changes.creates.length > 0 ||
    changes.updates.length > 0 ||
    changes.deletes.length > 0
  );
}

/**
 * Editor for project-level tag definitions.
 * All edits are local — the parent's Save button triggers persistence
 * via the imperative `collectChanges()` handle.
 */
export const TagManager = forwardRef<TagManagerHandle, Props>(
  function TagManager({ tags, disabled = false, onDirtyChange }, ref) {
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
      deletedIds.current.clear();
      setRows(tagsToRows(tags));
    }, [tags]);

    useImperativeHandle(
      ref,
      () => ({
        collectChanges: () => collectTagChanges(rows, deletedIds.current),
      }),
      [rows],
    );

    useEffect(() => {
      onDirtyChange?.(
        hasTagChanges(collectTagChanges(rows, deletedIds.current)),
      );
    }, [onDirtyChange, rows]);

    function update(key: number, patch: Partial<Row>) {
      setRows((prev) =>
        prev.map((r) => (r.key === key ? { ...r, ...patch } : r)),
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
      <div className="flex min-w-0 flex-col gap-2">
        {!disabled && (
          <div className="flex justify-end">
            <Button type="button" variant="outline" size="sm" onClick={add}>
              <Plus data-icon="inline-start" />
              Add tag
            </Button>
          </div>
        )}

        <SettingsTable
          columns={TAG_COLUMNS}
          tableClassName="min-w-[40rem]"
          emptyMessage={
            rows.length === 0
              ? "No tags defined yet. Create tags to track image annotation progress."
              : undefined
          }
        >
          {rows.map((row) => (
            <TableRow key={row.key}>
              <TableCell>
                {row.id == null ? (
                  <Input
                    value={row.name}
                    onChange={(event) =>
                      update(row.key, { name: event.target.value })
                    }
                    disabled={disabled}
                    placeholder="key"
                  />
                ) : (
                  <span className="font-mono text-sm text-muted-foreground">
                    {row.name}
                  </span>
                )}
              </TableCell>
              <TableCell>
                <Input
                  value={row.displayName}
                  onChange={(event) =>
                    update(row.key, { displayName: event.target.value })
                  }
                  disabled={disabled}
                  placeholder="Display name"
                />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <input
                    type="color"
                    value={row.color}
                    onChange={(event) =>
                      update(row.key, {
                        color: event.target.value.toUpperCase(),
                      })
                    }
                    disabled={disabled}
                    className="size-9 shrink-0 cursor-pointer rounded-md border bg-background p-1"
                    aria-label={`${row.displayName || row.name || "Tag"} color`}
                  />
                  <Input
                    value={row.color}
                    onChange={(event) =>
                      update(row.key, {
                        color: event.target.value.toUpperCase(),
                      })
                    }
                    disabled={disabled}
                    placeholder="#6366F1"
                    className="font-mono text-xs"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() =>
                      update(row.key, { color: randomLabelColor() })
                    }
                    disabled={disabled}
                    aria-label="Random color"
                  >
                    <RefreshCw />
                  </Button>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex justify-center">
                  <Switch
                    checked={row.isActive}
                    onCheckedChange={(isActive) =>
                      update(row.key, { isActive })
                    }
                    disabled={disabled}
                    aria-label={`${row.displayName || row.name || "Tag"} active`}
                  />
                </div>
              </TableCell>
              <TableCell>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => remove(row.key)}
                  disabled={disabled}
                  aria-label={`Delete tag ${row.displayName || row.name}`}
                >
                  <Trash2 />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </SettingsTable>
      </div>
    );
  },
);
