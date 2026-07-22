import { useMemo, useRef, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { updateProject } from "@/api/projects";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { RoleNotice } from "@/components/shared/RoleNotice";
import { TemplateEditor } from "@/components/project/LabelMappingEditor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PROJECT_CONFIG_VERSION,
  pruneKeypointEdges,
  upgradeLabelMappingConfig,
  upgradeMetaInfoConfig,
  type KeypointEdge,
  type LabelMappingConfigV3,
  type MetaInfoConfigV3,
} from "@/lib/project/configVersion";
import {
  keypointSchemasFromConfig,
  type LabelMappingEntry,
  type ResolvedKeypointSchema,
} from "@/lib/utils/labelMapping";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { stableStringify } from "@/lib/utils/json";
import { queryKeys } from "@/lib/queryKeys";
import type { ProjectOutput } from "@/types/project";
import type { ProjectContext } from "./_app.projects.$projectId";

/** Human-readable heading for a resolved schema (never the raw schemaKey). */
function schemaTitle(schema: ResolvedKeypointSchema): string {
  return schema.supercategory
    ? `Parent category: ${schema.supercategory}`
    : `Category: ${schema.label} - ${schema.name}`;
}

type Step = 1 | 2 | 3;

export default function KeypointConfigurationPage() {
  const { projectId } = useParams();
  const id = Number(projectId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { project, refreshProject } = useOutletContext<ProjectContext>();
  const [step, setStep] = useState<Step>(1);
  const [saving, setSaving] = useState(false);
  const [mapping, setMapping] = useState<LabelMappingConfigV3>(() =>
    upgradeLabelMappingConfig(project.label_mapping as Record<string, unknown>)
  );
  const [metaInfo] = useState<MetaInfoConfigV3>(() =>
    upgradeMetaInfoConfig(project.meta_info as Record<string, unknown>)
  );
  const [edges, setEdges] = useState<Record<string, KeypointEdge[]>>(
    () => metaInfo.keypoint_edges ?? {}
  );
  const initialState = useRef(
    stableStringify({ mapping, edges: metaInfo.keypoint_edges ?? {} })
  );
  const allowLeave = useRef(false);

  const schemas = useMemo(() => keypointSchemasFromConfig(mapping), [mapping]);
  const uniqueSchemas = useMemo(
    () => Array.from(new Map(schemas.map((schema) => [schema.schemaKey, schema])).values()),
    [schemas]
  );
  // Category names sharing each schema, so we can warn that editing a shared
  // template/connections affects every inheriting category.
  const schemaUsage = useMemo(() => {
    const usage = new Map<string, string[]>();
    for (const schema of schemas) {
      const names = usage.get(schema.schemaKey) ?? [];
      names.push(schema.name);
      usage.set(schema.schemaKey, names);
    }
    return usage;
  }, [schemas]);
  const labelsBySupercategory = useMemo(() => {
    const grouped = new Map<string, Array<[string, LabelMappingEntry]>>(
      Object.keys(mapping.supercategories).map((name) => [name, []])
    );
    Object.entries(mapping.labels).forEach(([labelName, entry]) => {
      if (entry.supercategory && grouped.has(entry.supercategory)) {
        grouped.get(entry.supercategory)!.push([labelName, entry]);
      }
    });
    grouped.forEach((labels) =>
      labels.sort(([nameA, entryA], [nameB, entryB]) =>
        entryA.id - entryB.id || nameA.localeCompare(nameB)
      )
    );
    return grouped;
  }, [mapping.labels, mapping.supercategories]);
  const validSchemaCount = uniqueSchemas.filter((schema) => schema.keypoints.length > 0).length;
  const templateErrors = useMemo(() => {
    const errors: string[] = [];
    const validate = (title: string, points: string[]) => {
      if (points.length === 0) return;
      const normalized = points.map((point) => point.trim());
      if (normalized.some((point) => !point)) errors.push(`${title} contains an empty point name.`);
      if (new Set(normalized).size !== normalized.length) errors.push(`${title} contains duplicate point names.`);
    };
    Object.entries(mapping.supercategories).forEach(([name, entry]) =>
      validate(`Parent category "${name}"`, entry.keypoints ?? [])
    );
    Object.entries(mapping.labels).forEach(([name, entry]) => {
      if (!entry.supercategory || entry.keypoints?.length) {
        validate(`Category "${name}"`, entry.keypoints ?? []);
      }
    });
    return errors;
  }, [mapping]);
  const edgeErrors = useMemo(() => {
    const errors: string[] = [];
    uniqueSchemas.forEach((schema) => {
      const seen = new Set<string>();
      for (const [from, to] of edges[schema.schemaKey] ?? []) {
        const key = [from, to].sort().join("\u0000");
        if (!schema.keypoints.includes(from) || !schema.keypoints.includes(to)) {
          errors.push(`${schemaTitle(schema)} has a connection whose point no longer exists.`);
        } else if (from === to) {
          errors.push(`${schemaTitle(schema)} has a point connected to itself.`);
        } else if (seen.has(key)) {
          errors.push(`${schemaTitle(schema)} has a duplicate connection.`);
        }
        seen.add(key);
      }
    });
    return errors;
  }, [edges, uniqueSchemas]);
  const leaveGuard = useUnsavedChangesGuard(
    () => !allowLeave.current && stableStringify({ mapping, edges }) !== initialState.current
  );
  const isSupervisor = project.my_role?.toLowerCase() === "supervisor";

  function updateSupercategory(name: string, keypoints: string[]) {
    setMapping((current) => ({
      ...current,
      supercategories: {
        ...current.supercategories,
        [name]: { keypoints },
      },
    }));
  }

  function updateLabel(labelName: string, keypoints: string[]) {
    setMapping((current) => ({
      ...current,
      labels: {
        ...current.labels,
        [labelName]: { ...current.labels[labelName], keypoints },
      },
    }));
  }

  function useInheritedLabelTemplate(labelName: string) {
    setMapping((current) => {
      const entry = current.labels[labelName];
      const { keypoints: _keypoints, ...inheritedEntry } = entry;
      return {
        ...current,
        labels: {
          ...current.labels,
          [labelName]: inheritedEntry,
        },
      };
    });
  }

  async function save() {
    if (validSchemaCount === 0 || templateErrors.length > 0) {
      toast.error("Configure at least one keypoint template before enabling the tool.");
      setStep(1);
      return;
    }
    if (edgeErrors.length > 0) {
      toast.error("Fix invalid connection rules before saving.");
      setStep(2);
      return;
    }
    const normalizedMapping: LabelMappingConfigV3 = {
      ...mapping,
      labels: Object.fromEntries(
        Object.entries(mapping.labels).map(([name, entry]) => [
          name,
          entry.keypoints
            ? { ...entry, keypoints: entry.keypoints.map((point) => point.trim()).filter(Boolean) }
            : entry,
        ])
      ),
      supercategories: Object.fromEntries(
        Object.entries(mapping.supercategories).map(([name, entry]) => [
          name,
          { ...entry, keypoints: (entry.keypoints ?? []).map((point) => point.trim()).filter(Boolean) },
        ])
      ),
    };
    setSaving(true);
    try {
      // Drop edge-sets whose schema no longer exists so orphaned keys don't
      // persist (and can't wrongly resurrect if an old schemaKey reappears).
      const validKeys = new Set(uniqueSchemas.map((schema) => schema.schemaKey));
      const { edges: prunedEdges } = pruneKeypointEdges(edges, validKeys);
      const updated = await updateProject(id, {
        label_mapping: normalizedMapping,
        meta_info: {
          ...metaInfo,
          version: PROJECT_CONFIG_VERSION,
          keypoint_enabled: true,
          keypoint_edges: prunedEdges,
        },
      });
      // Write the fresh project into the detail cache BEFORE navigating, so the
      // settings page remounts with keypoint_enabled=true instead of the stale
      // 15s cache (otherwise it shows the toggle off + a spurious "unsaved
      // changes" whose Save would revert the enable).
      queryClient.setQueryData<ProjectOutput>(
        queryKeys.projects.detail(id),
        (old) => (old ? { ...old, ...updated } : updated),
      );
      refreshProject();
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.lists() });
      toast.success("Keypoint annotation enabled.");
      allowLeave.current = true;
      navigate(`/projects/${id}/settings`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save keypoint configuration");
    } finally {
      setSaving(false);
    }
  }

  if (!isSupervisor) {
    return (
      <div className="flex flex-col gap-4">
        <RoleNotice area="keypoint configuration" />
        <Button type="button" variant="outline" className="w-fit" onClick={() => navigate(`/projects/${id}/settings`)}>
          <ArrowLeft data-icon="inline-start" /> Back to settings
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold">Keypoint configuration</h2>
        <p className="text-sm text-muted-foreground">
          Define each category's point template and how the points connect. The
          tool turns on once setup is saved.
        </p>
      </div>
      <Progress value={(step / 3) * 100} />

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>1. Keypoint templates</CardTitle>
            <CardDescription>
              A template is the ordered list of points annotators place for a
              category. Categories inherit their parent category's template by
              default — give a category its own only when it needs different points.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {Object.entries(mapping.supercategories).map(([name, entry]) => (
              <SupercategorySchemaEditor
                key={`super-${name}`}
                name={name}
                keypoints={entry.keypoints ?? []}
                labels={labelsBySupercategory.get(name) ?? []}
                onSupercategoryChange={(keypoints) => updateSupercategory(name, keypoints)}
                onLabelChange={updateLabel}
                onUseInherited={useInheritedLabelTemplate}
              />
            ))}
            {Object.entries(mapping.labels)
              .filter(([, entry]) => !entry.supercategory)
              .map(([name, entry]) => (
                <div key={`label-${entry.id}`} className="flex flex-col gap-2">
                  <p className="font-medium">Category: {entry.id} - {name}</p>
                  <TemplateEditor
                    keypoints={entry.keypoints ?? []}
                    onChange={(keypoints) => updateLabel(name, keypoints)}
                  />
                </div>
              ))}
            {Object.keys(mapping.labels).length === 0 && (
              <p className="text-sm text-muted-foreground">
                Add categories on the Settings page before configuring keypoints.
              </p>
            )}
            {templateErrors.map((error) => (
              <p key={error} className="text-sm text-destructive">{error}</p>
            ))}
          </CardContent>
          <CardFooter className="justify-between">
            <Button type="button" variant="outline" onClick={() => navigate(`/projects/${id}/settings`)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => setStep(2)} disabled={validSchemaCount === 0 || templateErrors.length > 0}>
              Connections <ArrowRight data-icon="inline-end" />
            </Button>
          </CardFooter>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>2. Connections</CardTitle>
            <CardDescription>
              Connect points into a skeleton for annotators. Connections only
              affect how keypoints are drawn; a point marked absent hides its
              lines automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {uniqueSchemas.map((schema) => {
              const sharedWith = schemaUsage.get(schema.schemaKey) ?? [];
              return (
                <EdgeEditor
                  key={schema.schemaKey}
                  title={schemaTitle(schema)}
                  subtitle={
                    schema.supercategory && sharedWith.length > 1
                      ? `Shared by ${sharedWith.length} categories (${sharedWith.join(", ")}) — changes apply to all.`
                      : undefined
                  }
                  keypoints={schema.keypoints}
                  edges={edges[schema.schemaKey] ?? []}
                  onChange={(next) => setEdges((current) => ({ ...current, [schema.schemaKey]: next }))}
                />
              );
            })}
            {edgeErrors.map((error) => (
              <p key={error} className="text-sm text-destructive">{error}</p>
            ))}
          </CardContent>
          <CardFooter className="justify-between">
            <Button type="button" variant="outline" onClick={() => setStep(1)}>
              <ArrowLeft data-icon="inline-start" /> Templates
            </Button>
            <Button type="button" onClick={() => setStep(3)} disabled={edgeErrors.length > 0}>
              Review <ArrowRight data-icon="inline-end" />
            </Button>
          </CardFooter>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>3. Review and enable</CardTitle>
            <CardDescription>
              Review the templates and connections that will apply to this
              project, then enable keypoint annotation.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {uniqueSchemas.map((schema) => {
              const sharedWith = schemaUsage.get(schema.schemaKey) ?? [];
              return (
                <div key={schema.schemaKey} className="rounded-md border p-3">
                  <p className="font-medium">{schemaTitle(schema)}</p>
                  <p className="text-sm text-muted-foreground">
                    {schema.keypoints.length} points ·{" "}
                    {(edges[schema.schemaKey] ?? []).length} connections
                    {schema.supercategory && sharedWith.length > 1
                      ? ` · shared by ${sharedWith.length} categories`
                      : ""}
                  </p>
                </div>
              );
            })}
          </CardContent>
          <CardFooter className="justify-between">
            <Button type="button" variant="outline" onClick={() => setStep(2)} disabled={saving}>
              <ArrowLeft data-icon="inline-start" /> Connections
            </Button>
            <Button type="button" onClick={save} disabled={saving}>
              <Check data-icon="inline-start" />
              {saving ? "Saving…" : "Save and enable"}
            </Button>
          </CardFooter>
        </Card>
      )}
      <ConfirmDialog
        open={leaveGuard.blocked}
        title="Discard keypoint configuration?"
        message="The template and connection changes on this page have not been saved."
        confirmLabel="Discard"
        onConfirm={leaveGuard.proceed}
        onCancel={leaveGuard.cancel}
      />
    </div>
  );
}

