import { useEffect, useRef, useState, type FormEvent } from "react";
import { useParams, useOutletContext, useNavigate } from "react-router";
import { updateProject, deleteProject } from "@/api/projects";
import {
  getProjectTags,
  createTag,
  updateTag,
  deleteTag,
} from "@/api/tags";
import { LabelMappingEditor } from "@/components/project/LabelMappingEditor";
import { AnnotationSettings } from "@/components/project/AnnotationSettings";
import {
  TagManager,
  type TagManagerHandle,
} from "@/components/project/TagManager";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { ErrorAlert } from "@/components/shared/ErrorAlert";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from "@/components/ui/field";
import {
  needsProjectConfigUpgrade,
  upgradeLabelMappingConfig,
  upgradeMetaInfoConfig,
  type LabelMappingConfigV2,
  type MetaInfoConfigV2,
} from "@/lib/project/configVersion";
import type { ProjectUpdateInput } from "@/types/project";
import type { TagOutput } from "@/types/tag";
import type { ProjectContext } from "./_app.projects.$projectId";

export default function ProjectSettingsPage() {
  const { projectId } = useParams();
  const id = Number(projectId);
  const navigate = useNavigate();
  const { project, refreshProject } = useOutletContext<ProjectContext>();

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Form state — initialized from context project
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [metaInfo, setMetaInfo] = useState<MetaInfoConfigV2>(
    upgradeMetaInfoConfig(project.meta_info as Record<string, unknown>)
  );
  const [labelMapping, setLabelMapping] = useState<LabelMappingConfigV2>(
    upgradeLabelMappingConfig(project.label_mapping as Record<string, unknown>)
  );

  // Tag state — fetched separately (tags are independent REST resources)
  const tagManagerRef = useRef<TagManagerHandle>(null);
  const [projectTags, setProjectTags] = useState<TagOutput[]>([]);
  const [loadingTags, setLoadingTags] = useState(true);

  async function loadTags() {
    try {
      const resp = await getProjectTags(id, { limit: 500 });
      setProjectTags(resp.items);
    } catch {
      // non-blocking
    } finally {
      setLoadingTags(false);
    }
  }

  useEffect(() => {
    loadTags();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

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

    const tagChanges = tagManagerRef.current?.collectChanges();
    const tagOpsPending =
      tagChanges &&
      (tagChanges.creates.length > 0 ||
        tagChanges.updates.length > 0 ||
        tagChanges.deletes.length > 0);

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

    const projectChanged = Object.keys(patch).length > 0;

    if (!projectChanged && !tagOpsPending) {
      setSuccessMsg("No changes to save.");
      return;
    }

    setSaving(true);
    try {
      // Save project fields (if changed)
      if (projectChanged) {
        await updateProject(id, patch);
        refreshProject();
      }

      // Save tags (creates / updates / deletes)
      if (tagOpsPending && tagChanges) {
        await Promise.all([
          ...tagChanges.creates.map((c) => createTag(id, c)),
          ...tagChanges.updates.map((u) => updateTag(id, u.id, u.patch)),
          ...tagChanges.deletes.map((d) => deleteTag(id, d)),
        ]);
        loadTags();
      }

      setSuccessMsg("Saved.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteProject(id);
      navigate("/projects", { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete project");
      setShowDeleteConfirm(false);
    } finally {
      setDeleting(false);
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

      <form onSubmit={handleSave}>
        <FieldGroup className="gap-5">
          {error && <ErrorAlert message={error} />}
          {successMsg && (
            <Alert>
              <AlertDescription>{successMsg}</AlertDescription>
            </Alert>
          )}

          <Field>
            <FieldLabel htmlFor="sname">Name</FieldLabel>
            <Input
              id="sname"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!isSupervisor}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="sdesc">Description</FieldLabel>
            <Textarea
              id="sdesc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!isSupervisor}
              rows={2}
            />
          </Field>

          <Field>
            <FieldLabel>Label mapping</FieldLabel>
            <FieldDescription>
              The classes annotators assign. Stored as name → numeric id.
            </FieldDescription>
            <LabelMappingEditor
              key={`labels-${project.id}`}
              value={labelMapping.labels}
              onChange={(labels) =>
                setLabelMapping({ version: 2, labels })
              }
              disabled={!isSupervisor}
            />
          </Field>

          <Field>
            <FieldLabel>Annotation settings</FieldLabel>
            <FieldDescription>
              Configure which tools and options are available to annotators.
            </FieldDescription>
            <AnnotationSettings
              key={`ann-settings-${project.id}`}
              value={metaInfo}
              onChange={setMetaInfo}
              disabled={!isSupervisor}
            />
          </Field>

          <Field>
            <FieldLabel>Tags</FieldLabel>
            <FieldDescription>
              Define tags that can be applied to images to track annotation
              progress.
            </FieldDescription>
            {loadingTags ? (
              <LoadingSpinner />
            ) : (
              <TagManager
                ref={tagManagerRef}
                tags={projectTags}
                disabled={!isSupervisor}
              />
            )}
          </Field>

          {isSupervisor && (
            <Button type="submit" disabled={saving} className="w-fit">
              {saving ? <LoadingSpinner /> : "Save"}
            </Button>
          )}
        </FieldGroup>
      </form>

      {isSupervisor && (
        <div className="mt-10 rounded-md border border-destructive/30 p-4">
          <h3 className="text-sm font-semibold text-destructive">
            Danger Zone
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Once you delete a project, there is no going back. All images,
            annotations, and member data will be permanently removed.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={deleting}
            className="mt-3 border-destructive/50 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive"
          >
            {deleting ? "Deleting…" : "Delete Project"}
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete Project"
        message={`Are you sure you want to delete "${project.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
