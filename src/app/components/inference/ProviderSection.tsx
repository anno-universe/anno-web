import { useCallback, useEffect, useState } from "react";
import {
  getInferenceProviders,
  createInferenceProvider,
  updateInferenceProvider,
  deleteInferenceProvider,
} from "@/api/inferenceProviders";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { ErrorAlert } from "@/components/shared/ErrorAlert";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Modal } from "@/components/shared/Modal";
import { useToastStore } from "@/stores/toastStore";
import { cn } from "@/lib/utils";
import type {
  InferenceProviderOutput,
  InferenceProviderCreateInput,
  ResultType,
  ProviderAuthType,
} from "@/types/inferenceProvider";

const RESULT_TYPE_COLORS: Record<ResultType, string> = {
  box: "bg-green-100 text-green-700 border-green-200",
  polygon: "bg-blue-100 text-blue-700 border-blue-200",
  keypoint: "bg-amber-100 text-amber-700 border-amber-200",
};

const ALL_RESULT_TYPES: ResultType[] = ["box", "polygon", "keypoint"];

interface Props {
  projectId: number;
  isSupervisor: boolean;
}

export function ProviderSection({ projectId, isSupervisor }: Props) {
  const addToast = useToastStore((s) => s.addToast);

  // List state
  const [providers, setProviders] = useState<InferenceProviderOutput[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Create state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newModelName, setNewModelName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newResultTypes, setNewResultTypes] = useState<ResultType[]>([]);
  const [newAuthType, setNewAuthType] = useState<ProviderAuthType>("none");
  const [newAuthParam, setNewAuthParam] = useState("");
  const [newAuthSecret, setNewAuthSecret] = useState("");
  const [newTimeout, setNewTimeout] = useState(60);
  const [newIsActive, setNewIsActive] = useState(true);
  const [creating, setCreating] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editModelName, setEditModelName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editResultTypes, setEditResultTypes] = useState<ResultType[]>([]);
  const [editAuthType, setEditAuthType] = useState<ProviderAuthType>("none");
  const [editAuthParam, setEditAuthParam] = useState("");
  const [editAuthSecret, setEditAuthSecret] = useState("");
  const [editTimeout, setEditTimeout] = useState(60);
  const [editIsActive, setEditIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] =
    useState<InferenceProviderOutput | null>(null);

  const fetchProviders = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const resp = await getInferenceProviders(projectId, { limit: 200 });
      setProviders(resp.items);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to load providers"
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
    if (!newName.trim() || !newUrl.trim() || newResultTypes.length === 0)
      return;
    setCreating(true);
    try {
      const input: InferenceProviderCreateInput = {
        name: newName.trim(),
        inference_url: newUrl.trim(),
        supported_result_types: newResultTypes,
        model_name: newModelName.trim(),
        description: newDescription.trim(),
        auth_type: newAuthType,
        auth_param_name: newAuthParam.trim(),
        auth_secret: newAuthSecret || undefined,
        timeout_seconds: newTimeout,
        is_active: newIsActive,
      };
      await createInferenceProvider(projectId, input);
      resetCreateForm();
      await fetchProviders();
      addToast("Inference provider created.", "success");
    } catch (err: unknown) {
      addToast(
        err instanceof Error ? err.message : "Failed to create provider",
        "error"
      );
    } finally {
      setCreating(false);
    }
  }

  // ---- Edit ----
  function startEdit(p: InferenceProviderOutput) {
    setEditingId(p.id);
    setEditName(p.name);
    setEditUrl(p.inference_url);
    setEditModelName(p.model_name);
    setEditDescription(p.description);
    setEditResultTypes([...p.supported_result_types]);
    setEditAuthType(p.auth_type);
    setEditAuthParam(p.auth_param_name);
    setEditAuthSecret("");
    setEditTimeout(p.timeout_seconds);
    setEditIsActive(p.is_active);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function handleUpdate(providerId: number) {
    setSaving(true);
    const provider = providers.find((p) => p.id === providerId);
    if (!provider) {
      setSaving(false);
      return;
    }
    try {
      const patch: Record<string, unknown> = {};
      if (editName.trim() && editName.trim() !== provider.name)
        patch.name = editName.trim();
      if (editUrl.trim() && editUrl.trim() !== provider.inference_url)
        patch.inference_url = editUrl.trim();
      if (editModelName.trim() !== (provider.model_name ?? ""))
        patch.model_name = editModelName.trim() || null;
      if (editDescription.trim() !== (provider.description ?? ""))
        patch.description = editDescription.trim() || null;
      if (
        JSON.stringify(editResultTypes.sort()) !==
        JSON.stringify([...provider.supported_result_types].sort())
      )
        patch.supported_result_types = editResultTypes;
      if (editAuthType !== provider.auth_type) patch.auth_type = editAuthType;
      if (editAuthParam.trim() !== (provider.auth_param_name ?? ""))
        patch.auth_param_name = editAuthParam.trim() || null;
      if (editAuthSecret) patch.auth_secret = editAuthSecret;
      if (editTimeout !== provider.timeout_seconds)
        patch.timeout_seconds = editTimeout;
      if (editIsActive !== provider.is_active) patch.is_active = editIsActive;

      if (Object.keys(patch).length > 0) {
        await updateInferenceProvider(projectId, providerId, patch);
        await fetchProviders();
        addToast("Provider updated.", "success");
      }
      cancelEdit();
    } catch (err: unknown) {
      addToast(
        err instanceof Error ? err.message : "Failed to update provider",
        "error"
      );
    } finally {
      setSaving(false);
    }
  }

  // ---- Delete ----
  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteInferenceProvider(projectId, deleteTarget.id);
      setDeleteTarget(null);
      await fetchProviders();
      addToast("Provider deleted.", "success");
    } catch (err: unknown) {
      addToast(
        err instanceof Error ? err.message : "Failed to delete provider",
        "error"
      );
    } finally {
      setDeleting(false);
    }
  }

  // ---- Toggle result type in form ----
  function toggleResultType(
    current: ResultType[],
    setter: (v: ResultType[]) => void,
    type: ResultType
  ) {
    if (current.includes(type)) {
      setter(current.filter((t) => t !== type));
    } else {
      setter([...current, type]);
    }
  }

  // ---- Render ----
  if (!isSupervisor) {
    return null; // Developer page already handles the non-supervisor banner
  }

  return (
    <div className="mt-8">
      {/* Section header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Inference Providers
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure AI/ML inference services that can automatically annotate
            images in this project. Global providers (managed by administrators)
            are shown but cannot be edited here.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateForm(true)}
          disabled={showCreateForm}
          className="ml-4 shrink-0 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Create Provider
        </button>
      </div>

      {/* Create modal */}
      <Modal
        open={showCreateForm}
        title="Create Inference Provider"
        size="xl"
        onClose={resetCreateForm}
      >
        <ProviderForm
          name={newName}
          onNameChange={setNewName}
          url={newUrl}
          onUrlChange={setNewUrl}
          modelName={newModelName}
          onModelNameChange={setNewModelName}
          description={newDescription}
          onDescriptionChange={setNewDescription}
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
        >
          <div className="flex gap-2 mt-4">
            <button
              type="button"
              onClick={handleCreate}
              disabled={
                creating ||
                !newName.trim() ||
                !newUrl.trim() ||
                newResultTypes.length === 0
              }
              className="flex items-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {creating ? <LoadingSpinner /> : "Create"}
            </button>
            <button
              type="button"
              onClick={resetCreateForm}
              disabled={creating}
              className="rounded-md border px-3 py-1.5 text-sm text-foreground hover:bg-muted disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </ProviderForm>
      </Modal>

      {/* Error */}
      {error && <ErrorAlert message={error} onRetry={fetchProviders} />}

      {/* Provider list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : providers.length === 0 ? (
        <div className="rounded-md border bg-muted/30 px-4 py-12 text-center text-sm text-muted-foreground">
          No inference providers configured. Create one or ask an administrator
          to add a global provider.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="px-3 py-2 font-medium text-foreground">Name</th>
                <th className="px-3 py-2 font-medium text-foreground">Model</th>
                <th className="px-3 py-2 font-medium text-foreground">URL</th>
                <th className="px-3 py-2 font-medium text-foreground">
                  Result Types
                </th>
                <th className="px-3 py-2 font-medium text-foreground">Auth</th>
                <th className="px-3 py-2 font-medium text-foreground">
                  Active
                </th>
                <th className="px-3 py-2 font-medium text-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {providers.map((p) => (
                <tr
                  key={p.id}
                  className={cn(
                    "border-b last:border-b-0 hover:bg-muted/30",
                    p.is_global && "bg-muted/20"
                  )}
                >
                  {/* Name */}
                  <td className="px-3 py-2 text-foreground">
                    {editingId === p.id ? (
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full rounded border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    ) : (
                      <span className="flex items-center gap-1.5">
                        {p.name}
                        {p.is_global && (
                          <span className="rounded bg-muted-foreground/15 px-1.5 py-[1px] text-[10px] font-medium text-muted-foreground">
                            Global
                          </span>
                        )}
                      </span>
                    )}
                  </td>

                  {/* Model */}
                  <td className="px-3 py-2 text-muted-foreground">
                    {editingId === p.id ? (
                      <input
                        type="text"
                        value={editModelName}
                        onChange={(e) => setEditModelName(e.target.value)}
                        className="w-full rounded border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="e.g. SAM-2"
                      />
                    ) : (
                      p.model_name || "—"
                    )}
                  </td>

                  {/* URL */}
                  <td className="px-3 py-2 max-w-[160px] truncate text-xs text-muted-foreground">
                    {editingId === p.id ? (
                      <input
                        type="url"
                        value={editUrl}
                        onChange={(e) => setEditUrl(e.target.value)}
                        className="w-full rounded border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    ) : (
                      <span title={p.inference_url}>{p.inference_url}</span>
                    )}
                  </td>

                  {/* Result Types */}
                  <td className="px-3 py-2">
                    {editingId === p.id ? (
                      <div className="flex gap-1.5 flex-wrap">
                        {ALL_RESULT_TYPES.map((rt) => (
                          <label
                            key={rt}
                            className="inline-flex items-center gap-1 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={editResultTypes.includes(rt)}
                              onChange={() =>
                                toggleResultType(
                                  editResultTypes,
                                  setEditResultTypes,
                                  rt
                                )
                              }
                              className="rounded border-muted-foreground"
                            />
                            <span className="text-xs">{rt}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <div className="flex gap-1 flex-wrap">
                        {p.supported_result_types.map((rt) => (
                          <span
                            key={rt}
                            className={cn(
                              "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium",
                              RESULT_TYPE_COLORS[rt] ??
                                "bg-muted text-muted-foreground"
                            )}
                          >
                            {rt}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>

                  {/* Auth */}
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {editingId === p.id ? (
                      <span className="text-xs">{editAuthType}</span>
                    ) : (
                      <>
                        {p.auth_type === "none"
                          ? "None"
                          : `${p.auth_type}${p.has_auth_secret ? " (secret set)" : ""}`}
                      </>
                    )}
                  </td>

                  {/* Active */}
                  <td className="px-3 py-2">
                    {editingId === p.id ? (
                      <label className="inline-flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editIsActive}
                          onChange={(e) => setEditIsActive(e.target.checked)}
                          className="rounded border-muted-foreground"
                        />
                        <span className="text-xs">
                          {editIsActive ? "Active" : "Inactive"}
                        </span>
                      </label>
                    ) : (
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                          p.is_active
                            ? "bg-green-100 text-green-700"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {p.is_active ? "Active" : "Inactive"}
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-3 py-2">
                    {editingId === p.id ? (
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => handleUpdate(p.id)}
                          disabled={saving}
                          className="rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                        >
                          {saving ? "…" : "Save"}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          disabled={saving}
                          className="rounded border px-2 py-1 text-xs text-foreground hover:bg-muted disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : p.is_global ? (
                      <span className="text-xs text-muted-foreground">
                        Read-only
                      </span>
                    ) : (
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => startEdit(p)}
                          className="rounded border px-2 py-1 text-xs text-foreground hover:bg-muted"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(p)}
                          className="rounded border border-destructive/30 px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit auth fields (shown inline in edit mode via modal-style row expansion) */}
      {editingId !== null && (
        <div className="mt-4 rounded-md border p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">
            Edit Provider — Advanced Fields
          </h3>
          <ProviderForm
            name={editName}
            onNameChange={setEditName}
            url={editUrl}
            onUrlChange={setEditUrl}
            modelName={editModelName}
            onModelNameChange={setEditModelName}
            description={editDescription}
            onDescriptionChange={setEditDescription}
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
            hideBasicFields
          >
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={() => handleUpdate(editingId!)}
                disabled={
                  saving ||
                  !editName.trim() ||
                  !editUrl.trim() ||
                  editResultTypes.length === 0
                }
                className="flex items-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? <LoadingSpinner /> : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                disabled={saving}
                className="rounded-md border px-3 py-1.5 text-sm text-foreground hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </ProviderForm>
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete Inference Provider"
        message={
          deleteTarget
            ? `Are you sure you want to delete the inference provider "${deleteTarget.name}"? Jobs that were using this provider will not be affected, but no new jobs can be started with it.`
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

interface ProviderFormProps {
  name: string;
  onNameChange: (v: string) => void;
  url: string;
  onUrlChange: (v: string) => void;
  modelName: string;
  onModelNameChange: (v: string) => void;
  description: string;
  onDescriptionChange: (v: string) => void;
  resultTypes: ResultType[];
  onResultTypesChange: (v: ResultType[]) => void;
  authType: ProviderAuthType;
  onAuthTypeChange: (v: ProviderAuthType) => void;
  authParam: string;
  onAuthParamChange: (v: string) => void;
  authSecret: string;
  onAuthSecretChange: (v: string) => void;
  timeout: number;
  onTimeoutChange: (v: number) => void;
  isActive: boolean;
  onIsActiveChange: (v: boolean) => void;
  isGlobal: boolean;
  hideBasicFields?: boolean;
  children?: React.ReactNode;
}

function ProviderForm({
  name,
  onNameChange,
  url,
  onUrlChange,
  modelName,
  onModelNameChange,
  description,
  onDescriptionChange,
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
  isGlobal,
  hideBasicFields,
  children,
}: ProviderFormProps) {
  return (
    <div className="mt-3 space-y-3">
      {!hideBasicFields && (
        <>
          {/* Name + URL row */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name">
              <input
                type="text"
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder="e.g. YOLOv8"
                disabled={isGlobal}
                className="w-full rounded-md border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              />
            </Field>
            <Field label="Inference URL">
              <input
                type="url"
                value={url}
                onChange={(e) => onUrlChange(e.target.value)}
                placeholder="https://infer.example.com/predict"
                disabled={isGlobal}
                className="w-full rounded-md border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              />
            </Field>
          </div>
          {/* Model name + Description */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Model Name (optional)">
              <input
                type="text"
                value={modelName}
                onChange={(e) => onModelNameChange(e.target.value)}
                placeholder="e.g. SAM-2"
                disabled={isGlobal}
                className="w-full rounded-md border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              />
            </Field>
            <Field label="Description (optional)">
              <input
                type="text"
                value={description}
                onChange={(e) => onDescriptionChange(e.target.value)}
                placeholder="Short description"
                disabled={isGlobal}
                className="w-full rounded-md border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              />
            </Field>
          </div>
          {/* Result Types */}
          <Field label="Supported Result Types">
            <div className="flex gap-2">
              {ALL_RESULT_TYPES.map((rt) => (
                <label
                  key={rt}
                  className="inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={resultTypes.includes(rt)}
                    onChange={() =>
                      (() => {
                        if (resultTypes.includes(rt)) {
                          onResultTypesChange(
                            resultTypes.filter((t) => t !== rt)
                          );
                        } else {
                          onResultTypesChange([...resultTypes, rt]);
                        }
                      })()
                    }
                    disabled={isGlobal}
                    className="rounded border-muted-foreground disabled:opacity-50"
                  />
                  <span className="text-xs">{rt}</span>
                </label>
              ))}
            </div>
          </Field>
        </>
      )}

      {/* Auth section */}
      <fieldset className="rounded-md border p-3" disabled={isGlobal}>
        <legend className="text-xs font-medium text-foreground px-1">
          Authentication
        </legend>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Auth Type">
            <select
              value={authType}
              onChange={(e) =>
                onAuthTypeChange(e.target.value as ProviderAuthType)
              }
              className="w-full rounded-md border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="none">None</option>
              <option value="header">Header</option>
              <option value="query">Query Parameter</option>
            </select>
          </Field>
          {authType !== "none" && (
            <>
              <Field
                label={
                  authType === "header" ? "Header Name" : "Query Param Name"
                }
              >
                <input
                  type="text"
                  value={authParam}
                  onChange={(e) => onAuthParamChange(e.target.value)}
                  placeholder={
                    authType === "header"
                      ? "Authorization"
                      : "api_key"
                  }
                  className="w-full rounded-md border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </Field>
              <Field label="Secret">
                <input
                  type="password"
                  value={authSecret}
                  onChange={(e) => onAuthSecretChange(e.target.value)}
                  placeholder="Leave blank to keep existing secret"
                  className="w-full rounded-md border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </Field>
            </>
          )}
        </div>
      </fieldset>

      {/* Timeout + Active */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Timeout (seconds)">
          <input
            type="number"
            min={1}
            max={3600}
            value={timeout}
            onChange={(e) =>
              onTimeoutChange(Math.max(1, Number(e.target.value) || 60))
            }
            disabled={isGlobal}
            className="w-full max-w-[120px] rounded-md border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
        </Field>
        <Field label="Active">
          <label className="inline-flex items-center gap-1.5 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={isGlobal ? false : true}
              disabled={isGlobal}
              className="rounded border-muted-foreground"
            />
            <span className="text-xs text-muted-foreground">
              {isGlobal ? "Managed globally" : "Provider is active"}
            </span>
          </label>
        </Field>
      </div>

      {children}
    </div>
  );
}

/** Small labelled form field wrapper. */
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}