function SupercategorySchemaEditor({
  name,
  keypoints,
  labels,
  onSupercategoryChange,
  onLabelChange,
  onUseInherited,
}: {
  name: string;
  keypoints: string[];
  labels: Array<[string, LabelMappingEntry]>;
  onSupercategoryChange: (keypoints: string[]) => void;
  onLabelChange: (labelName: string, keypoints: string[]) => void;
  onUseInherited: (labelName: string) => void;
}) {
  const [expandedLabel, setExpandedLabel] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const customCount = labels.filter(
    ([, entry]) => (entry.keypoints?.length ?? 0) > 0,
  ).length;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-md border">
      <CollapsibleTrigger asChild>
        <button className="flex w-full items-center gap-3 p-4 text-left hover:bg-muted/50 transition-colors">
          <ChevronDown
            className="size-4 shrink-0 text-muted-foreground transition-transform"
            style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}
          />
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <span className="truncate font-medium">Parent: {name}</span>
            <Badge variant="outline" className="text-xs">
              {keypoints.length} {keypoints.length === 1 ? "point" : "points"}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {labels.length} {labels.length === 1 ? "category" : "categories"}
            </Badge>
            {customCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {customCount} custom
              </Badge>
            )}
          </div>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="flex flex-col gap-4 px-4 pb-4">
          <TemplateEditor
            keypoints={keypoints}
            onChange={onSupercategoryChange}
          />

          <Separator />

          <div className="flex flex-col gap-2">
            <div>
              <p className="text-sm font-medium">Categories</p>
              <p className="text-xs text-muted-foreground">
                Each category inherits the template above until you give it its own.
              </p>
            </div>

            {labels.map(([labelName, entry]) => {
              const hasOverride = (entry.keypoints?.length ?? 0) > 0;
              const effectiveKeypoints = hasOverride ? entry.keypoints! : keypoints;
              const isOpen = expandedLabel === labelName;

              return (
                <Collapsible
                  key={entry.id}
                  open={isOpen}
                  onOpenChange={(open) => setExpandedLabel(open ? labelName : null)}
                  className="rounded-md border"
                >
                  <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="size-3 shrink-0 rounded-full border"
                        style={{ backgroundColor: entry.color }}
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {entry.id} - {labelName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {effectiveKeypoints.length} {effectiveKeypoints.length === 1 ? "point" : "points"}
                        </p>
                      </div>
                    </div>
                    <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
                      <Badge variant={hasOverride ? "secondary" : "outline"}>
                        {hasOverride ? "Custom template" : "Inherited"}
                      </Badge>
                      {hasOverride && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            onUseInherited(labelName);
                            setExpandedLabel(null);
                          }}
                        >
                          <RotateCcw data-icon="inline-start" />
                          Use inherited
                        </Button>
                      )}
                      <CollapsibleTrigger asChild>
                        <Button type="button" variant="outline" size="sm">
                          <Pencil data-icon="inline-start" />
                          {isOpen ? "Close" : hasOverride ? "Edit" : "Configure"}
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                  </div>
                  <CollapsibleContent>
                    <div className="px-3 pb-3">
                      <TemplateEditor
                        keypoints={effectiveKeypoints}
                        onChange={(nextKeypoints) => onLabelChange(labelName, nextKeypoints)}
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}

            {labels.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No categories use this parent category.
              </p>
            )}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function EdgeEditor({
  title,
  subtitle,
  keypoints,
  edges,
  onChange,
}: {
  title: string;
  subtitle?: string;
  keypoints: string[];
  edges: KeypointEdge[];
  onChange: (edges: KeypointEdge[]) => void;
}) {
  const addEdge = () => {
    for (let from = 0; from < keypoints.length; from += 1) {
      for (let to = from + 1; to < keypoints.length; to += 1) {
        const exists = edges.some(
          ([a, b]) =>
            (a === keypoints[from] && b === keypoints[to]) ||
            (a === keypoints[to] && b === keypoints[from])
        );
        if (!exists) {
          onChange([...edges, [keypoints[from], keypoints[to]]]);
          return;
        }
      }
    }
  };
  const maxEdges = (keypoints.length * (keypoints.length - 1)) / 2;
  return (
    <div className="grid gap-4 rounded-md border p-4 md:grid-cols-2">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium">{title}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addEdge}
            disabled={keypoints.length < 2 || edges.length >= maxEdges}
          >
            <Plus data-icon="inline-start" /> Add connection
          </Button>
        </div>
        {edges.map((edge, index) => (
          <div key={`edge-${index}`} className="flex items-center gap-2">
            <PointSelect
              value={edge[0]}
              keypoints={keypoints}
              onChange={(from) => onChange(edges.map((item, i) => i === index ? [from, item[1]] : item))}
            />
            <span className="text-muted-foreground">→</span>
            <PointSelect
              value={edge[1]}
              keypoints={keypoints}
              onChange={(to) => onChange(edges.map((item, i) => i === index ? [item[0], to] : item))}
            />
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => onChange(edges.filter((_, i) => i !== index))} aria-label={`Remove connection ${index + 1}`}>
              <Trash2 />
            </Button>
          </div>
        ))}
        {edges.length === 0 && <p className="text-sm text-muted-foreground">No connections yet.</p>}
      </div>
      <EdgePreview keypoints={keypoints} edges={edges} />
    </div>
  );
}

