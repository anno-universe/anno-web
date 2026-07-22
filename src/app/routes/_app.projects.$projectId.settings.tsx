import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useParams, useOutletContext, useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { updateProject, deleteProject } from "@/api/projects";
import { getProjectTags, createTag, updateTag, deleteTag } from "@/api/tags";
import {
  LabelMappingEditor,
  hasLabelMappingIssues,
  type LabelMappingIssues,
} from "@/components/project/LabelMappingEditor";
import { AnnotationSettings } from "@/components/project/AnnotationSettings";
import {
  TagManager,
  type TagManagerHandle,
} from "@/components/project/TagManager";
import { SettingsSection } from "@/components/project/SettingsSection";
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  pruneKeypointEdges,
  upgradeLabelMappingConfig,
  upgradeMetaInfoConfig,
  type LabelMappingConfigV2,
  type MetaInfoConfigV2,
} from "@/lib/project/configVersion";
import { keypointSchemasFromConfig } from "@/lib/utils/labelMapping";
import { stableStringify } from "@/lib/utils/json";
import { queryKeys } from "@/lib/queryKeys";
import type { ProjectOutput, ProjectUpdateInput } from "@/types/project";
import type { TagOutput } from "@/types/tag";
import type { ProjectContext } from "./_app.projects.$projectId";

