import { useRef, useState, useEffect } from "react";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getLabelEntry,
  isHexColor,
  randomLabelColor,
  stableColor,
  type LabelMappingEntry,
} from "@/lib/utils/labelMapping";

interface Row {
  id: number;
  name: string;
  value: string;
  color: string;
}

interface Props {
  value: Record<string, unknown>;
  onChange: (mapping: Record<string, LabelMappingEntry>) => void;
  disabled?: boolean;
}

/**
 * Structured editor for the `label_mapping.labels` map.
 */
export function LabelMappingEditor({ value, onChange, disabled }: Props) {
  const counter = useRef(0);
  const userEditingRef = useRef(false);
  const [rows, setRows] = useState<Row[]>(() =>
    Object.entries(value).map(([name, v]) => {
      const entry = getLabelEntry(v, name);
      return {
        id: counter.current++,
        name,
        value: entry ? String(entry.id) : "",
        color: entry?.color ?? randomLabelColor(),
      };
    })
  );

  // Sync rows when value changes externally (page load, save response).
  // Skip when the change was triggered by our own emit() to avoid loops.
  useEffect(() => {
    if (userEditingRef.current) {
      userEditingRef.current = false;
      return;
    }
    const next = Object.entries(value).map(([name, v]) => {
      const entry = getLabelEntry(v, name);
      return {
        id: counter.current++,
        name,
        value: entry ? String(entry.id) : "",
        color: entry?.color ?? randomLabelColor(),
      };
    });
    setRows(next);
  }, [value]);

  function emit(next: Row[]) {
    userEditingRef.current = true;
    setRows(next);
    const mapping: Record<string, LabelMappingEntry> = {};
    for (const r of next) {
      const name = r.name.trim();
      if (name && r.value !== "" && !Number.isNaN(Number(r.value))) {
        mapping[name] = {
          id: Number(r.value),
          color: isHexColor(r.color)
            ? r.color.toUpperCase()
            : stableColor(r.value || name),
        };
      }
    }
    onChange(mapping);
  }

  const update = (id: number, patch: Partial<Row>) =>
    emit(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const remove = (id: number) => emit(rows.filter((r) => r.id !== id));
  const add = () =>
    emit([
      ...rows,
      { id: counter.current++, name: "", value: "", color: randomLabelColor() },
    ]);

  return (
    <div className="space-y-2">
      {rows.length > 0 && (
        <div className="flex gap-2 px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <span className="flex-1">Class name</span>
          <span className="w-24">Numeric id</span>
          <span className="w-32">Color</span>
          <span className="w-7" />
        </div>
      )}
      {rows.map((row) => (
        <div key={row.id} className="flex items-center gap-2">
          <Input
            type="text"
            value={row.name}
            onChange={(e) => update(row.id, { name: e.target.value })}
            disabled={disabled}
            placeholder="chromosome"
            className="flex-1"
          />
          <Input
            type="number"
            value={row.value}
            onChange={(e) => update(row.id, { value: e.target.value })}
            disabled={disabled}
            placeholder="1"
            className="w-24"
          />
          <div className="flex w-32 items-center gap-1.5">
            <input
              type="color"
              value={isHexColor(row.color) ? row.color : "#2563EB"}
              onChange={(e) =>
                update(row.id, { color: e.target.value.toUpperCase() })
              }
              disabled={disabled}
              className="h-9 w-9 shrink-0 cursor-pointer rounded-md border bg-background p-1 disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Label color"
            />
            <Input
              type="text"
              value={row.color}
              onChange={(e) =>
                update(row.id, { color: e.target.value.toUpperCase() })
              }
              disabled={disabled}
              placeholder="#00FF00"
              aria-invalid={!!row.color && !isHexColor(row.color)}
              className="min-w-0 flex-1 px-2 font-mono text-xs"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => update(row.id, { color: randomLabelColor() })}
              disabled={disabled}
              className="h-9 w-7 text-muted-foreground"
              aria-label="Random color"
            >
              <RefreshCw />
            </Button>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => remove(row.id)}
            disabled={disabled}
            className="h-9 w-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            aria-label="Remove label"
          >
            <Trash2 />
          </Button>
        </div>
      ))}
      {rows.length === 0 && (
        <p className="px-1 text-xs text-muted-foreground">
          No labels yet. Add the classes annotators will use.
        </p>
      )}
      {!disabled && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={add}
          className="border-dashed text-xs text-muted-foreground"
        >
          <Plus />
          Add label
        </Button>
      )}
    </div>
  );
}