function PointSelect({ value, keypoints, onChange }: { value: string; keypoints: string[]; onChange: (value: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="min-w-0 flex-1"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {keypoints.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

function EdgePreview({ keypoints, edges }: { keypoints: string[]; edges: KeypointEdge[] }) {
  const positions = new Map(
    keypoints.map((name, index) => {
      const angle = (Math.PI * 2 * index) / Math.max(keypoints.length, 1) - Math.PI / 2;
      return [name, { x: 160 + Math.cos(angle) * 105, y: 120 + Math.sin(angle) * 80 }] as const;
    })
  );
  return (
    <svg viewBox="0 0 320 240" className="h-60 w-full rounded-md bg-muted/40" role="img" aria-label="Keypoint connection preview">
      {edges.map(([from, to], index) => {
        const a = positions.get(from);
        const b = positions.get(to);
        return a && b ? <line key={`${from}-${to}-${index}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="stroke-primary" strokeWidth="2" /> : null;
      })}
      {keypoints.map((name, index) => {
        const point = positions.get(name)!;
        return (
          <g key={`${name}-${index}`}>
            <circle cx={point.x} cy={point.y} r="7" className="fill-primary stroke-background" strokeWidth="2" />
            <text x={point.x} y={point.y - 12} textAnchor="middle" className="fill-foreground text-[10px]">{name}</text>
          </g>
        );
      })}
    </svg>
  );
}
