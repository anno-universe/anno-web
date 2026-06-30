import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useParams, useOutletContext, Link } from "react-router";
import {
  getInferenceJobs,
  startBatchInference,
  cancelInferenceJob,
  retryInferenceJob,
} from "@/api/inferenceJobs";
import { getInferenceProviders } from "@/api/inferenceProviders";
import {
  PaginatedTable,
  type Column,
} from "@/components/shared/PaginatedTable";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { ErrorAlert } from "@/components/shared/ErrorAlert";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Modal } from "@/components/shared/Modal";
import { JobStatusBadge } from "@/components/inference/JobStatusBadge";
import { useToastStore } from "@/stores/toastStore";
import { cn } from "@/lib/utils";
import type { ProjectContext } from "./_app.projects.$projectId";
import type { InferenceProviderOutput } from "@/types/inferenceProvider";
import type { JobOutput } from "@/types/inferenceJob";
import { ACTIVE_JOB_STATUSES } from "@/types/inferenceJob";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function progressPercent(job: JobOutput): number {
  if (job.total_items === 0) return 0;
  return Math.round((job.completed_items / job.total_items) * 100);
}

export default function ProjectInferencePage() {
  const { projectId } = useParams();
  const pid = Number(projectId);
  const { project } = useOutletContext<ProjectContext>();
  const addToast = useToastStore((s) => s.addToast);

  const isSupervisor = project.my_role?.toLowerCase() === "supervisor";

  if (!isSupervisor) {
    return (
      <div className="rounded-md border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
        Your role is {project.my_role ?? "none"}. Inference job management is
        only available to supervisors.
      </div>
    );
  }

  // Job list state (paginated from server)
  const [jobs, setJobs] = useState<JobOutput[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [count, setCount] = useState(0);
  const [limit, setLimit] = useState(20);
  const [offset, setOffset] = useState(0);

  // Providers (for name lookups + start form)
  const [providers, setProviders] = useState<InferenceProviderOutput[]>([]);
  const [providersLoading, setProvidersLoading] = useState(true);

  // Start new job modal
  const [showStartModal, setShowStartModal] = useState(false);
  const [selectedProviderId, setSelectedProviderId] = useState<number | null>(
    null
  );
  const [starting, setStarting] = useState(false);

  // Cancel
  const [cancelTarget, setCancelTarget] = useState<JobOutput | null>(null);
  const [cancelling, setCancelling] = useState(false);

  // Retry
  const [retryTarget, setRetryTarget] = useState<JobOutput | null>(null);
  const [retrying, setRetrying] = useState(false);

  // Polling
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Provider lookup map
  const providerMap = useMemo(
    () => new Map(providers.map((p) => [p.id, p])),
    [providers]
  );

  // ---- Data fetching ----
  const fetchJobs = useCallback(async () => {
    try {
      const resp = await getInferenceJobs(pid, { limit, offset });
      setJobs(resp.items);
      setCount(resp.count);
      setError("");
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to load jobs"
      );
    } finally {
      setLoading(false);
    }
  }, [pid, limit, offset]);

  const fetchProviders = useCallback(async () => {
    try {
      const resp = await getInferenceProviders(pid, { limit: 100 });
      setProviders(resp.items);
      const active = resp.items.filter((p) => p.is_active);
      if (active.length > 0 && !selectedProviderId) {
        setSelectedProviderId(active[0].id);
      }
    } catch {
      // non-blocking
    } finally {
      setProvidersLoading(false);
    }
  }, [pid, selectedProviderId]);

  useEffect(() => {
    fetchJobs();
    fetchProviders();
  }, [fetchJobs, fetchProviders]);

  // ---- Polling (same page params) ----
  useEffect(() => {
    const hasActive = jobs.some((j) =>
      ACTIVE_JOB_STATUSES.includes(j.status)
    );

    if (hasActive && !pollRef.current) {
      pollRef.current = setInterval(fetchJobs, 5000);
    } else if (!hasActive && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [jobs, fetchJobs]);

  // ---- Page change ----
  function handlePageChange(newOffset: number, newLimit: number) {
    setOffset(newOffset);
    setLimit(newLimit);
    setLoading(true);
  }

  // ---- Start batch job ----
  function openStartModal() {
    // Reset selection to first active provider each time modal opens
    const active = providers.filter((p) => p.is_active);
    if (active.length > 0) setSelectedProviderId(active[0].id);
    setShowStartModal(true);
  }

  async function handleStart() {
    if (!selectedProviderId) return;
    setStarting(true);
    try {
      const job = await startBatchInference(pid, selectedProviderId);
      setShowStartModal(false);
      addToast(
        `Inference job #${job.id} started for ${job.total_items} images.`,
        "success"
      );
      await fetchJobs();
    } catch (err: unknown) {
      addToast(
        err instanceof Error ? err.message : "Failed to start inference job",
        "error"
      );
    } finally {
      setStarting(false);
    }
  }

  // ---- Cancel ----
  async function handleCancel() {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await cancelInferenceJob(pid, cancelTarget.id);
      setCancelTarget(null);
      await fetchJobs();
      addToast("Cancellation requested.", "success");
    } catch (err: unknown) {
      addToast(
        err instanceof Error ? err.message : "Failed to cancel job",
        "error"
      );
    } finally {
      setCancelling(false);
    }
  }

  // ---- Retry ----
  async function handleRetry() {
    if (!retryTarget) return;
    setRetrying(true);
    try {
      await retryInferenceJob(pid, retryTarget.id);
      setRetryTarget(null);
      await fetchJobs();
      addToast("Job retry queued.", "success");
    } catch (err: unknown) {
      addToast(
        err instanceof Error ? err.message : "Failed to retry job",
        "error"
      );
    } finally {
      setRetrying(false);
    }
  }

  // ---- Table columns ----
  const columns: Column<JobOutput>[] = [
    {
      key: "id",
      header: "Job",
      render: (job) => (
        <Link
          to={`/projects/${pid}/inference/${job.id}`}
          className="font-medium text-primary hover:underline tabular-nums"
        >
          #{job.id}
        </Link>
      ),
    },
    {
      key: "provider",
      header: "Provider",
      render: (job) => (
        <span className="text-muted-foreground">
          {providerMap.get(job.provider_id)?.name ??
            `Provider #${job.provider_id}`}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (job) => <JobStatusBadge status={job.status} />,
    },
    {
      key: "progress",
      header: "Progress",
      render: (job) => {
        const pct = progressPercent(job);
        return (
          <div className="flex items-center gap-2 min-w-[140px]">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  job.status === "failed"
                    ? "bg-red-500"
                    : job.status === "completed"
                      ? "bg-green-500"
                      : "bg-blue-500"
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground tabular-nums w-16 text-right">
              {job.completed_items}/{job.total_items}
            </span>
          </div>
        );
      },
    },
    {
      key: "annotations",
      header: "Annotations",
      className: "text-right",
      render: (job) => (
        <span className="tabular-nums">{job.annotations_created}</span>
      ),
    },
    {
      key: "created",
      header: "Created",
      render: (job) => (
        <span className="text-xs text-muted-foreground">
          {formatDate(job.created_at)}
        </span>
      ),
    },
  ];

  // Add actions column for supervisor
  if (isSupervisor) {
    columns.push({
      key: "actions",
      header: "Actions",
      render: (job) => (
        <div className="flex gap-1">
          {ACTIVE_JOB_STATUSES.includes(job.status) && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setCancelTarget(job);
              }}
              className="rounded border border-amber-300 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50"
            >
              Cancel
            </button>
          )}
          {job.status === "failed" && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setRetryTarget(job);
              }}
              className="rounded border px-2 py-1 text-xs font-medium text-foreground hover:bg-muted"
            >
              Retry
            </button>
          )}
        </div>
      ),
    });
  }

  // ---- Render ----
  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            View and manage batch auto-annotation runs. Start a job to run
            inference against all images in this project using a configured
            provider.
          </p>
        </div>
        {isSupervisor && (
          <button
            type="button"
            onClick={openStartModal}
            className="ml-4 shrink-0 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Start New Job
          </button>
        )}
      </div>

      {/* Error */}
      {error && <ErrorAlert message={error} onRetry={fetchJobs} />}

      {/* Job table */}
      {!loading && count === 0 ? (
        <div className="rounded-md border bg-muted/30 px-4 py-12 text-center text-sm text-muted-foreground">
          No inference jobs yet. Start one to auto-annotate all images in this
          project.
        </div>
      ) : (
        <PaginatedTable
          columns={columns}
          rows={jobs}
          pagination={{ count, limit, offset }}
          onPageChange={handlePageChange}
          isLoading={loading}
          getRowKey={(job) => job.id}
        />
      )}

      {/* Start job modal */}
      <Modal
        open={showStartModal}
        title="Start Inference Job"
        onClose={() => setShowStartModal(false)}
      >
        <p className="text-sm text-muted-foreground mb-4">
          This will run the selected provider against ALL images currently in
          this project. To target a subset, create a separate project.
        </p>
        <div className="space-y-3">
          <div className="space-y-1">
            <label
              htmlFor="inferProvider"
              className="text-xs font-medium text-foreground"
            >
              Provider
            </label>
            {providersLoading ? (
              <LoadingSpinner />
            ) : (
              <select
                id="inferProvider"
                value={selectedProviderId ?? ""}
                onChange={(e) =>
                  setSelectedProviderId(
                    e.target.value ? Number(e.target.value) : null
                  )
                }
                className="w-full rounded-md border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="" disabled>
                  Select a provider…
                </option>
                {providers
                  .filter((p) => p.is_active)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.is_global ? " (Global)" : ""}
                    </option>
                  ))}
              </select>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleStart}
              disabled={starting || !selectedProviderId}
              className="flex items-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {starting ? <LoadingSpinner /> : "Start"}
            </button>
            <button
              type="button"
              onClick={() => setShowStartModal(false)}
              disabled={starting}
              className="rounded-md border px-3 py-1.5 text-sm text-foreground hover:bg-muted disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      {/* Cancel confirmation */}
      <ConfirmDialog
        open={cancelTarget !== null}
        title="Cancel Inference Job"
        message={
          cancelTarget
            ? `Cancel job #${cancelTarget.id}? The worker will stop after finishing the current image.`
            : ""
        }
        confirmLabel={cancelling ? "Cancelling…" : "Cancel Job"}
        onConfirm={handleCancel}
        onCancel={() => setCancelTarget(null)}
      />

      {/* Retry confirmation */}
      <ConfirmDialog
        open={retryTarget !== null}
        title="Retry Inference Job"
        message={
          retryTarget
            ? `Retry failed items for job #${retryTarget.id}? Only failed and skipped items will be re-processed.`
            : ""
        }
        confirmLabel={retrying ? "Retrying…" : "Retry Job"}
        onConfirm={handleRetry}
        onCancel={() => setRetryTarget(null)}
      />
    </div>
  );
}
