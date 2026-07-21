import { useMemo, useState } from "react";
import { useParams, useOutletContext, Link } from "react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  getInferenceRuns,
  startBatchInference,
  cancelInferenceRun,
  retryInferenceRun,
} from "@/api/inferenceRuns";
import { getInferenceProviders } from "@/api/inferenceProviders";
import {
  PaginatedTable,
  type Column,
} from "@/components/shared/PaginatedTable";
import { LoadingSpinner, Spinner } from "@/components/shared/LoadingSpinner";
import { SkeletonTable } from "@/components/shared/SkeletonTable";
import { ErrorAlert } from "@/components/shared/ErrorAlert";
import { RoleNotice } from "@/components/shared/RoleNotice";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
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
import { RunStatusBadge } from "@/components/inference/RunStatusBadge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { normalizeError } from "@/lib/utils/errors";
import { queryKeys } from "@/lib/queryKeys";
import { RotateCw } from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import type { ProjectContext } from "./_app.projects.$projectId";
import type { RunOutput } from "@/types/inferenceRun";
import { ACTIVE_RUN_STATUSES } from "@/types/inferenceRun";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function progressPercent(run: RunOutput): number {
  if (run.total_items === 0) return 0;
  return Math.round((run.completed_items / run.total_items) * 100);
}

