import { useState, useEffect, useRef } from "react";
import { Link, useParams, useOutletContext } from "react-router";
import { CheckCircle, AlertCircle, X, Loader2 } from "lucide-react";
import { uploadImage } from "@/api/images";
import { ImageUploadZone } from "@/components/image/ImageUploadZone";
import { useToastStore } from "@/stores/toastStore";
import type { ProjectContext } from "./_app.projects.$projectId";
import type { Image2DOutput } from "@/types/image";

// ---- types ----

type FileStatus = "pending" | "uploading" | "success" | "error";

interface UploadFileEntry {
  id: string;
  file: File;
  status: FileStatus;
  result?: Image2DOutput;
  errorMessage?: string;
}

// ---- helpers ----

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---- thumbnail sub-component ----

function FilePreview({ file }: { file: File }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  if (!url) return <div className="h-12 w-16 shrink-0 rounded border bg-muted" />;
  return (
    <img
      src={url}
      alt={file.name}
      className="h-12 w-16 shrink-0 rounded border object-cover bg-muted"
    />
  );
}

// ---- status badge ----

function StatusBadge({ entry }: { entry: UploadFileEntry }) {
  switch (entry.status) {
    case "pending":
      return (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-muted-foreground/50" />
          Pending
        </span>
      );
    case "uploading":
      return (
        <span className="flex items-center gap-1 text-xs text-blue-600">
          <Loader2 className="h-3 w-3 animate-spin" />
          Uploading…
        </span>
      );
    case "success":
      return (
        <span className="flex items-center gap-1 text-xs text-green-700">
          <CheckCircle className="h-3 w-3" />
          Uploaded
        </span>
      );
    case "error":
      return (
        <span className="flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="h-3 w-3" />
          {entry.errorMessage ?? "Failed"}
        </span>
      );
  }
}

// ---- page ----