export default function ProjectSettingsPage() {
  const { projectId } = useParams();
  const id = Number(projectId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { project, refreshProject } = useOutletContext<ProjectContext>();

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Form state — initialized from context project
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [metaInfo, setMetaInfo] = useState<MetaInfoConfigV2>(
    upgradeMetaInfoConfig(project.meta_info as Record<string, unknown>),
  );
  const [labelMapping, setLabelMapping] = useState<LabelMappingConfigV2>(
    upgradeLabelMappingConfig(project.label_mapping as Record<string, unknown>),
  );

  // Tag state — fetched separately (tags are independent REST resources)
  const tagManagerRef = useRef<TagManagerHandle>(null);
  const [projectTags, setProjectTags] = useState<TagOutput[]>([]);
  const [loadingTags, setLoadingTags] = useState(true);
  const [tagsDirty, setTagsDirty] = useState(false);

  // Category-editor validity. A lossy save (duplicate names/ids, incomplete or
  // non-integer rows) silently drops or overwrites data, so we block it.
  const [labelIssues, setLabelIssues] = useState<LabelMappingIssues | null>(
    null,
  );
  const handleLabelValidity = useCallback(
    (issues: LabelMappingIssues) => setLabelIssues(issues),
    [],
  );
  const labelBlocking = labelIssues ? hasLabelMappingIssues(labelIssues) : false;

  // Set right before a programmatic save-then-navigate so the unsaved-changes
  // guard doesn't fire on our own intentional navigation to the keypoint wizard.
  const bypassGuard = useRef(false);

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
    upgradeMetaInfoConfig(project.meta_info as Record<string, unknown>),
  );
  const labelMappingBaseline = stableStringify(
    upgradeLabelMappingConfig(project.label_mapping as Record<string, unknown>),
  );
  const projectDirty =
    name !== project.name ||
    description !== (project.description ?? "") ||
    stableStringify(metaInfo) !== metaInfoBaseline ||
    stableStringify(labelMapping) !== labelMappingBaseline;
  const isDirty = projectDirty || tagsDirty;

  // Core save routine, shared by the form submit and the save-before-setup flow.
  // Returns whether the project now reflects the local edits (true also when
  // there was nothing to save), so callers can safely navigate afterwards.
  async function saveChanges(): Promise<boolean> {
    setError("");

    if (labelBlocking) {
      toast.error("Fix the highlighted category problems before saving.");
      return false;
    }

    const tagChanges = tagManagerRef.current?.collectChanges();
    const tagOpsPending =
      tagChanges &&
      (tagChanges.creates.length > 0 ||
        tagChanges.updates.length > 0 ||
        tagChanges.deletes.length > 0);

    // Drop keypoint edge-sets whose schema no longer exists (a re-keyed or
    // deleted category), mirroring the wizard's prune, so stale connections
    // can't persist or resurrect onto a reused Label ID.
    const validSchemaKeys = new Set(
      keypointSchemasFromConfig(labelMapping).map((schema) => schema.schemaKey),
    );
    const currentEdges = metaInfo.keypoint_edges ?? {};
    const { edges: prunedEdges } = pruneKeypointEdges(
      currentEdges,
      validSchemaKeys,
    );
    const effectiveMeta =
      stableStringify(prunedEdges) !== stableStringify(currentEdges)
        ? { ...metaInfo, keypoint_edges: prunedEdges }
        : metaInfo;
    if (effectiveMeta !== metaInfo) setMetaInfo(effectiveMeta);

    const patch: ProjectUpdateInput = {};
    if (name !== project.name) patch.name = name;
    if (description !== (project.description ?? ""))
      patch.description = description || null;
    if (stableStringify(effectiveMeta) !== metaInfoBaseline)
      patch.meta_info = effectiveMeta;
    if (stableStringify(labelMapping) !== labelMappingBaseline)
      patch.label_mapping = labelMapping;

    const projectChanged = Object.keys(patch).length > 0;

    if (!projectChanged && !tagOpsPending) {
      toast.info("No changes to save.");
      return true;
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
          ...tagChanges.deletes.map((d) => deleteTag(id, d)),
        );
      }

      const results = await Promise.allSettled(operations);
      if (projectChanged) {
        // Write the fresh project into the detail cache synchronously so any
        // immediate remount/navigation reads the saved state, not the stale
        // 15s cache — otherwise a follow-up render can look "unsaved" and a
        // stray save would revert it.
        const projectResult = results[0];
        if (projectResult.status === "fulfilled") {
          queryClient.setQueryData<ProjectOutput>(
            queryKeys.projects.detail(id),
            (old) =>
              old
                ? { ...old, ...(projectResult.value as ProjectOutput) }
                : (projectResult.value as ProjectOutput),
          );
        }
        refreshProject();
        // name / updated_at are shown in the cached /projects list.
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.lists() });
      }
      if (tagOpsPending) {
        await loadTags();
        // The images page reads active tags via React Query for its filter chips.
        queryClient.invalidateQueries({ queryKey: queryKeys.images.tags(id) });
      }

      const failureCount = results.filter(
        (result) => result.status === "rejected",
      ).length;
      if (failureCount > 0) {
        throw new Error(
          `${failureCount} save operation${failureCount === 1 ? "" : "s"} failed. The latest server state has been reloaded.`,
        );
      }
      toast.success("Project settings saved.");
      return true;
    } catch (err: unknown) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Couldn't save your changes. Please try again.",
      );
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    await saveChanges();
  }

  // The keypoint wizard reads the SAVED project config, so unsaved category
  // edits would be invisible there (and the leave-guard would force a discard).
  // Persist first, then navigate — bypassing our own guard for this hop.
  async function handleConfigureKeypoints() {
    if (labelBlocking) {
      toast.error(
        "Fix the highlighted category problems before configuring keypoints.",
      );
      return;
    }
    if (isDirtyNow()) {
      const ok = await saveChanges();
      if (!ok) return;
    }
    bypassGuard.current = true;
    navigate(`/projects/${id}/keypoints`);
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteProject(id);
      // Drop the deleted project from the list and detail caches.
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.lists() });
      queryClient.removeQueries({ queryKey: queryKeys.projects.detail(id) });
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
    if (bypassGuard.current) return false;
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
        tagChanges.deletes.length > 0),
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

          <SettingsSection
            title="Label mapping"
            description="The categories annotators can assign. Each maps a name to a numeric Label ID used in exports and the API."
          >
            <LabelMappingEditor
              key={`labels-${project.id}`}
              value={labelMapping.labels}
              supercategories={labelMapping.supercategories}
              keypointEdges={metaInfo.keypoint_edges}
              onKeypointEdgesChange={(edges) =>
                setMetaInfo((prev) => ({ ...prev, keypoint_edges: edges }))
              }
              onChange={(labels, supercategories) =>
                setLabelMapping({ version: 3, labels, supercategories })
              }
              onValidityChange={handleLabelValidity}
              disabled={!isSupervisor}
            />
          </SettingsSection>

          <SettingsSection
            title="Annotation settings"
            description="Configure which tools and options are available to annotators."
          >
            <AnnotationSettings
              key={`ann-settings-${project.id}`}
              value={metaInfo}
              onChange={setMetaInfo}
              onConfigureKeypoints={handleConfigureKeypoints}
              disabled={!isSupervisor}
            />
          </SettingsSection>

          <SettingsSection
            title="Tags"
            description={
              <>
                Define tags that can be applied to images to track annotation
                progress.
              </>
            }
          >
            {loadingTags ? (
              <LoadingSpinner />
            ) : (
              <TagManager
                ref={tagManagerRef}
                tags={projectTags}
                disabled={!isSupervisor}
                onDirtyChange={setTagsDirty}
              />
            )}
          </SettingsSection>

          {isSupervisor && (
            <div className="flex items-center justify-between gap-3">
              <p
                className={`text-sm ${labelBlocking ? "text-destructive" : "text-muted-foreground"}`}
                aria-live="polite"
              >
                {labelBlocking
                  ? "Fix the highlighted category problems to save."
                  : isDirty
                    ? "You have unsaved changes."
                    : "No unsaved changes."}
              </p>
              <Button
                type="submit"
                disabled={saving || !isDirty || labelBlocking}
              >
                {saving ? (
                  <>
                    <Spinner />
                    Saving…
                  </>
                ) : (
                  "Save changes"
                )}
              </Button>
            </div>
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
