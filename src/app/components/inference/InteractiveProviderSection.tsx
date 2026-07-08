import { useCallback, useEffect, useState } from "react";
import {
  getInteractiveProviders,
  createInteractiveProvider,
  updateInteractiveProvider,
  deleteInteractiveProvider,
} from "@/api/interactiveInference";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { ErrorAlert } from "@/components/shared/ErrorAlert";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field as UiField,
  FieldLabel,
  FieldSet,
  FieldLegend,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type {
  InteractiveProviderOutput,
  InteractiveProviderCreateInput,
  InteractivePromptType,
  InteractiveResultType,
} from "@/types/interactiveInference";

const PROMPT_TYPE_COLORS: Record<InteractivePromptType, string> = {
  box: "bg-blue-100 text-blue-700 border-blue-200",
  positive_point: "bg-emerald-100 text-emerald-700 border-emerald-200",
  negative_point: "bg-red-100 text-red-700 border-red-200",
  mask: "bg-purple-100 text-purple-700 border-purple-200",
  text: "bg-amber-100 text-amber-700 border-amber-200",
};

const RESULT_TYPE_COLORS: Record<InteractiveResultType, string> = {
  box: "bg-green-100 text-green-700 border-green-200",
  polygon: "bg-blue-100 text-blue-700 border-blue-200",
  keypoint: "bg-amber-100 text-amber-700 border-amber-200",
};

const ALL_PROMPT_TYPES: InteractivePromptType[] = [
  "box",
  "positive_point",
  "negative_point",
  "mask",
  "text",
];

const ALL_RESULT_TYPES: InteractiveResultType[] = ["polygon", "box", "keypoint"];

interface Props {
  projectId: number;
  isSupervisor: boolean;
}

