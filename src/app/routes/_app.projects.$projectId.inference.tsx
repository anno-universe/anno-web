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
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
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
import { JobStatusBadge } from "@/components/inference/JobStatusBadge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
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
      toast.success(`Inference job #${job.id} started for ${job.total_items} images.`);
      await fetchJobs();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to start inference job");
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
      toast.success("Cancellation requested.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel job");
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
      toast.success("Job retry queued.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to retry job");
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
            <Progress
              value={pct}
              className={cn(
                "h-1.5 flex-1 [&>div]:transition-all",
                job.status === "failed" && "[&>div]:bg-red-500",
                job.status === "completed" && "[&>div]:bg-green-500",
                job.status !== "failed" &&
                  job.status !== "completed" &&
                  "[&>div]:bg-blue-500"
              )}
            />
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
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={(e) => {
                e.stopPropagation();
                setCancelTarget(job);
              }}
              className="border-amber-300 text-amber-700 hover:bg-amber-50 hover:text-amber-700"
            >
              Cancel
            </Button>
          )}
          {job.status === "failed" && (
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={(e) => {
                e.stopPropagation();
                setRetryTarget(job);
              }}
            >
              Retry
            </Button>
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
          <Button
            type="button"
            size="sm"
            onClick={openStartModal}
            className="ml-4 shrink-0"
          >
            Start New Job
          </Button>
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
      <Dialog
        open={showStartModal}
        onOpenChange={(next) => {
          if (!next) setShowStartModal(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start Inference Job</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This will run the selected provider against ALL images currently in
              this project. To target a subset, create a separate project.
            </p>
            <Field>
              <FieldLabel htmlFor="inferProvider">Provider</FieldLabel>
              {providersLoading ? (
                <LoadingSpinner />
              ) : (
                <Select
                  value={
                    selectedProviderId != null
                      ? String(selectedProviderId)
                      : undefined
                  }
                  onValueChange={(v) =>
                    setSelectedProviderId(v ? Number(v) : null)
                  }
                >
                  <SelectTrigger id="inferProvider" className="w-full">
                    <SelectValue placeholder="Select a provider…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {providers
                        .filter((p) => p.is_active)
                        .map((p) => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            {p.name}
                            {p.is_global ? " (Global)" : ""}
                          </SelectItem>
                        ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
            </Field>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowStartModal(false)}
              disabled={starting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleStart}
              disabled={starting || !selectedProviderId}
            >
              {starting ? <LoadingSpinner /> : "Start"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