export default function UploadPage() {
  const { projectId } = useParams();
  const pid = Number(projectId);
  const { project, refreshProject } = useOutletContext<ProjectContext>();
  const addToast = useToastStore((s) => s.addToast);

  const isSupervisor = project.my_role?.toLowerCase() === "supervisor";

  const [files, setFiles] = useState<UploadFileEntry[]>([]);
  const [uploading, setUploading] = useState(false);
  const [batchComplete, setBatchComplete] = useState(false);
  const abortRef = useRef(false);

  // ---- pagination ----
  const DEFAULT_PAGE_SIZE = 20;
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [currentOffset, setCurrentOffset] = useState(0);

  // Clamp offset when files change (add/remove/clear)
  useEffect(() => {
    setCurrentOffset((prev) => {
      if (files.length === 0) return 0;
      const maxOffset = Math.max(0, Math.ceil(files.length / pageSize) - 1) * pageSize;
      if (prev > maxOffset) return maxOffset;
      // If prev fits within current pageSize but may need adjustment due to pageSize change
      return prev - (prev % pageSize);
    });
  }, [files.length, pageSize]);

  // Cleanup abort on unmount
  useEffect(() => {
    return () => {
      abortRef.current = true;
    };
  }, []);

  // ---- handlers ----

  function handleFilesSelected(newFiles: File[]) {
    const entries: UploadFileEntry[] = newFiles.map((file, i) => ({
      id: `${Date.now()}-${i}-${file.name}`,
      file,
      status: "pending" as const,
    }));
    setFiles((prev) => [...prev, ...entries]);
    setBatchComplete(false);
  }

  function handleRemove(id: string) {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  function handleClearCompleted() {
    setFiles((prev) =>
      prev.filter((f) => f.status !== "success" && f.status !== "error")
    );
    setBatchComplete(false);
  }

  async function handleUploadAll() {
    const pending = files.filter((f) => f.status === "pending");
    if (pending.length === 0) return;

    setUploading(true);
    setBatchComplete(false);
    abortRef.current = false;

    for (const entry of pending) {
      if (abortRef.current) break;

      setFiles((prev) =>
        prev.map((f) => (f.id === entry.id ? { ...f, status: "uploading" } : f))
      );

      try {
        const result = await uploadImage(pid, entry.file);
        setFiles((prev) =>
          prev.map((f) =>
            f.id === entry.id ? { ...f, status: "success", result } : f
          )
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Upload failed";
        setFiles((prev) =>
          prev.map((f) =>
            f.id === entry.id
              ? { ...f, status: "error", errorMessage: message }
              : f
          )
        );
      }
    }

    setUploading(false);
    setBatchComplete(true);

    // Refresh project data (e.g. image counts)
    refreshProject();

    // Use final setFiles callback to get accurate counts
    setFiles((current) => {
      const ok = current.filter((f) => f.status === "success").length;
      const fail = current.filter((f) => f.status === "error").length;
      if (fail > 0) {
        addToast(`${ok} uploaded, ${fail} failed`, "error");
      } else {
        addToast(`${ok} image${ok !== 1 ? "s" : ""} uploaded`, "success");
      }
      return current;
    });
  }

  function handleCancel() {
    abortRef.current = true;
    setUploading(false);
  }

  // ---- derived counts ----

  const pendingCount = files.filter((f) => f.status === "pending").length;
  const successCount = files.filter((f) => f.status === "success").length;
  const errorCount = files.filter((f) => f.status === "error").length;
  const hasFiles = files.length > 0;
  const canUpload = pendingCount > 0 && !uploading;

  // ---- pagination derived ----
  const totalPages = Math.max(1, Math.ceil(files.length / pageSize));
  const currentPage = Math.floor(currentOffset / pageSize) + 1;
  const paginatedFiles = files.slice(currentOffset, currentOffset + pageSize);
  const showPagination = files.length > pageSize;
  const pageStart = files.length === 0 ? 0 : currentOffset + 1;
  const pageEnd = Math.min(currentOffset + pageSize, files.length);

  function goToPage(page: number) {
    const newOffset = (page - 1) * pageSize;
    setCurrentOffset(Math.max(0, Math.min(newOffset, files.length - 1)));
  }

  // ---- worker gate ----

  if (!isSupervisor) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          Uploading images is restricted to supervisors.
        </div>
        <Link
          to={`/projects/${pid}/images`}
          className="text-sm text-primary hover:underline"
        >
          ← Back to images
        </Link>
      </div>
    );
  }

  // ---- render ----

  return (
    <div className="mx-auto max-w-2xl">
      {/* Breadcrumb */}
      <Link
        to={`/projects/${pid}/images`}
        className="mb-4 inline-block text-xs text-muted-foreground hover:text-foreground hover:underline"
      >
        ← Back to images
      </Link>

      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">
          Upload Images
        </h2>
        {hasFiles && !batchComplete && (
          <span className="text-sm text-muted-foreground">
            {files.length} selected
          </span>
        )}
      </div>

      {/* Upload zone — always visible so user can add more */}
      {!batchComplete && (
        <ImageUploadZone
          onFilesSelected={handleFilesSelected}
          disabled={uploading}
        />
      )}

      {/* File list */}
      {hasFiles && (
        <div className="mt-4 space-y-2">
          {paginatedFiles.map((entry) => (
            <div
              key={entry.id}
              className={`flex items-center gap-3 rounded-md border bg-card p-3 ${
                entry.status === "error" ? "border-destructive/30" : ""
              }`}
            >
              {/* Thumbnail */}
              <FilePreview file={entry.file} />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {entry.file.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(entry.file.size)}
                </p>
              </div>

              {/* Status */}
              <StatusBadge entry={entry} />

              {/* Remove button (pending or error only) */}
              {(entry.status === "pending" || entry.status === "error") &&
                !uploading && (
                  <button
                    onClick={() => handleRemove(entry.id)}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                    title="Remove"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination controls */}
      {showPagination && (
        <div className="mt-3 flex items-center justify-between rounded-lg border bg-card px-4 py-3">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              Showing {pageStart}–{pageEnd} of {files.length}
            </span>
            <label className="flex items-center gap-1">
              <span>Rows:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentOffset(0);
                }}
                className="rounded border bg-background px-1.5 py-0.5 text-xs"
              >
                {[10, 20, 50, 100].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              className="rounded border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <span className="px-2 text-xs text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="rounded border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {hasFiles && !batchComplete && (
        <div className="mt-4 flex items-center gap-3">
          {canUpload && (
            <button
              onClick={handleUploadAll}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Upload {pendingCount} remaining
            </button>
          )}
          {uploading && (
            <button
              onClick={handleCancel}
              className="rounded-md border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              Cancel
            </button>
          )}
          {(successCount > 0 || errorCount > 0) && !uploading && (
            <button
              onClick={handleClearCompleted}
              className="rounded-md border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Clear completed
            </button>
          )}
        </div>
      )}

      {/* Summary (after batch complete) */}
      {batchComplete && (
        <div className="mt-4 rounded-lg border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground">
            Upload complete
          </h3>
          <div className="mt-2 flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1 text-green-700">
              <CheckCircle className="h-3.5 w-3.5" />
              {successCount} succeeded
            </span>
            {errorCount > 0 && (
              <span className="flex items-center gap-1 text-destructive">
                <AlertCircle className="h-3.5 w-3.5" />
                {errorCount} failed
              </span>
            )}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <Link
              to={`/projects/${pid}/images`}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              View Images
            </Link>
            <button
              onClick={handleClearCompleted}
              className="rounded-md border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
            >
              Upload More
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
