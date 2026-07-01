import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { createProject } from "@/api/projects";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle>Create Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <FieldGroup className="flex-1 gap-5 overflow-auto px-6 py-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Field>
              <FieldLabel htmlFor="pname">
                Name <span className="text-destructive">*</span>
              </FieldLabel>
              <Input
                id="pname"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="pdesc">Description</FieldLabel>
              <Textarea
                id="pdesc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </Field>

            <Field>
              <FieldLabel>Label mapping</FieldLabel>
              <FieldDescription>
                The classes annotators assign. Stored as name → numeric id.
              </FieldDescription>
              <LabelMappingEditor
                value={labelMapping.labels}
                onChange={(labels) =>
                  setLabelMapping({ version: 2, labels })
                }
              />
            </Field>

            <Field>
              <FieldLabel>Annotation settings</FieldLabel>
              <FieldDescription>
                Configure which tools and options are available to annotators.
              </FieldDescription>
              <AnnotationSettings value={metaInfo} onChange={setMetaInfo} />
            </Field>
          </FieldGroup>

          <DialogFooter className="shrink-0 border-t px-6 py-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <LoadingSpinner /> : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
