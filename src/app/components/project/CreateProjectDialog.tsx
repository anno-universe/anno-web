import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { createProject } from "@/api/projects";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { LabelMappingEditor } from "./LabelMappingEditor";
import { AnnotationSettings } from "./AnnotationSettings";
import type {
  LabelMappingConfigV2,
  MetaInfoConfigV2,
} from "@/lib/project/configVersion";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CreateProjectDialog({ open, onClose }: Props) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [metaInfo, setMetaInfo] = useState<MetaInfoConfigV2>({
    version: 2,
  });
  const [labelMapping, setLabelMapping] = useState<LabelMappingConfigV2>({
    version: 2,
    labels: {},
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError("");

    setSubmitting(true);
    try {
      const project = await createProject({
        name: name.trim(),
        description: description.trim() || undefined,
        meta_info: metaInfo,
        label_mapping:
          Object.keys(labelMapping.labels).length > 0 ? labelMapping : undefined,
      });
      onClose();
      navigate(`/projects/${project.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-50 flex max-h-[90vh] w-full max-w-lg flex-col rounded-lg border bg-card shadow-sm">
        <h2 className="shrink-0 border-b px-6 py-4 text-lg font-semibold text-foreground">
          Create Project
        </h2>
        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex-1 space-y-5 overflow-auto px-6 py-4">
            {error && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <label
                htmlFor="pname"
                className="text-sm font-medium text-foreground"
              >
                Name <span className="text-destructive">*</span>
              </label>
              <input
                id="pname"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                required
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="pdesc"
                className="text-sm font-medium text-foreground"
              >
                Description
              </label>
              <textarea
                id="pdesc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                Label mapping
              </p>
              <p className="text-xs text-muted-foreground">
                The classes annotators assign. Stored as name → numeric id.
              </p>
              <LabelMappingEditor
                value={labelMapping.labels}
                onChange={(labels) =>
                  setLabelMapping({ version: 2, labels })
                }
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                Annotation settings
              </p>
              <p className="text-xs text-muted-foreground">
                Configure which tools and options are available to annotators.
              </p>
              <AnnotationSettings value={metaInfo} onChange={setMetaInfo} />
            </div>
          </div>

          <div className="flex shrink-0 justify-end gap-3 border-t px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {submitting ? <LoadingSpinner /> : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
