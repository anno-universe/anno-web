import { useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Row {
  id: number;
  key: string;
  value: string;
}

interface Props {
  value: Record<string, unknown>;
  onChange: (meta: Record<string, unknown>) => void;
  disabled?: boolean;
}

// Coerce a text field into a number / boolean / string for storage.
function coerce(raw: string): unknown {
  const t = raw.trim();
  if (t === "") return "";
  if (t === "true") return true;
  if (t === "false") return false;
  if (!Number.isNaN(Number(t)) && /^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  return raw;
}

function toText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/**
 * Structured editor for `meta_info` — free key/value pairs for basic project
 * metadata (e.g. keypoint_class_count = 17). Numbers and booleans are coerced
 * automatically; everything else is stored as a string.
 */
export function MetaInfoEditor({ value, onChange, disabled }: Props) {
  const counter = useRef(0);
  const [rows, setRows] = useState<Row[]>(() =>
    Object.entries(value).map(([key, v]) => ({
      id: counter.current++,
      key,
      value: toText(v),
    }))
  );

  function emit(next: Row[]) {
    setRows(next);
    const meta: Record<string, unknown> = {};
    for (const r of next) {
      const key = r.key.trim();
      if (key) meta[key] = coerce(r.value);
    }
    onChange(meta);
  }

  const update = (id: number, patch: Partial<Row>) =>
    emit(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const remove = (id: number) => emit(rows.filter((r) => r.id !== id));
  const add = () =>
    emit([...rows, { id: counter.current++, key: "", value: "" }]);

  return (
    <div className="space-y-2">
      {rows.length > 0 && (
        <div className="flex gap-2 px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <span className="flex-1">Key</span>
          <span className="flex-1">Value</span>
          <span className="w-7" />
        </div>
      )}
      {rows.map((row) => (
        <div key={row.id} className="flex items-center gap-2">
          <Input
            type="text"
            value={row.key}
            onChange={(e) => update(row.id, { key: e.target.value })}
            disabled={disabled}
            placeholder="keypoint_class_count"
            className="flex-1"
          />
          <Input
            type="text"
            value={row.value}
            onChange={(e) => update(row.id, { value: e.target.value })}
            disabled={disabled}
            placeholder="17"
            className="flex-1"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => remove(row.id)}
            disabled={disabled}
            className="h-9 w-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            aria-label="Remove field"
          >
            <Trash2 />
          </Button>
        </div>
      ))}
      {rows.length === 0 && (
        <p className="px-1 text-xs text-muted-foreground">
          No metadata. Add basic project info, e.g. keypoint_class_count.
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
          Add field
        </Button>
      )}
    </div>
  );
}