export default function ProjectInferencePage() {
  const { projectId } = useParams();
  const pid = Number(projectId);
  const { project } = useOutletContext<ProjectContext>();

  const isSupervisor = project.my_role?.toLowerCase() === "supervisor";

  const [limit, setLimit] = useState(20);
  const [offset, setOffset] = useState(0);

  // Start new job modal
  const [showStartModal, setShowStartModal] = useState(false);
  const [selectedProviderId, setSelectedProviderId] = useState<number | null>(
    null
  );
  const [starting, setStarting] = useState(false);

  // Cancel
  const [cancelTarget, setCancelTarget] = useState<RunOutput | null>(null);
  const [cancelling, setCancelling] = useState(false);

  // Retry
  const [retryTarget, setRetryTarget] = useState<RunOutput | null>(null);
  const [retrying, setRetrying] = useState(false);

  const runsQuery = useQuery({
    queryKey: queryKeys.inference.runs(pid, limit, offset),
    queryFn: ({ signal }) =>
      getInferenceRuns(pid, { limit, offset }, { signal }),
    enabled: isSupervisor,
    placeholderData: keepPreviousData,
    refetchInterval: (query) =>
      query.state.data?.items.some((run) =>
        ACTIVE_RUN_STATUSES.includes(run.status)
      )
        ? 5000
        : false,
  });

  const providersQuery = useQuery({
    queryKey: queryKeys.inference.providers(pid),
    queryFn: ({ signal }) =>
      getInferenceProviders(pid, { limit: 100 }, { signal }),
    enabled: isSupervisor,
  });

  const runs = runsQuery.data?.items ?? [];
  const count = runsQuery.data?.count ?? 0;
  const providers = providersQuery.data?.items ?? [];

  // Provider lookup map
  const providerMap = useMemo(
    () => new Map(providers.map((p) => [p.id, p])),
    [providers]
  );

  if (!isSupervisor) {
    return <RoleNotice area="inference runs" />;
  }

  // ---- Page change ----
  function handlePageChange(newOffset: number, newLimit: number) {
    setOffset(newOffset);
    setLimit(newLimit);
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
      const run = await startBatchInference(pid, selectedProviderId);
      setShowStartModal(false);
      toast.success(`Inference run #${run.id} started for ${run.total_items} images.`);
      await runsQuery.refetch();
    } catch (err: unknown) {
      toast.error(normalizeError(err).message);
    } finally {
      setStarting(false);
    }
  }

  // ---- Cancel ----
  async function handleCancel() {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await cancelInferenceRun(pid, cancelTarget.id);
      setCancelTarget(null);
      await runsQuery.refetch();
      toast.success("Cancellation requested.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel run");
    } finally {
      setCancelling(false);
    }
  }

  // ---- Retry ----
  async function handleRetry() {
    if (!retryTarget) return;
    setRetrying(true);
    try {
      await retryInferenceRun(pid, retryTarget.id);
      setRetryTarget(null);
      await runsQuery.refetch();
      toast.success("Run retry queued.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to retry run");
    } finally {
      setRetrying(false);
    }
  }

  // ---- Table columns ----
  const columns: Column<RunOutput>[] = [
    {
      key: "id",
      header: "Run",
      render: (run) => (
        <Link
          to={`/projects/${pid}/inference/${run.id}`}
          className="font-medium text-primary hover:underline tabular-nums"
        >
          #{run.id}
        </Link>
      ),
    },
    {
      key: "provider",
      header: "Provider",
      render: (run) => (
        <span className="text-muted-foreground">
          {providerMap.get(run.provider_id)?.name ??
            `Provider #${run.provider_id}`}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (run) => <RunStatusBadge status={run.status} />,
    },
    {
      key: "progress",
      header: "Progress",
      render: (run) => {
        const pct = progressPercent(run);
        return (
          <div className="flex items-center gap-2 min-w-[140px]">
            <Progress
              value={pct}
              className={cn(
                "h-1.5 flex-1 [&>div]:transition-all",
                run.status === "failed" && "[&>div]:bg-red-500",
                run.status === "completed" && "[&>div]:bg-green-500",
                run.status !== "failed" &&
                  run.status !== "completed" &&
                  "[&>div]:bg-blue-500"
              )}
            />
            <span className="text-xs text-muted-foreground tabular-nums w-16 text-right">
              {run.completed_items}/{run.total_items}
            </span>
          </div>
        );
      },
    },
    {
      key: "annotations",
      header: "Annotations",
      className: "text-right",
      render: (run) => (
        <span className="tabular-nums">{run.annotations_created}</span>
      ),
    },
    {
      key: "created",
      header: "Created",
      render: (run) => (
        <span className="text-xs text-muted-foreground">
          {formatDate(run.created_at)}
        </span>
      ),
    },
  ];

  // Add actions column for supervisor
  if (isSupervisor) {
    columns.push({
      key: "actions",
      header: "",
      className: "w-[60px]",
      render: (run) => (
        <div className="flex gap-0.5">
          {ACTIVE_RUN_STATUSES.includes(run.status) && (
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={(e) => {
                e.stopPropagation();
                setCancelTarget(run);
              }}
              className="border-amber-300 text-amber-700 hover:bg-amber-50 hover:text-amber-700"
            >
              Cancel
            </Button>
          )}
          {run.status === "failed" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    setRetryTarget(run);
                  }}
                >
                  <RotateCw className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Retry</TooltipContent>
            </Tooltip>
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
            View and manage batch auto-annotation runs. Start a run to process
            all images in this project using a configured provider.
          </p>
        </div>
        {isSupervisor && (
          <Button
            type="button"
            size="sm"
            onClick={openStartModal}
            className="ml-4 shrink-0"
          >
            Start New Run
          </Button>
        )}
      </div>

      {/* Error */}
      {runsQuery.isError && (
        <ErrorAlert
          message={runsQuery.error.message}
          onRetry={() => void runsQuery.refetch()}
        />
      )}

      {/* Job table */}
      {runsQuery.isPending ? (
        <SkeletonTable rows={4} />
      ) : !runsQuery.isFetching && count === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No inference runs yet</EmptyTitle>
            <EmptyDescription>
              Start one to auto-annotate all images in this project.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <PaginatedTable
          columns={columns}
          rows={runs}
          pagination={{ count, limit, offset }}
          onPageChange={handlePageChange}
          isLoading={runsQuery.isFetching && count > 0}
          getRowKey={(run) => run.id}
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
            <DialogTitle>Start Inference Run</DialogTitle>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              handleStart();
            }}
          >
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This will run the selected provider against all images currently
                in this project. To target a subset, create a separate project.
              </p>
              <Field>
                <FieldLabel htmlFor="inferProvider">Provider</FieldLabel>
                {providersQuery.isPending ? (
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
                type="submit"
                disabled={starting || !selectedProviderId}
              >
                {starting ? <Spinner /> : "Start"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Cancel confirmation */}
      <ConfirmDialog
        open={cancelTarget !== null}
        title="Cancel Inference Run"
        message={
          cancelTarget
            ? `Cancel run #${cancelTarget.id}? The worker will stop after finishing the current task.`
            : ""
        }
        confirmLabel={cancelling ? "Cancelling…" : "Cancel Run"}
        onConfirm={handleCancel}
        onCancel={() => setCancelTarget(null)}
      />

      {/* Retry confirmation */}
      <ConfirmDialog
        open={retryTarget !== null}
        title="Retry Inference Run"
        message={
          retryTarget
            ? `Retry failed tasks for run #${retryTarget.id}? Only failed and skipped tasks will be re-processed.`
            : ""
        }
        confirmLabel={retrying ? "Retrying…" : "Retry Run"}
        onConfirm={handleRetry}
        onCancel={() => setRetryTarget(null)}
      />
    </div>
  );
}
