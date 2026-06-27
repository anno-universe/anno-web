import { useEffect, useState, type FormEvent } from "react";
import { useParams, useOutletContext } from "react-router";
import { updateProject } from "@/api/projects";
import { LabelMappingEditor } from "@/components/project/LabelMappingEditor";
import { AnnotationSettings } from "@/components/project/AnnotationSettings";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { ErrorAlert } from "@/components/shared/ErrorAlert";
import {
  needsProjectConfigUpgrade,
  upgradeLabelMappingConfig,
  upgradeMetaInfoConfig,
  type LabelMappingConfigV2,
  type MetaInfoConfigV2,
} from "@/lib/project/configVersion";
import type { ProjectUpdateInput } from "@/types/project";
import type { ProjectContext } from "./_app.projects.$projectId";

export default function ProjectSettingsPage() {
  const { projectId } = useParams();
  const id = Number(projectId);
  const { project, refreshProject } = useOutletContext<ProjectContext>();

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  // Form state — initialized from context project
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [metaInfo, setMetaInfo] = useState<MetaInfoConfigV2>(
    upgradeMetaInfoConfig(project.meta_info as Record<string, unknown>)
  );
  const [labelMapping, setLabelMapping] = useState<LabelMappingConfigV2>(
    upgradeLabelMappingConfig(project.label_mapping as Record<string, unknown>)
  );

  // Auto-upgrade legacy config on mount
  useEffect(() => {
    if (
      needsProjectConfigUpgrade(project.meta_info as Record<string, unknown>) ||
      needsProjectConfigUpgrade(project.label_mapping as Record<string, unknown>)
    ) {
      const upgradedPatch = {
        meta_info: upgradeMetaInfoConfig(
          project.meta_info as Record<string, unknown>
        ),
        label_mapping: upgradeLabelMappingConfig(
          project.label_mapping as Record<string, unknown>
        ),
      };
      updateProject(id, upgradedPatch).then(() => {
        refreshProject();
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isSupervisor = project.my_role?.toLowerCase() === "supervisor";

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSuccessMsg("");
    setError("");

    const patch: ProjectUpdateInput = {};
    if (name !== project.name) patch.name = name;
    if (description !== (project.description ?? ""))
      patch.description = description || null;
    if (
      JSON.stringify(metaInfo) !== JSON.stringify(project.meta_info ?? {})
    )
      patch.meta_info = metaInfo;
    if (
      JSON.stringify(labelMapping) !==
      JSON.stringify(project.label_mapping ?? {})
    )
      patch.label_mapping = labelMapping;

    if (Object.keys(patch).length === 0) {
      setSuccessMsg("No changes to save.");
      return;
    }

    setSaving(true);
    try {
      await updateProject(id, patch);
      refreshProject();
      setSuccessMsg("Saved.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {!isSupervisor && (
        <div className="mb-6 rounded-md border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          Your role is worker. Settings are read-only. You can only annotate
          images.
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-5">
        {error && <ErrorAlert message={error} />}
        {successMsg && (
          <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            {successMsg}
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="sname" className="text-sm font-medium text-foreground">
            Name
          </label>
          <input
            id="sname"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!isSupervisor}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="sdesc" className="text-sm font-medium text-foreground">
            Description
          </label>
          <textarea
            id="sdesc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={!isSupervisor}
            rows={2}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Label mapping</p>
          <p className="text-xs text-muted-foreground">
            The classes annotators assign. Stored as name → numeric id.
          </p>
          <LabelMappingEditor
            key={`labels-${project.id}`}
            value={labelMapping.labels}
            onChange={(labels) =>
              setLabelMapping({ version: 2, labels })
            }
            disabled={!isSupervisor}
          />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">
            Annotation settings
          </p>
          <p className="text-xs text-muted-foreground">
            Configure which tools and options are available to annotators.
          </p>
          <AnnotationSettings
            key={`ann-settings-${project.id}`}
            value={metaInfo}
            onChange={setMetaInfo}
            disabled={!isSupervisor}
          />
        </div>

        {isSupervisor && (
          <button
            type="submit"
            disabled={saving}
            className="flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? <LoadingSpinner /> : "Save"}
          </button>
        )}
      </form>
    </div>
  );
}
