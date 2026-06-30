import { useCallback, useEffect, useState } from "react";
import { useParams, useOutletContext } from "react-router";
import {
  getApiKeys,
  createApiKey,
  updateApiKey,
  deleteApiKey,
} from "@/api/apiKeys";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { ErrorAlert } from "@/components/shared/ErrorAlert";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Modal } from "@/components/shared/Modal";
import { ProviderSection } from "@/components/inference/ProviderSection";
import { useToastStore } from "@/stores/toastStore";
import type { APIKeyOutput, APIKeyCreateInput } from "@/types/apiKey";
import type { ProjectContext } from "./_app.projects.$projectId";

/** Copy text to clipboard and report success/failure via callback. */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand("copy");
      return true;
    } catch {
      return false;
    } finally {
      document.body.removeChild(textarea);
    }
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

export default function ProjectDeveloperPage() {
  const { projectId } = useParams();
  const id = Number(projectId);
  const { project } = useOutletContext<ProjectContext>();
  const addToast = useToastStore((s) => s.addToast);

  const isSupervisor = project.my_role?.toLowerCase() === "supervisor";

  // Key list state
  const [keys, setKeys] = useState<APIKeyOutput[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Create state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyExpires, setNewKeyExpires] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdToken, setCreatedToken] = useState<string | null>(null);

  // Edit state (one at a time)
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editExpires, setEditExpires] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<APIKeyOutput | null>(null);

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const resp = await getApiKeys(id, { limit: 200 });
      setKeys(resp.items);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load API keys");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  // ---- Create ----
  async function handleCreate() {
    if (!newKeyName.trim()) return;
    setCreating(true);
    try {
      const input: APIKeyCreateInput = { name: newKeyName.trim() };
      if (newKeyExpires) {
        input.expires_at = new Date(newKeyExpires).toISOString();
      }
      const result = await createApiKey(id, input);
      setCreatedToken(result.token);
      setShowCreateForm(false);
      setNewKeyName("");
      setNewKeyExpires("");
      await fetchKeys();
      addToast("API key created.", "success");
    } catch (err: unknown) {
      addToast(
        err instanceof Error ? err.message : "Failed to create API key",
        "error"
      );
    } finally {
      setCreating(false);
    }
  }

  function closeTokenModal() {
    setCreatedToken(null);
  }

  // ---- Edit ----
  function startEdit(key: APIKeyOutput) {
    setEditingId(key.id);
    setEditName(key.name);
    setEditIsActive(key.is_active);
    // Format ISO to datetime-local input value
    setEditExpires(key.expires_at ? toLocalDatetime(key.expires_at) : "");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditExpires("");
    setEditIsActive(true);
  }

  async function handleUpdate(keyId: number) {
    setSaving(true);
    const key = keys.find((k) => k.id === keyId);
    if (!key) {
      setSaving(false);
      return;
    }
    try {
      const patch: Record<string, unknown> = {};
      if (editName.trim() && editName.trim() !== key.name) {
        patch.name = editName.trim();
      }
      const newExpiry = editExpires
        ? new Date(editExpires).toISOString()
        : null;
      if (newExpiry !== key.expires_at) {
        patch.expires_at = newExpiry;
      }
      if (editIsActive !== key.is_active) {
        patch.is_active = editIsActive;
      }
      if (Object.keys(patch).length > 0) {
        await updateApiKey(id, keyId, patch);
        await fetchKeys();
        addToast("API key updated.", "success");
      }
      cancelEdit();
    } catch (err: unknown) {
      addToast(
        err instanceof Error ? err.message : "Failed to update API key",
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
      await deleteApiKey(id, deleteTarget.id);
      setDeleteTarget(null);
      await fetchKeys();
      addToast("API key deleted.", "success");
    } catch (err: unknown) {
      addToast(
        err instanceof Error ? err.message : "Failed to delete API key",
        "error"
      );
    } finally {
      setDeleting(false);
    }
  }

  // ---- Render ----
  if (!isSupervisor) {
    return (
      <div>
        <div className="mb-6 rounded-md border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          Your role is worker. API key management is only available to
          supervisors.
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Manage API keys for inference workers and external integrations.
            Keys are scoped to this project and authenticate via the{" "}
            <code className="rounded bg-muted px-1 text-xs">X-API-Key</code>{" "}
            header.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateForm(true)}
          disabled={showCreateForm}
          className="ml-4 shrink-0 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Create API Key
        </button>
      </div>

      {/* Create modal */}
      <Modal
        open={showCreateForm}
        title="Create API Key"
        onClose={() => {
          setShowCreateForm(false);
          setNewKeyName("");
          setNewKeyExpires("");
        }}
      >
        <div className="space-y-3">
          <div className="space-y-1">
            <label
              htmlFor="keyName"
              className="text-xs font-medium text-foreground"
            >
              Name
            </label>
            <input
              id="keyName"
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="e.g. inference-worker-1"
              className="w-full rounded-md border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label
              htmlFor="keyExpires"
              className="text-xs font-medium text-foreground"
            >
              Expires (optional)
            </label>
            <input
              id="keyExpires"
              type="datetime-local"
              value={newKeyExpires}
              onChange={(e) => setNewKeyExpires(e.target.value)}
              className="w-full max-w-xs rounded-md border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating || !newKeyName.trim()}
              className="flex items-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {creating ? <LoadingSpinner /> : "Create"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCreateForm(false);
                setNewKeyName("");
                setNewKeyExpires("");
              }}
              disabled={creating}
              className="rounded-md border px-3 py-1.5 text-sm text-foreground hover:bg-muted disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      {/* Error */}
      {error && <ErrorAlert message={error} onRetry={fetchKeys} />}

      {/* Keys table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : keys.length === 0 ? (
        <div className="rounded-md border bg-muted/30 px-4 py-12 text-center text-sm text-muted-foreground">
          No API keys yet. Create one to allow external services to access this
          project's API.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="px-3 py-2 font-medium text-foreground">Name</th>
                <th className="px-3 py-2 font-medium text-foreground">
                  Prefix
                </th>
                <th className="px-3 py-2 font-medium text-foreground">
                  Status
                </th>
                <th className="px-3 py-2 font-medium text-foreground">
                  Expires
                </th>
                <th className="px-3 py-2 font-medium text-foreground">
                  Last Used
                </th>
                <th className="px-3 py-2 font-medium text-foreground">
                  Created
                </th>
                <th className="px-3 py-2 font-medium text-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr
                  key={key.id}
                  className="border-b last:border-b-0 hover:bg-muted/30"
                >
                  {/* Name */}
                  <td className="px-3 py-2 text-foreground">
                    {editingId === key.id ? (
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full rounded border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    ) : (
                      key.name
                    )}
                  </td>

                  {/* Prefix */}
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                    {key.prefix}
                    {"…"}
                  </td>

                  {/* Status */}
                  <td className="px-3 py-2">
                    {editingId === key.id ? (
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
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          key.is_active
                            ? "bg-green-100 text-green-700"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {key.is_active ? "Active" : "Inactive"}
                      </span>
                    )}
                  </td>

                  {/* Expires */}
                  <td className="px-3 py-2 text-muted-foreground">
                    {editingId === key.id ? (
                      <input
                        type="datetime-local"
                        value={editExpires}
                        onChange={(e) => setEditExpires(e.target.value)}
                        className="rounded border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    ) : key.expires_at ? (
                      <span className="text-xs">
                        {formatDate(key.expires_at)}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Never
                      </span>
                    )}
                  </td>

                  {/* Last Used */}
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {formatDate(key.last_used_at)}
                  </td>

                  {/* Created */}
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {formatDate(key.created_at)}
                  </td>

                  {/* Actions */}
                  <td className="px-3 py-2">
                    {editingId === key.id ? (
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => handleUpdate(key.id)}
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
                    ) : (
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => startEdit(key)}
                          className="rounded border px-2 py-1 text-xs text-foreground hover:bg-muted"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(key)}
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

      {/* Token display modal — one-time display after creation */}
      <Modal
        open={createdToken !== null}
        title="API Key Created"
        size="lg"
        onClose={closeTokenModal}
      >
        <p className="text-sm text-destructive font-medium">
          Copy this key now. You won't be able to see it again.
        </p>
        <div className="mt-4 flex items-center gap-2">
          <code className="flex-1 break-all rounded-md bg-muted px-3 py-2 text-xs font-mono text-foreground select-all">
            {createdToken}
          </code>
          <CopyButton text={createdToken ?? ""} />
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={closeTokenModal}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Done
          </button>
        </div>
      </Modal>

      {/* Inference provider configuration */}
      <ProviderSection projectId={id} isSupervisor={isSupervisor} />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete API Key"
        message={
          deleteTarget
            ? `Are you sure you want to delete the API key "${deleteTarget.name}"? Any service using this key will lose access.`
            : ""
        }
        confirmLabel={deleting ? "Deleting…" : "Delete"}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

/** Small copy-to-clipboard button. */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="shrink-0 rounded-md border px-2 py-1 text-xs font-medium text-foreground hover:bg-muted"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

/** Convert ISO 8601 to datetime-local input value. */
function toLocalDatetime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}
