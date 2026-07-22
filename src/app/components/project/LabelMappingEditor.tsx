import { useRef, useState } from "react";
import { ChevronDown, ChevronUp, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableCell, TableRow } from "@/components/ui/table";
import { SettingsTable } from "@/components/project/SettingsTable";
import {
  getLabelEntry,
  isHexColor,
  randomLabelColor,
  stableColor,
  type LabelMappingEntry,
  type SupercategoryEntry,
} from "@/lib/utils/labelMapping";

interface LabelRow {
  rowId: number;
  name: string;
  value: string;
  color: string;
  supercategory: string;
  keypoints: string[];
}

interface SupercategoryRow {
  rowId: number;
  name: string;
  keypoints: string[];
}

const SUPERCATEGORY_COLUMNS = [
  { key: "name", header: "Name" },
  { key: "actions", className: "w-12" },
] as const;

const LABEL_COLUMNS = [
  { key: "category", header: "Category" },
  { key: "id", header: "ID", className: "w-24" },
  { key: "supercategory", header: "Supercategory" },
  { key: "color", header: "Color", className: "w-40" },
  { key: "actions", className: "w-12" },
] as const;

interface Props {
  value: Record<string, unknown>;
  supercategories?: Record<string, SupercategoryEntry>;
  onChange: (
    labels: Record<string, LabelMappingEntry>,
    supercategories: Record<string, SupercategoryEntry>,
  ) => void;
  disabled?: boolean;
}

interface TemplateEditorProps {
  keypoints: string[];
  disabled?: boolean;
  onChange: (keypoints: string[]) => void;
}

export function TemplateEditor({
  keypoints,
  disabled,
  onChange,
}: TemplateEditorProps) {
  return (
    <div className="flex flex-col gap-2 rounded-md bg-muted/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium">Ordered keypoint template</p>
        {!disabled && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange([...keypoints, ""])}
          >
            <Plus data-icon="inline-start" />
            Add point
          </Button>
        )}
      </div>
      {keypoints.map((keypoint, index) => (
        <div key={`point-${index}`} className="flex items-center gap-2">
          <span className="w-6 text-right text-xs tabular-nums text-muted-foreground">
            {index}
          </span>
          <Input
            value={keypoint}
            onChange={(event) =>
              onChange(
                keypoints.map((name, i) =>
                  i === index ? event.target.value : name,
                ),
              )
            }
            disabled={disabled}
            placeholder={index === 0 ? "nose" : "left_eye"}
            aria-label={`Keypoint ${index + 1} name`}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              if (index === 0) return;
              const next = [...keypoints];
              [next[index - 1], next[index]] = [next[index], next[index - 1]];
              onChange(next);
            }}
            disabled={disabled || index === 0}
            aria-label={`Move keypoint ${index + 1} up`}
          >
            <ChevronUp />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              if (index === keypoints.length - 1) return;
              const next = [...keypoints];
              [next[index + 1], next[index]] = [next[index], next[index + 1]];
              onChange(next);
            }}
            disabled={disabled || index === keypoints.length - 1}
            aria-label={`Move keypoint ${index + 1} down`}
          >
            <ChevronDown />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onChange(keypoints.filter((_, i) => i !== index))}
            disabled={disabled}
            aria-label={`Remove keypoint ${index + 1}`}
          >
            <Trash2 />
          </Button>
        </div>
      ))}
      {keypoints.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No keypoint template configured.
        </p>
      )}
    </div>
  );
}

