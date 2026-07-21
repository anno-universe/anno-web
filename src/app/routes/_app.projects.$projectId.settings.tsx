import { useEffect, useRef, useState, type FormEvent } from "react";
import { useParams, useOutletContext, useNavigate } from "react-router";
import { toast } from "sonner";
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
import { LoadingSpinner, Spinner } from "@/components/shared/LoadingSpinner";
import { ErrorAlert } from "@/components/shared/ErrorAlert";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { RoleNotice } from "@/components/shared/RoleNotice";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from "@/components/ui/field";
import {
  upgradeLabelMappingConfig,
  upgradeMetaInfoConfig,
  type LabelMappingConfigV2,
  type MetaInfoConfigV2,
} from "@/lib/project/configVersion";
import { stableStringify } from "@/lib/utils/json";
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

  const isSupervisor = project.my_role?.toLowerCase() === "supervisor";

  // Normalized baselines for change detection: compare the current (already
  // upgraded) config against the upgraded stored value, so config normalization
  // and key order never read as an edit.
  const metaInfoBaseline = stableStringify(
    upgradeMetaInfoConfig(project.meta_info as Record<string, unknown>)
  );
  const labelMappingBaseline = stableStringify(
    upgradeLabelMappingConfig(project.label_mapping as Record<string, unknown>)
  );

  async function handleSave(e: FormEvent) {
    e.preventDefault();
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
    if (stableStringify(metaInfo) !== metaInfoBaseline)
      patch.meta_info = metaInfo;
    if (stableStringify(labelMapping) !== labelMappingBaseline)
      patch.label_mapping = labelMapping;

    const projectChanged = Object.keys(patch).length > 0;

    if (!projectChanged && !tagOpsPending) {
      toast.info("No changes to save.");
      return;
    }

    setSaving(true);
    try {
      const operations: Promise<unknown>[] = [];
      if (projectChanged) {
        operations.push(updateProject(id, patch));
      }

      if (tagOpsPending && tagChanges) {
        operations.push(
          ...tagChanges.creates.map((c) => createTag(id, c)),
          ...tagChanges.updates.map((u) => updateTag(id, u.id, u.patch)),
          ...tagChanges.deletes.map((d) => deleteTag(id, d))
        );
      }

      const results = await Promise.allSettled(operations);
      if (projectChanged) refreshProject();
      if (tagOpsPending) await loadTags();

      const failureCount = results.filter(
        (result) => result.status === "rejected"
      ).length;
      if (failureCount > 0) {
        throw new Error(
          `${failureCount} save operation${failureCount === 1 ? "" : "s"} failed. The latest server state has been reloaded.`
        );
      }
      toast.success("Project settings saved.");
    } catch (err: unknown) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Couldn't save your changes. Please try again."
      );
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

  // Warn before navigating away with unsaved edits. Dirtiness is computed
  // lazily so pending tag changes (collected imperatively via the ref) are
  // included without a reactive TagManager subscription.
  const isDirtyNow = () => {
    if (deleting) return false;
    if (name !== project.name) return true;
    if (description !== (project.description ?? "")) return true;
    if (stableStringify(metaInfo) !== metaInfoBaseline) return true;
    if (stableStringify(labelMapping) !== labelMappingBaseline) return true;
    const tagChanges = tagManagerRef.current?.collectChanges();
    return Boolean(
      tagChanges &&
        (tagChanges.creates.length > 0 ||
          tagChanges.updates.length > 0 ||
          tagChanges.deletes.length > 0)
    );
  };

  const leaveGuard = useUnsavedChangesGuard(isDirtyNow);

  return (
    <div>
      {!isSupervisor && <RoleNotice area="project settings" className="mb-6" />}

      <form onSubmit={handleSave}>
        <FieldGroup className="gap-5">
          {error && <ErrorAlert message={error} />}

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
              {saving ? <Spinner /> : "Save"}
            </Button>
          )}
        </FieldGroup>
      </form>

      {isSupervisor && (
        <Card className="mt-10 border-destructive/30">
          <CardHeader>
            <CardTitle className="text-sm text-destructive">
              Danger Zone
            </CardTitle>
            <CardDescription>
              Once you delete a project, there is no going back. All images,
              annotations, and member data will be permanently removed.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={deleting}
              className="border-destructive/50 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive"
            >
              {deleting ? "Deleting…" : "Delete Project"}
            </Button>
          </CardFooter>
        </Card>
      )}

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete Project"
        message={`Are you sure you want to delete "${project.name}"? This action cannot be undone.`}
        confirmLabel={deleting ? "Deleting…" : "Delete"}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      <ConfirmDialog
        open={leaveGuard.blocked}
        title="Discard unsaved changes?"
        message="You have unsaved changes. If you leave now, they will be lost."
        confirmLabel="Leave"
        onConfirm={leaveGuard.proceed}
        onCancel={leaveGuard.cancel}
      />
    </div>
  );
}
