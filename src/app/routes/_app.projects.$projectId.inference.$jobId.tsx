import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useParams, useOutletContext, Link } from "react-router";
import {
  getInferenceJob,
  cancelInferenceJob,
  retryInferenceJob,
} from "@/api/inferenceJobs";
import { getInferenceProviders } from "@/api/inferenceProviders";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { ErrorAlert } from "@/components/shared/ErrorAlert";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { JobStatusBadge } from "@/components/inference/JobStatusBadge";
import { useToastStore } from "@/stores/toastStore";
import { useSetBreadcrumb } from "@/lib/breadcrumb";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import type { ProjectContext } from "./_app.projects.$projectId";
import type { InferenceProviderOutput } from "@/types/inferenceProvider";
import type { JobDetailOutput } from "@/types/inferenceJob";
import { ACTIVE_JOB_STATUSES, TERMINAL_JOB_STATUSES } from "@/types/inferenceJob";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function progressPercent(job: JobDetailOutput): number {
  if (job.total_items === 0) return 0;
  return Math.round((job.completed_items / job.total_items) * 100);
}

export default function ProjectInferenceJobDetailPage() {
  const { projectId, jobId } = useParams();
  const pid = Number(projectId);
  const jid = Number(jobId);
  const { project } = useOutletContext<ProjectContext>();
  const addToast = useToastStore((s) => s.addToast);

  const isSupervisor = project.my_role?.toLowerCase() === "supervisor";

  const [job, setJob] = useState<JobDetailOutput | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Providers (for name lookup)
  const [providers, setProviders] = useState<InferenceProviderOutput[]>([]);

  // Cancel
  const [cancelTarget, setCancelTarget] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Retry
  const [retryTarget, setRetryTarget] = useState(false);
  const [retrying, setRetrying] = useState(false);

  // Polling
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const providerMap = useMemo(
    () => new Map(providers.map((p) => [p.id, p])),
    [providers]
  );

  // Set breadcrumb
  useSetBreadcrumb("project", project.name);
  const jobLabel = job ? `Job #${job.id}` : `Job #${jid}`;
  useSetBreadcrumb("inferenceJob", jobLabel);

  const fetchJob = useCallback(async () => {
    try {
      const detail = await getInferenceJob(pid, jid);
      setJob(detail);
      setError("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load job");
    } finally {
      setLoading(false);
    }
  }, [pid, jid]);

  const fetchProviders = useCallback(async () => {
    try {
      const resp = await getInferenceProviders(pid, { limit: 100 });
      setProviders(resp.items);
    } catch {
      // non-blocking
    }
  }, [pid]);

  useEffect(() => {
    fetchJob();
    fetchProviders();
  }, [fetchJob, fetchProviders]);

  // Polling while job is active
  useEffect(() => {
    if (!job || TERMINAL_JOB_STATUSES.includes(job.status)) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    if (!pollRef.current) {
      pollRef.current = setInterval(fetchJob, 5000);
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [job, fetchJob]);

  // ---- Cancel ----
  async function handleCancel() {
    setCancelling(true);
    try {
      await cancelInferenceJob(pid, jid);
      setCancelTarget(false);
      addToast("Cancellation requested.", "success");
      await fetchJob();
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
    setRetrying(true);
    try {
      await retryInferenceJob(pid, jid);
      setRetryTarget(false);
      addToast("Job retry queued.", "success");
      await fetchJob();
    } catch (err: unknown) {
      addToast(
        err instanceof Error ? err.message : "Failed to retry job",
        "error"
      );
    } finally {
      setRetrying(false);
    }
  }

  // ---- Render ----
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <ErrorAlert message={error} onRetry={fetchJob} />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <p className="text-sm text-muted-foreground">Job not found.</p>
      </div>
    );
  }

  const provider = providerMap.get(job.provider_id);
  const pct = progressPercent(job);

  return (
    <div>
      {/* Back link */}
      <Link
        to={`/projects/${pid}/inference`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Inference Jobs
      </Link>

      {/* Job metadata card */}
      <div className="rounded-md border bg-card p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-foreground">
              Job #{job.id}
            </h2>
            <JobStatusBadge status={job.status} />
          </div>
          <div className="flex items-center gap-2">
            {isSupervisor &&
              ACTIVE_JOB_STATUSES.includes(job.status) && (
                <button
                  type="button"
                  onClick={() => setCancelTarget(true)}
                  className="rounded border border-amber-300 px-3 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50"
                >
                  Cancel
                </button>
              )}
            {isSupervisor && job.status === "failed" && (
              <button
                type="button"
                onClick={() => setRetryTarget(true)}
                className="rounded border px-3 py-1 text-xs font-medium text-foreground hover:bg-muted"
              >
                Retry
              </button>
            )}
          </div>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <Detail label="Provider" value={provider?.name ?? `Provider #${job.provider_id}`} />
          <Detail label="Created" value={formatDate(job.created_at)} />
          <Detail label="Started" value={formatDate(job.started_at)} />
          <Detail label="Finished" value={formatDate(job.finished_at)} />
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>
              {job.completed_items} / {job.total_items} images (
              {job.failed_items} failed)
            </span>
            <span>{pct}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                job.status === "failed"
                  ? "bg-red-500"
                  : job.status === "completed"
                    ? "bg-green-500"
                    : "bg-blue-500"
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-3 flex items-center gap-6 text-xs text-muted-foreground">
          <span>Annotations created: <strong className="text-foreground">{job.annotations_created}</strong></span>
          {job.cancel_requested && (
            <span className="text-amber-600 font-medium">
              Cancellation requested — worker will stop after current image.
            </span>
          )}
        </div>

        {/* Error */}
        {job.error && (
          <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {job.error}
          </div>
        )}
      </div>

      {/* Items table */}
      <h3 className="text-sm font-semibold text-foreground mb-3">
        Items ({job.items.length})
      </h3>
      {job.items.length === 0 ? (
        <p className="text-xs text-muted-foreground">No items in this job.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="px-3 py-2 font-medium text-foreground">
                  Image ID
                </th>
                <th className="px-3 py-2 font-medium text-foreground">
                  Status
                </th>
                <th className="px-3 py-2 font-medium text-foreground">
                  Annotations
                </th>
                <th className="px-3 py-2 font-medium text-foreground">
                  Attempts
                </th>
                <th className="px-3 py-2 font-medium text-foreground">Error</th>
              </tr>
            </thead>
            <tbody>
              {job.items.map((item) => (
                <tr
                  key={item.id}
                  className="border-b last:border-b-0 hover:bg-muted/30"
                >
                  <td className="px-3 py-2 tabular-nums text-foreground">
                    <Link
                      to={`/projects/${pid}/images/${item.image_id}/annotate`}
                      className="text-primary hover:underline"
                    >
                      {item.image_id}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <JobStatusBadge status={item.status} />
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {item.annotations_created}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">
                    {item.attempts}
                  </td>
                  <td className="px-3 py-2 max-w-[240px] truncate text-xs text-muted-foreground">
                    {item.error || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Cancel confirmation */}
      <ConfirmDialog
        open={cancelTarget}
        title="Cancel Inference Job"
        message={`Cancel job #${job.id}? The worker will stop after finishing the current image.`}
        confirmLabel={cancelling ? "Cancelling…" : "Cancel Job"}
        onConfirm={handleCancel}
        onCancel={() => setCancelTarget(false)}
      />

      {/* Retry confirmation */}
      <ConfirmDialog
        open={retryTarget}
        title="Retry Inference Job"
        message={`Retry failed items for job #${job.id}? Only failed and skipped items will be re-processed.`}
        confirmLabel={retrying ? "Retrying…" : "Retry Job"}
        onConfirm={handleRetry}
        onCancel={() => setRetryTarget(false)}
      />
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs text-muted-foreground">{label}</span>
      <p className="text-foreground">{value}</p>
    </div>
  );
}
