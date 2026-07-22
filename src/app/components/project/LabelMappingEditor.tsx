import { useEffect, useMemo, useRef, useState } from "react";
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
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
  duplicateIds,
  duplicateNames,
  getLabelEntry,
  isHexColor,
  randomLabelColor,
  stableColor,
  type LabelMappingEntry,
  type SupercategoryEntry,
} from "@/lib/utils/labelMapping";
import {
  dropKeypointEdgeKey,
  renameKeypointEdgeKey,
  type KeypointEdge,
} from "@/lib/project/configVersion";

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

/** Problems that would silently drop or mis-map data if saved. */
export interface LabelMappingIssues {
  duplicateNames: string[];
  duplicateIds: string[];
  duplicateParents: string[];
  /** Rows with a name but no Label ID, or vice versa. */
  incompleteRows: number;
  /** Rows whose Label ID is not a whole number. */
  nonIntegerIds: number;
}

export function hasLabelMappingIssues(issues: LabelMappingIssues): boolean {
  return (
    issues.duplicateNames.length > 0 ||
    issues.duplicateIds.length > 0 ||
    issues.duplicateParents.length > 0 ||
    issues.incompleteRows > 0 ||
    issues.nonIntegerIds > 0
  );
}

const SUPERCATEGORY_COLUMNS = [
  { key: "name", header: "Name" },
  { key: "actions", className: "w-12" },
] as const;

const LABEL_COLUMNS = [
  { key: "category", header: "Category" },
  { key: "id", header: "Label ID", className: "w-28" },
  { key: "parent", header: "Parent" },
  { key: "color", header: "Color", className: "w-40" },
  { key: "actions", className: "w-12" },
] as const;

const INVALID_INPUT_CLASS =
  "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/40";

interface Props {
  value: Record<string, unknown>;
  supercategories?: Record<string, SupercategoryEntry>;
  onChange: (
    labels: Record<string, LabelMappingEntry>,
    supercategories: Record<string, SupercategoryEntry>,
  ) => void;
  /**
   * Current keypoint edge-sets, keyed by schemaKey. When provided, renaming a
   * parent category or changing a Label ID migrates the matching edge-set so
   * the annotator's skeleton is not orphaned. Deleting a parent drops its set.
   */
  keypointEdges?: Record<string, KeypointEdge[]>;
  onKeypointEdgesChange?: (edges: Record<string, KeypointEdge[]>) => void;
  /** Reports validation problems so the page can block a lossy save. */
  onValidityChange?: (issues: LabelMappingIssues) => void;
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
  keypointEdges,
  onKeypointEdgesChange,
  onValidityChange,
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
  const [pendingSuperDelete, setPendingSuperDelete] =
    useState<SupercategoryRow | null>(null);

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

  // Migrate the keypoint edge-set keyed by a schema whose id/name just changed,
  // so previously-drawn skeletons follow the rename instead of orphaning.
  function migrateEdges(
    mutate: (edges: Record<string, KeypointEdge[]>) => Record<string, KeypointEdge[]>,
  ) {
    if (!keypointEdges || !onKeypointEdgesChange) return;
    const next = mutate(keypointEdges);
    if (next !== keypointEdges) onKeypointEdgesChange(next);
  }

  const superNames = superRows.map((row) => row.name.trim()).filter(Boolean);

  const dupLabelNames = useMemo(
    () => duplicateNames(labelRows.map((row) => row.name)),
    [labelRows],
  );
  const dupLabelIds = useMemo(
    () => duplicateIds(labelRows.map((row) => row.value)),
    [labelRows],
  );
  const dupParentNames = useMemo(
    () => duplicateNames(superRows.map((row) => row.name)),
    [superRows],
  );