export function LabelMappingEditor({
  value,
  supercategories = {},
  onChange,
  disabled,
}: Props) {
  const counter = useRef(0);
  // Local rows are the single source of truth while editing. We seed once from
  // props here; the parent re-mounts this editor (keyed by project id, and the
  // create dialog remounts on open) whenever it needs a reset. There is no
  // prop-sync effect, so a re-render never regenerates row keys mid-edit and
  // steals input focus.
  const [labelRows, setLabelRows] = useState<LabelRow[]>(() =>
    makeLabelRows(value, counter),
  );
  const [superRows, setSuperRows] = useState<SupercategoryRow[]>(() =>
    makeSuperRows(supercategories, counter),
  );

  function emit(nextLabels: LabelRow[], nextSupers: SupercategoryRow[]) {
    setLabelRows(nextLabels);
    setSuperRows(nextSupers);
    const labels: Record<string, LabelMappingEntry> = {};
    for (const row of nextLabels) {
      const name = row.name.trim();
      if (!name || row.value === "" || Number.isNaN(Number(row.value)))
        continue;
      const keypoints = row.keypoints
        .map((point) => point.trim())
        .filter(Boolean);
      labels[name] = {
        id: Number(row.value),
        color: isHexColor(row.color)
          ? row.color.toUpperCase()
          : stableColor(row.value || name),
        ...(row.supercategory ? { supercategory: row.supercategory } : {}),
        ...(keypoints.length > 0 ? { keypoints } : {}),
      };
    }
    const supers: Record<string, SupercategoryEntry> = {};
    for (const row of nextSupers) {
      const name = row.name.trim();
      if (!name) continue;
      const keypoints = row.keypoints
        .map((point) => point.trim())
        .filter(Boolean);
      supers[name] = keypoints.length > 0 ? { keypoints } : {};
    }
    onChange(labels, supers);
  }

  const superNames = superRows.map((row) => row.name.trim()).filter(Boolean);

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">Supercategories</p>
            <p className="text-xs text-muted-foreground">
              Parent categories can provide one shared keypoint template.
            </p>
          </div>
          {!disabled && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                emit(labelRows, [
                  ...superRows,
                  { rowId: counter.current++, name: "", keypoints: [] },
                ])
              }
            >
              <Plus data-icon="inline-start" />
              Add supercategory
            </Button>
          )}
        </div>
        <SettingsTable
          columns={SUPERCATEGORY_COLUMNS}
          emptyMessage={
            superRows.length === 0 ? "No supercategories." : undefined
          }
        >
          {superRows.map((row) => (
            <TableRow key={row.rowId}>
              <TableCell>
                <Input
                  value={row.name}
                  onChange={(event) => {
                    const nextName = event.target.value;
                    // Only cascade the rename to child labels when the old name
                    // is non-empty. Otherwise naming a freshly-added
                    // supercategory would reparent every label with no
                    // supercategory (they all match the empty string).
                    const nextLabels = row.name.trim()
                      ? labelRows.map((label) =>
                          label.supercategory === row.name
                            ? { ...label, supercategory: nextName }
                            : label,
                        )
                      : labelRows;
                    emit(
                      nextLabels,
                      superRows.map((candidate) =>
                        candidate.rowId === row.rowId
                          ? { ...candidate, name: nextName }
                          : candidate,
                      ),
                    );
                  }}
                  disabled={disabled}
                  placeholder="dog"
                />
              </TableCell>
              <TableCell>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() =>
                    emit(
                      labelRows.map((label) =>
                        label.supercategory === row.name
                          ? { ...label, supercategory: "" }
                          : label,
                      ),
                      superRows.filter((item) => item.rowId !== row.rowId),
                    )
                  }
                  disabled={disabled}
                  aria-label={`Remove supercategory ${row.name}`}
                >
                  <Trash2 />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </SettingsTable>
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">Labels</p>
            <p className="text-xs text-muted-foreground">
              Categories may inherit their parent's template or define an
              override.
            </p>
          </div>
          {!disabled && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                emit(
                  [
                    ...labelRows,
                    {
                      rowId: counter.current++,
                      name: "",
                      value: "",
                      color: randomLabelColor(),
                      supercategory: "",
                      keypoints: [],
                    },
                  ],
                  superRows,
                )
              }
            >
              <Plus data-icon="inline-start" />
              Add label
            </Button>
          )}
        </div>
        <SettingsTable
          columns={LABEL_COLUMNS}
          tableClassName="min-w-[42rem]"
          emptyMessage={labelRows.length === 0 ? "No labels." : undefined}
        >
          {labelRows.map((row) => (
            <TableRow key={row.rowId}>
              <TableCell>
                <Input
                  value={row.name}
                  onChange={(event) =>
                    emit(
                      labelRows.map((candidate) =>
                        candidate.rowId === row.rowId
                          ? { ...candidate, name: event.target.value }
                          : candidate,
                      ),
                      superRows,
                    )
                  }
                  disabled={disabled}
                  placeholder="golden_retriever"
                />
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  value={row.value}
                  onChange={(event) =>
                    emit(
                      labelRows.map((candidate) =>
                        candidate.rowId === row.rowId
                          ? { ...candidate, value: event.target.value }
                          : candidate,
                      ),
                      superRows,
                    )
                  }
                  disabled={disabled}
                />
              </TableCell>
              <TableCell>
                <Select
                  value={row.supercategory || "__none__"}
                  onValueChange={(supercategory) =>
                    emit(
                      labelRows.map((candidate) =>
                        candidate.rowId === row.rowId
                          ? {
                              ...candidate,
                              supercategory:
                                supercategory === "__none__"
                                  ? ""
                                  : supercategory,
                            }
                          : candidate,
                      ),
                      superRows,
                    )
                  }
                  disabled={disabled}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="__none__">None</SelectItem>
                      {superNames.map((name) => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <input
                    type="color"
                    value={isHexColor(row.color) ? row.color : "#2563EB"}
                    onChange={(event) =>
                      emit(
                        labelRows.map((candidate) =>
                          candidate.rowId === row.rowId
                            ? {
                                ...candidate,
                                color: event.target.value.toUpperCase(),
                              }
                            : candidate,
                        ),
                        superRows,
                      )
                    }
                    disabled={disabled}
                    className="size-9 shrink-0 cursor-pointer rounded-md border bg-background p-1"
                    aria-label={`${row.name || "Label"} color`}
                  />
                  <Input
                    value={row.color}
                    readOnly
                    className="font-mono text-xs"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() =>
                      emit(
                        labelRows.map((candidate) =>
                          candidate.rowId === row.rowId
                            ? { ...candidate, color: randomLabelColor() }
                            : candidate,
                        ),
                        superRows,
                      )
                    }
                    disabled={disabled}
                    aria-label="Random color"
                  >
                    <RefreshCw />
                  </Button>
                </div>
              </TableCell>
              <TableCell>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() =>
                    emit(
                      labelRows.filter((item) => item.rowId !== row.rowId),
                      superRows,
                    )
                  }
                  disabled={disabled}
                  aria-label={`Remove label ${row.name}`}
                >
                  <Trash2 />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </SettingsTable>
      </div>
    </div>
  );
}

function makeLabelRows(
  value: Record<string, unknown>,
  counter: import("react").MutableRefObject<number>,
) {
  return Object.entries(value).map(([name, raw]) => {
    const entry = getLabelEntry(raw, name);
    return {
      rowId: counter.current++,
      name,
      value: entry ? String(entry.id) : "",
      color: entry?.color ?? randomLabelColor(),
      supercategory: entry?.supercategory ?? "",
      keypoints: entry?.keypoints ?? [],
    };
  });
}

function makeSuperRows(
  value: Record<string, SupercategoryEntry>,
  counter: import("react").MutableRefObject<number>,
) {
  return Object.entries(value).map(([name, entry]) => ({
    rowId: counter.current++,
    name,
    keypoints: entry.keypoints ?? [],
  }));
}