export function InteractiveProviderSection({ projectId, isSupervisor }: Props) {
  // List state
  const [providers, setProviders] = useState<InteractiveProviderOutput[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Create state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newModelName, setNewModelName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPromptTypes, setNewPromptTypes] = useState<InteractivePromptType[]>([]);
  const [newResultTypes, setNewResultTypes] = useState<InteractiveResultType[]>([]);
  const [newAuthType, setNewAuthType] = useState<"none" | "header" | "query">("none");
  const [newAuthParam, setNewAuthParam] = useState("");
  const [newAuthSecret, setNewAuthSecret] = useState("");
  const [newTimeout, setNewTimeout] = useState(60);
  const [newIsActive, setNewIsActive] = useState(true);
  const [creating, setCreating] = useState(false);

  // Edit state
  const [editingProvider, setEditingProvider] = useState<InteractiveProviderOutput | null>(null);
  const [editName, setEditName] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editModelName, setEditModelName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPromptTypes, setEditPromptTypes] = useState<InteractivePromptType[]>([]);
  const [editResultTypes, setEditResultTypes] = useState<InteractiveResultType[]>([]);
  const [editAuthType, setEditAuthType] = useState<"none" | "header" | "query">("none");
  const [editAuthParam, setEditAuthParam] = useState("");
  const [editAuthSecret, setEditAuthSecret] = useState("");
  const [editTimeout, setEditTimeout] = useState(60);
  const [editIsActive, setEditIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<InteractiveProviderOutput | null>(null);

  const fetchProviders = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const resp = await getInteractiveProviders(projectId, { limit: 200 });
      setProviders(resp.items);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to load interactive providers"
      );
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  // ---- Reset create form ----
  function resetCreateForm() {
    setNewName("");
    setNewUrl("");
    setNewModelName("");
    setNewDescription("");
    setNewPromptTypes([]);
    setNewResultTypes([]);
    setNewAuthType("none");
    setNewAuthParam("");
    setNewAuthSecret("");
    setNewTimeout(60);
    setNewIsActive(true);
    setShowCreateForm(false);
  }

  // ---- Create ----
  async function handleCreate() {
    if (
      !newName.trim() ||
      !newUrl.trim() ||
      newPromptTypes.length === 0 ||
      newResultTypes.length === 0
    )
      return;
    setCreating(true);
    try {
      const input: InteractiveProviderCreateInput = {
        name: newName.trim(),
        inference_url: newUrl.trim(),
        supported_prompt_types: newPromptTypes,
        supported_result_types: newResultTypes,
        model_name: newModelName.trim(),
        description: newDescription.trim(),
        auth_type: newAuthType,
        auth_param_name: newAuthParam.trim(),
        auth_secret: newAuthSecret || undefined,
        timeout_seconds: newTimeout,
        is_active: newIsActive,
      };
      await createInteractiveProvider(projectId, input);
      resetCreateForm();
      await fetchProviders();
      toast.success("Interactive provider created.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create provider");
    } finally {
      setCreating(false);
    }
  }

  // ---- Edit ----
  function startEdit(p: InteractiveProviderOutput) {
    setEditingProvider(p);
    setEditName(p.name);
    setEditUrl(p.inference_url);
    setEditModelName(p.model_name);
    setEditDescription(p.description);
    setEditPromptTypes([...p.supported_prompt_types]);
    setEditResultTypes([...p.supported_result_types]);
    setEditAuthType(p.auth_type);
    setEditAuthParam(p.auth_param_name);
    setEditAuthSecret("");
    setEditTimeout(p.timeout_seconds);
    setEditIsActive(p.is_active);
  }

  function cancelEdit() {
    setEditingProvider(null);
  }

  async function handleUpdate() {
    if (!editingProvider) return;
    setSaving(true);
    try {
      const patch: Record<string, unknown> = {};
      if (editName.trim() && editName.trim() !== editingProvider.name)
        patch.name = editName.trim();
      if (editUrl.trim() && editUrl.trim() !== editingProvider.inference_url)
        patch.inference_url = editUrl.trim();
      if (editModelName.trim() !== (editingProvider.model_name ?? ""))
        patch.model_name = editModelName.trim() || null;
      if (editDescription.trim() !== (editingProvider.description ?? ""))
        patch.description = editDescription.trim() || null;
      if (
        JSON.stringify(editPromptTypes.slice().sort()) !==
        JSON.stringify([...editingProvider.supported_prompt_types].sort())
      )
        patch.supported_prompt_types = editPromptTypes;
      if (
        JSON.stringify(editResultTypes.slice().sort()) !==
        JSON.stringify([...editingProvider.supported_result_types].sort())
      )
        patch.supported_result_types = editResultTypes;
      if (editAuthType !== editingProvider.auth_type) patch.auth_type = editAuthType;
      if (editAuthParam.trim() !== (editingProvider.auth_param_name ?? ""))
        patch.auth_param_name = editAuthParam.trim() || null;
      if (editAuthSecret) patch.auth_secret = editAuthSecret;
      if (editTimeout !== editingProvider.timeout_seconds)
        patch.timeout_seconds = editTimeout;
      if (editIsActive !== editingProvider.is_active) patch.is_active = editIsActive;

      if (Object.keys(patch).length > 0) {
        await updateInteractiveProvider(projectId, editingProvider.id, patch);
        await fetchProviders();
        toast.success("Provider updated.");
      }
      cancelEdit();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update provider");
    } finally {
      setSaving(false);
    }
  }

  // ---- Delete ----
  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteInteractiveProvider(projectId, deleteTarget.id);
      setDeleteTarget(null);
      await fetchProviders();
      toast.success("Provider deleted.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete provider");
    } finally {
      setDeleting(false);
    }
  }

  // ---- Render ----
  if (!isSupervisor) {
    return null;
  }

  return (
    <div className="mt-8">
      {/* Section header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Interactive Providers
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure interactive (SAM-style) inference services that respond to
            user prompts in real time. Global providers are shown but cannot be
            edited here.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => setShowCreateForm(true)}
          disabled={showCreateForm}
          className="ml-4 shrink-0"
        >
          Create Provider
        </Button>
      </div>

      {/* Create modal */}
      <Dialog
        open={showCreateForm}
        onOpenChange={(next) => {
          if (!next) resetCreateForm();
        }}
      >
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-xl">
          <DialogHeader className="shrink-0 border-b px-6 py-4">
            <DialogTitle>Create Interactive Provider</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <InteractiveProviderForm
              name={newName}
              onNameChange={setNewName}
              url={newUrl}
              onUrlChange={setNewUrl}
              modelName={newModelName}
              onModelNameChange={setNewModelName}
              description={newDescription}
              onDescriptionChange={setNewDescription}
              promptTypes={newPromptTypes}
              onPromptTypesChange={setNewPromptTypes}
              resultTypes={newResultTypes}
              onResultTypesChange={setNewResultTypes}
              authType={newAuthType}
              onAuthTypeChange={setNewAuthType}
              authParam={newAuthParam}
              onAuthParamChange={setNewAuthParam}
              authSecret={newAuthSecret}
              onAuthSecretChange={setNewAuthSecret}
              timeout={newTimeout}
              onTimeoutChange={setNewTimeout}
              isActive={newIsActive}
              onIsActiveChange={setNewIsActive}
              isGlobal={false}
            />
          </div>
          <Separator />
          <DialogFooter className="shrink-0 px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={resetCreateForm}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreate}
              disabled={
                creating ||
                !newName.trim() ||
                !newUrl.trim() ||
                newPromptTypes.length === 0 ||
                newResultTypes.length === 0
              }
            >
              {creating ? <LoadingSpinner /> : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Error */}
      {error && <ErrorAlert message={error} onRetry={fetchProviders} />}

      {/* Provider list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : providers.length === 0 ? (
        <div className="rounded-md border bg-muted/30 px-4 py-12 text-center text-sm text-muted-foreground">
          No interactive providers configured. Create one or ask an administrator
          to add a global provider.
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="px-3 py-2">Name</TableHead>
                <TableHead className="px-3 py-2">Model</TableHead>
                <TableHead className="px-3 py-2">Prompt Types</TableHead>
                <TableHead className="px-3 py-2">Result Types</TableHead>
                <TableHead className="px-3 py-2">Active</TableHead>
                <TableHead className="px-3 py-2">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {providers.map((p) => (
                <TableRow
                  key={p.id}
                  className={cn(p.is_global && "bg-muted/20")}
                >
                  {/* Name */}
                  <TableCell className="px-3 py-2 text-foreground">
                    <span className="flex items-center gap-1.5">
                      {p.name}
                      {p.is_global && (
                        <Badge variant="secondary" className="text-[10px]">
                          Global
                        </Badge>
                      )}
                    </span>
                  </TableCell>

                  {/* Model */}
                  <TableCell className="px-3 py-2 text-muted-foreground">
                    {p.model_name || "—"}
                  </TableCell>

                  {/* Prompt Types */}
                  <TableCell className="px-3 py-2">
                    <div className="flex gap-1 flex-wrap">
                      {p.supported_prompt_types.map((pt) => (
                        <Badge
                          key={pt}
                          variant="outline"
                          className={cn(
                            "text-[10px]",
                            PROMPT_TYPE_COLORS[pt] ??
                              "bg-muted text-muted-foreground"
                          )}
                        >
                          {pt.replace(/_/g, " ")}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>

                  {/* Result Types */}
                  <TableCell className="px-3 py-2">
                    <div className="flex gap-1 flex-wrap">
                      {p.supported_result_types.map((rt) => (
                        <Badge
                          key={rt}
                          variant="outline"
                          className={cn(
                            "text-[10px]",
                            RESULT_TYPE_COLORS[rt] ??
                              "bg-muted text-muted-foreground"
                          )}
                        >
                          {rt}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>

                  {/* Active */}
                  <TableCell className="px-3 py-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        p.is_active
                          ? "bg-green-100 text-green-700"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {p.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="px-3 py-2">
                    {p.is_global ? (
                      <span className="text-xs text-muted-foreground">
                        Read-only
                      </span>
                    ) : (
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          onClick={() => startEdit(p)}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          onClick={() => setDeleteTarget(p)}
                          className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          Delete
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit modal */}
      <Dialog
        open={editingProvider !== null}
        onOpenChange={(next) => {
          if (!next) cancelEdit();
        }}
      >
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-xl">
          <DialogHeader className="shrink-0 border-b px-6 py-4">
            <DialogTitle>Edit Interactive Provider</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <InteractiveProviderForm
              name={editName}
              onNameChange={setEditName}
              url={editUrl}
              onUrlChange={setEditUrl}
              modelName={editModelName}
              onModelNameChange={setEditModelName}
              description={editDescription}
              onDescriptionChange={setEditDescription}
              promptTypes={editPromptTypes}
              onPromptTypesChange={setEditPromptTypes}
              resultTypes={editResultTypes}
              onResultTypesChange={setEditResultTypes}
              authType={editAuthType}
              onAuthTypeChange={setEditAuthType}
              authParam={editAuthParam}
              onAuthParamChange={setEditAuthParam}
              authSecret={editAuthSecret}
              onAuthSecretChange={setEditAuthSecret}
              timeout={editTimeout}
              onTimeoutChange={setEditTimeout}
              isActive={editIsActive}
              onIsActiveChange={setEditIsActive}
              isGlobal={false}
            />
          </div>
          <Separator />
          <DialogFooter className="shrink-0 px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={cancelEdit}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleUpdate}
              disabled={
                saving ||
                !editName.trim() ||
                !editUrl.trim() ||
                editPromptTypes.length === 0 ||
                editResultTypes.length === 0
              }
            >
              {saving ? <LoadingSpinner /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete Interactive Provider"
        message={
          deleteTarget
            ? `Are you sure you want to delete the interactive provider "${deleteTarget.name}"? Sessions that were using this provider will not be affected, but no new sessions can be started with it.`
            : ""
        }
        confirmLabel={deleting ? "Deleting…" : "Delete"}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

// ---- Reusable form fields ----

interface InteractiveProviderFormProps {
  name: string;
  onNameChange: (v: string) => void;
  url: string;
  onUrlChange: (v: string) => void;
  modelName: string;
  onModelNameChange: (v: string) => void;
  description: string;
  onDescriptionChange: (v: string) => void;
  promptTypes: InteractivePromptType[];
  onPromptTypesChange: (v: InteractivePromptType[]) => void;
  resultTypes: InteractiveResultType[];
  onResultTypesChange: (v: InteractiveResultType[]) => void;
  authType: "none" | "header" | "query";
  onAuthTypeChange: (v: "none" | "header" | "query") => void;
  authParam: string;
  onAuthParamChange: (v: string) => void;
  authSecret: string;
  onAuthSecretChange: (v: string) => void;
  timeout: number;
  onTimeoutChange: (v: number) => void;
  isActive: boolean;
  onIsActiveChange: (v: boolean) => void;
  isGlobal: boolean;
}

function InteractiveProviderForm({
  name,
  onNameChange,
  url,
  onUrlChange,
  modelName,
  onModelNameChange,
  description,
  onDescriptionChange,
  promptTypes,
  onPromptTypesChange,
  resultTypes,
  onResultTypesChange,
  authType,
  onAuthTypeChange,
  authParam,
  onAuthParamChange,
  authSecret,
  onAuthSecretChange,
  timeout,
  onTimeoutChange,
  isActive,
  onIsActiveChange,
  isGlobal,
}: InteractiveProviderFormProps) {
  return (
    <div className="mt-3 flex flex-col gap-3">
      {/* Name */}
      <Field label="Name">
        <Input
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="e.g. SAM-2 Interactive"
          disabled={isGlobal}
        />
      </Field>
      {/* Base URL */}
      <Field label="Base URL">
        <Input
          type="url"
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          placeholder="https://infer.example.com"
          disabled={isGlobal}
        />
      </Field>
      {/* Model Name */}
      <Field label="Model Name (optional)">
        <Input
          type="text"
          value={modelName}
          onChange={(e) => onModelNameChange(e.target.value)}
          placeholder="e.g. vit_h"
          disabled={isGlobal}
        />
      </Field>
      {/* Description */}
      <Field label="Description (optional)">
        <Input
          type="text"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Short description"
          disabled={isGlobal}
        />
      </Field>

      {/* Prompt Types */}
      <Field label="Supported Prompt Types">
        <div className="flex gap-3 flex-wrap">
          {ALL_PROMPT_TYPES.map((pt) => (
            <label
              key={pt}
              className="inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Checkbox
                checked={promptTypes.includes(pt)}
                onCheckedChange={() => {
                  if (promptTypes.includes(pt)) {
                    onPromptTypesChange(promptTypes.filter((t) => t !== pt));
                  } else {
                    onPromptTypesChange([...promptTypes, pt]);
                  }
                }}
                disabled={isGlobal}
              />
              <span className="text-xs">{pt.replace(/_/g, " ")}</span>
            </label>
          ))}
        </div>
      </Field>

      {/* Result Types */}
      <Field label="Supported Result Types">
        <div className="flex gap-3">
          {ALL_RESULT_TYPES.map((rt) => (
            <label
              key={rt}
              className="inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Checkbox
                checked={resultTypes.includes(rt)}
                onCheckedChange={() => {
                  if (resultTypes.includes(rt)) {
                    onResultTypesChange(resultTypes.filter((t) => t !== rt));
                  } else {
                    onResultTypesChange([...resultTypes, rt]);
                  }
                }}
                disabled={isGlobal}
              />
              <span className="text-xs">{rt}</span>
            </label>
          ))}
        </div>
      </Field>

      {/* Auth section */}
      <FieldSet className="rounded-md border p-3" disabled={isGlobal}>
        <FieldLegend variant="label" className="px-1 text-xs">
          Authentication
        </FieldLegend>
        <div className="flex flex-col gap-3">
          <Field label="Auth Type">
            <Select
              value={authType}
              onValueChange={(v) => onAuthTypeChange(v as "none" | "header" | "query")}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="header">Header</SelectItem>
                  <SelectItem value="query">Query Parameter</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          {authType !== "none" && (
            <>
              <Field
                label={
                  authType === "header" ? "Header Name" : "Query Param Name"
                }
              >
                <Input
                  type="text"
                  value={authParam}
                  onChange={(e) => onAuthParamChange(e.target.value)}
                  placeholder={authType === "header" ? "Authorization" : "api_key"}
                />
              </Field>
              <Field label="Secret">
                <Input
                  type="password"
                  value={authSecret}
                  onChange={(e) => onAuthSecretChange(e.target.value)}
                  placeholder="Leave blank to keep existing secret"
                />
              </Field>
            </>
          )}
        </div>
      </FieldSet>

      {/* Timeout */}
      <Field label="Timeout (seconds)">
        <Input
          type="number"
          min={1}
          max={3600}
          value={timeout}
          onChange={(e) =>
            onTimeoutChange(Math.max(1, Number(e.target.value) || 60))
          }
          disabled={isGlobal}
          className="max-w-[120px]"
        />
      </Field>
      {/* Active */}
      <Field label="Active">
        <Switch
          checked={isActive}
          onCheckedChange={onIsActiveChange}
          disabled={isGlobal}
        />
      </Field>
    </div>
  );
}

/** Small labelled form field wrapper built on the shadcn Field primitive. */
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <UiField>
      <FieldLabel className="text-xs">{label}</FieldLabel>
      {children}
    </UiField>
  );
}