  const issues = useMemo<LabelMappingIssues>(() => {
    let incompleteRows = 0;
    let nonIntegerIds = 0;
    for (const row of labelRows) {
      const nameFilled = row.name.trim() !== "";
      const idRaw = row.value.trim();
      const idValid = idRaw !== "" && !Number.isNaN(Number(idRaw));
      if (nameFilled !== idValid) incompleteRows += 1;
      if (idRaw !== "" && !Number.isInteger(Number(idRaw))) nonIntegerIds += 1;
    }
    return {
      duplicateNames: [...dupLabelNames],
      duplicateIds: [...dupLabelIds],
      duplicateParents: [...dupParentNames],
      incompleteRows,
      nonIntegerIds,
    };
  }, [labelRows, dupLabelNames, dupLabelIds, dupParentNames]);

  useEffect(() => {
    onValidityChange?.(issues);
  }, [issues, onValidityChange]);

  function doDeleteSupercategory(row: SupercategoryRow) {
    migrateEdges((edges) =>
      dropKeypointEdgeKey(edges, `supercategory:${row.name.trim()}`),
    );
    emit(
      labelRows.map((label) =>
        label.supercategory === row.name
          ? { ...label, supercategory: "" }
          : label,
      ),
      superRows.filter((item) => item.rowId !== row.rowId),
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">Parent categories</p>
            <p className="text-xs text-muted-foreground">
              Optional groups whose child categories share one keypoint template.
              Their point templates are edited in Keypoint setup.
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
              Add parent category
            </Button>
          )}
        </div>
        <SettingsTable
          columns={SUPERCATEGORY_COLUMNS}
          emptyMessage={
            superRows.length === 0 ? "No parent categories." : undefined
          }
        >
          {superRows.map((row) => {
            const isDuplicate =
              row.name.trim() !== "" && dupParentNames.has(row.name.trim());
            return (
              <TableRow key={row.rowId}>
                <TableCell>
                  <Input
                    value={row.name}
                    onChange={(event) => {
                      const nextName = event.target.value;
                      const oldName = row.name;
                      // Only cascade the rename to child labels when the old name
                      // is non-empty. Otherwise naming a freshly-added parent
                      // category would reparent every label with no parent (they
                      // all match the empty string).
                      if (oldName.trim()) {
                        const from = `supercategory:${oldName.trim()}`;
                        const to = nextName.trim();
                        // Clearing the name would synthesize a malformed
                        // "supercategory:" key, so drop the set instead.
                        migrateEdges((edges) =>
                          to
                            ? renameKeypointEdgeKey(
                                edges,
                                from,
                                `supercategory:${to}`,
                              )
                            : dropKeypointEdgeKey(edges, from),
                        );
                      }
                      const nextLabels = oldName.trim()
                        ? labelRows.map((label) =>
                            label.supercategory === oldName
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
                    aria-invalid={isDuplicate}
                    className={isDuplicate ? INVALID_INPUT_CLASS : undefined}
                  />
                </TableCell>
                <TableCell>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => {
                      const hasChildren = labelRows.some(
                        (label) => label.supercategory === row.name,
                      );
                      const hasTemplate = row.keypoints.some((point) =>
                        point.trim(),
                      );
                      if (hasChildren || hasTemplate) {
                        setPendingSuperDelete(row);
                      } else {
                        doDeleteSupercategory(row);
                      }
                    }}
                    disabled={disabled}
                    aria-label={`Remove parent category ${row.name}`}
                  >
                    <Trash2 />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </SettingsTable>
        {dupParentNames.size > 0 && (
          <p className="text-xs text-destructive">
            Parent category names must be unique.
          </p>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">Categories</p>
            <p className="text-xs text-muted-foreground">
              Each category maps a name to a numeric Label ID. Keypoint templates
              are configured in Keypoint setup.
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
              Add category
            </Button>
          )}
        </div>
        <SettingsTable
          columns={LABEL_COLUMNS}
          tableClassName="min-w-[42rem]"
          emptyMessage={labelRows.length === 0 ? "No categories." : undefined}
        >
          {labelRows.map((row) => {
            const trimmedName = row.name.trim();
            const idRaw = row.value.trim();
            const idValid = idRaw !== "" && !Number.isNaN(Number(idRaw));
            const nameDup = trimmedName !== "" && dupLabelNames.has(trimmedName);
            const idDup = idValid && dupLabelIds.has(String(Number(idRaw)));
            const idBad = idRaw !== "" && !Number.isInteger(Number(idRaw));
            const incomplete =
              (trimmedName !== "") !== idValid;
            const nameInvalid = nameDup || (incomplete && trimmedName === "");
            const idInvalid =
              idDup || idBad || (incomplete && !idValid && trimmedName !== "");
            return (
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
                    aria-invalid={nameInvalid}
                    className={nameInvalid ? INVALID_INPUT_CLASS : undefined}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    step={1}
                    value={row.value}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      const oldNum = Number(row.value);
                      const newNum = Number(nextValue);
                      if (
                        row.value.trim() !== "" &&
                        nextValue.trim() !== "" &&
                        Number.isFinite(oldNum) &&
                        Number.isFinite(newNum) &&
                        oldNum !== newNum
                      ) {
                        migrateEdges((edges) =>
                          renameKeypointEdgeKey(
                            edges,
                            `label:${oldNum}`,
                            `label:${newNum}`,
                          ),
                        );
                      }
                      emit(
                        labelRows.map((candidate) =>
                          candidate.rowId === row.rowId
                            ? { ...candidate, value: nextValue }
                            : candidate,
                        ),
                        superRows,
                      );
                    }}
                    disabled={disabled}
                    aria-invalid={idInvalid}
                    className={idInvalid ? INVALID_INPUT_CLASS : undefined}
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
                      aria-label={`${row.name || "Category"} color`}
                    />
                    <Input
                      value={row.color}
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
                      spellCheck={false}
                      placeholder="#2563EB"
                      aria-label={`${row.name || "Category"} color hex`}
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
                    onClick={() => {
                      // Drop this category's own-template edge-set (if any) so
                      // it can't orphan or resurrect onto a reused Label ID.
                      const idNum = Number(row.value);
                      if (row.value.trim() !== "" && Number.isFinite(idNum)) {
                        migrateEdges((edges) =>
                          dropKeypointEdgeKey(edges, `label:${idNum}`),
                        );
                      }
                      emit(
                        labelRows.filter((item) => item.rowId !== row.rowId),
                        superRows,
                      );
                    }}
                    disabled={disabled}
                    aria-label={`Remove category ${row.name}`}
                  >
                    <Trash2 />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </SettingsTable>
        {(issues.duplicateNames.length > 0 ||
          issues.duplicateIds.length > 0 ||
          issues.incompleteRows > 0 ||
          issues.nonIntegerIds > 0) && (
          <div className="flex flex-col gap-1 text-xs text-destructive">
            {issues.duplicateNames.length > 0 && (
              <p>Category names must be unique (they are the saved key).</p>
            )}
            {issues.duplicateIds.length > 0 && (
              <p>Label IDs must be unique — duplicates overwrite each other.</p>
            )}
            {issues.nonIntegerIds > 0 && (
              <p>Label ID must be a whole number.</p>
            )}
            {issues.incompleteRows > 0 && (
              <p>
                Give every category both a name and a Label ID, or remove the
                empty row — incomplete rows are not saved.
              </p>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={pendingSuperDelete !== null}
        title="Remove parent category?"
        message={
          pendingSuperDelete
            ? `${childCountLabel(
                labelRows.filter(
                  (label) => label.supercategory === pendingSuperDelete.name,
                ).length,
              )} will lose the shared keypoint template "${
                pendingSuperDelete.name || "(unnamed)"
              }" and fall back to no template unless they define their own.`
            : ""
        }
        confirmLabel="Remove"
        onConfirm={() => {
          if (pendingSuperDelete) doDeleteSupercategory(pendingSuperDelete);
          setPendingSuperDelete(null);
        }}
        onCancel={() => setPendingSuperDelete(null)}
      />
    </div>
  );
}

function childCountLabel(count: number): string {
  if (count === 0) return "No categories";
  if (count === 1) return "1 category";
  return `${count} categories`;
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
