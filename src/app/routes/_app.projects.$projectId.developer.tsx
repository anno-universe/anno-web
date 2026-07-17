import { useCallback, useEffect, useState } from "react";
import { useParams, useOutletContext } from "react-router";
import {
  getApiKeys,
  createApiKey,
  updateApiKey,
  deleteApiKey,
} from "@/api/apiKeys";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { SkeletonTable } from "@/components/shared/SkeletonTable";
import { ErrorAlert } from "@/components/shared/ErrorAlert";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Field, FieldLabel } from "@/components/ui/field";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ProviderSection } from "@/components/inference/ProviderSection";
import { InteractiveProviderSection } from "@/components/inference/InteractiveProviderSection";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Pencil, Trash2 } from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
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

  const isSupervisor = project.my_role?.toLowerCase() === "supervisor";

  // Key list state
  const [keys, setKeys] = useState<APIKeyOutput[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Create state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyExpires, setNewKeyExpires] = useState<Date | undefined>(undefined);
  const [creating, setCreating] = useState(false);
  const [createdToken, setCreatedToken] = useState<string | null>(null);

  // Edit state
  const [editingKey, setEditingKey] = useState<APIKeyOutput | null>(null);
  const [editName, setEditName] = useState("");
  const [editExpires, setEditExpires] = useState<Date | undefined>(undefined);
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
        const endOfDay = new Date(newKeyExpires);
        endOfDay.setHours(23, 59, 59, 999);
        input.expires_at = endOfDay.toISOString();
      }
      const result = await createApiKey(id, input);
      setCreatedToken(result.token);
      setShowCreateForm(false);
      setNewKeyName("");
      setNewKeyExpires(undefined);
      await fetchKeys();
      toast.success("API key created.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create API key");
    } finally {
      setCreating(false);
    }
  }

  function closeTokenModal() {
    setCreatedToken(null);
  }

  // ---- Edit ----
  function startEdit(key: APIKeyOutput) {
    setEditingKey(key);
    setEditName(key.name);
    setEditIsActive(key.is_active);
    setEditExpires(key.expires_at ? new Date(key.expires_at) : undefined);
  }

  function cancelEdit() {
    setEditingKey(null);
    setEditName("");
    setEditExpires(undefined);
    setEditIsActive(true);
  }

  async function handleUpdate() {
    if (!editingKey) return;
    setSaving(true);
    try {
      const patch: Record<string, unknown> = {};
      if (editName.trim() && editName.trim() !== editingKey.name) {
        patch.name = editName.trim();
      }
      let newExpiry: string | null = null;
      if (editExpires) {
        const endOfDay = new Date(editExpires);
        endOfDay.setHours(23, 59, 59, 999);
        newExpiry = endOfDay.toISOString();
      }
      if (newExpiry !== editingKey.expires_at) {
        patch.expires_at = newExpiry;
      }
      if (editIsActive !== editingKey.is_active) {
        patch.is_active = editIsActive;
      }
      if (Object.keys(patch).length > 0) {
        await updateApiKey(id, editingKey.id, patch);
        await fetchKeys();
        toast.success("API key updated.");
      }
      cancelEdit();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update API key");
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
      toast.success("API key deleted.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete API key");
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
        <Button
          type="button"
          size="sm"
          onClick={() => setShowCreateForm(true)}
          disabled={showCreateForm}
          className="ml-4 shrink-0"
        >
          Create API Key
        </Button>
      </div>

      {/* Create modal */}
      <Dialog
        open={showCreateForm}
        onOpenChange={(next) => {
          if (!next) {
            setShowCreateForm(false);
            setNewKeyName("");
            setNewKeyExpires(undefined);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="keyName">Name</FieldLabel>
              <Input
                id="keyName"
                type="text"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="e.g. inference-worker-1"
              />
            </Field>
            <Field>
              <FieldLabel>Expires (optional)</FieldLabel>
              <DatePicker
                date={newKeyExpires}
                onDateChange={setNewKeyExpires}
                placeholder="No expiration"
                disabled={creating}
                fromDate={new Date()}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowCreateForm(false);
                setNewKeyName("");
                setNewKeyExpires(undefined);
              }}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreate}
              disabled={creating || !newKeyName.trim()}
            >
              {creating ? <LoadingSpinner /> : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit modal */}
      <Dialog
        open={editingKey !== null}
        onOpenChange={(next) => {
          if (!next) cancelEdit();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit API Key</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="editKeyName">Name</FieldLabel>
              <Input
                id="editKeyName"
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel>Active</FieldLabel>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <Switch
                  checked={editIsActive}
                  onCheckedChange={setEditIsActive}
                />
                <span className="text-sm">
                  {editIsActive ? "Active" : "Inactive"}
                </span>
              </label>
            </Field>
            <Field>
              <FieldLabel>Expires (optional)</FieldLabel>
              <DatePicker
                date={editExpires}
                onDateChange={setEditExpires}
                placeholder="No expiration"
                disabled={saving}
                fromDate={new Date()}
              />
            </Field>
          </div>
          <DialogFooter>
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
              disabled={saving || !editName.trim()}
            >
              {saving ? <LoadingSpinner /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Error */}
      {error && <ErrorAlert message={error} onRetry={fetchKeys} />}

      {/* Keys table */}
      {loading ? (
        <SkeletonTable rows={3} />
      ) : keys.length === 0 ? (
        <div className="rounded-md border bg-muted/30 px-4 py-12 text-center text-sm text-muted-foreground">
          No API keys yet. Create one to allow external services to access this
          project's API.
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="px-3">Name</TableHead>
                <TableHead className="px-3">Prefix</TableHead>
                <TableHead className="px-3">Status</TableHead>
                <TableHead className="px-3">Expires</TableHead>
                <TableHead className="px-3">Last Used</TableHead>
                <TableHead className="px-3">Created</TableHead>
                <TableHead className="px-3 w-[70px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((key) => (
                <TableRow key={key.id} className="hover:bg-muted/30">
                  {/* Name */}
                  <TableCell className="px-3 text-foreground">
                    {key.name}
                  </TableCell>

                  {/* Prefix */}
                  <TableCell className="px-3 font-mono text-xs text-muted-foreground">
                    {key.prefix}
                    {"…"}
                  </TableCell>

                  {/* Status */}
                  <TableCell className="px-3">
                    <Badge
                      variant="outline"
                      className={cn(
                        key.is_active
                          ? "bg-green-100 text-green-700"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {key.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>

                  {/* Expires */}
                  <TableCell className="px-3 text-muted-foreground">
                    {key.expires_at ? (
                      <span className="text-xs">
                        {formatDate(key.expires_at)}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Never
                      </span>
                    )}
                  </TableCell>

                  {/* Last Used */}
                  <TableCell className="px-3 text-xs text-muted-foreground">
                    {formatDate(key.last_used_at)}
                  </TableCell>

                  {/* Created */}
                  <TableCell className="px-3 text-xs text-muted-foreground">
                    {formatDate(key.created_at)}
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="px-3">
                    <div className="flex gap-0.5">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => startEdit(key)}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Edit</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => setDeleteTarget(key)}
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete</TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Token display modal — one-time display after creation */}
      <Dialog
        open={createdToken !== null}
        onOpenChange={(next) => {
          if (!next) closeTokenModal();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>API Key Created</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-destructive font-medium">
              Copy this key now. You won't be able to see it again.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all rounded-md bg-muted px-3 py-2 text-xs font-mono text-foreground select-all">
                {createdToken}
              </code>
              <CopyButton text={createdToken ?? ""} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" onClick={closeTokenModal}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inference provider configuration */}
      <ProviderSection projectId={id} isSupervisor={isSupervisor} />

      {/* Interactive inference provider configuration */}
      <InteractiveProviderSection projectId={id} isSupervisor={isSupervisor} />

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
    <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
      {copied ? "Copied!" : "Copy"}
    </Button>
  );
}

