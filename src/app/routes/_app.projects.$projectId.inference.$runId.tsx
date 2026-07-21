import { useMemo, useState } from "react";
import { useParams, useOutletContext, Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import {
  getInferenceRun,
  cancelInferenceRun,
  retryInferenceRun,
} from "@/api/inferenceRuns";
import { getInferenceProviders } from "@/api/inferenceProviders";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorAlert } from "@/components/shared/ErrorAlert";
import { RoleNotice } from "@/components/shared/RoleNotice";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { RunStatusBadge } from "@/components/inference/RunStatusBadge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useSetBreadcrumb } from "@/lib/breadcrumb";
import { cn } from "@/lib/utils";
import { queryKeys } from "@/lib/queryKeys";
import { ArrowLeft } from "lucide-react";
import type { ProjectContext } from "./_app.projects.$projectId";
import type { RunDetailOutput } from "@/types/inferenceRun";
import { ACTIVE_RUN_STATUSES, TERMINAL_RUN_STATUSES } from "@/types/inferenceRun";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function progressPercent(run: RunDetailOutput): number {
  if (run.total_items === 0) return 0;
  return Math.round((run.completed_items / run.total_items) * 100);
}

export default function ProjectInferenceRunDetailPage() {
  const { projectId, runId } = useParams();
  const pid = Number(projectId);
  const rid = Number(runId);
  const { project } = useOutletContext<ProjectContext>();

  const isSupervisor = project.my_role?.toLowerCase() === "supervisor";

  // Cancel
  const [cancelTarget, setCancelTarget] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Retry
  const [retryTarget, setRetryTarget] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const runQuery = useQuery({
    queryKey: queryKeys.inference.run(pid, rid),
    queryFn: ({ signal }) => getInferenceRun(pid, rid, { signal }),
    enabled: isSupervisor,
    refetchInterval: (query) => {
      const run = query.state.data;
      return run && !TERMINAL_RUN_STATUSES.includes(run.status) ? 5000 : false;
    },
  });

  const providersQuery = useQuery({
    queryKey: queryKeys.inference.providers(pid),
    queryFn: ({ signal }) =>
      getInferenceProviders(pid, { limit: 100 }, { signal }),
    enabled: isSupervisor,
  });

  const run = runQuery.data ?? null;
  const providers = providersQuery.data?.items ?? [];

  const providerMap = useMemo(
    () => new Map(providers.map((p) => [p.id, p])),
    [providers]
  );

  // Set breadcrumb
  useSetBreadcrumb("project", project.name);
  const runLabel = run ? `Run #${run.id}` : `Run #${rid}`;
  useSetBreadcrumb("inferenceRun", runLabel);

  if (!isSupervisor) {
    return <RoleNotice area="inference runs" />;
  }

  // ---- Cancel ----
  async function handleCancel() {
    setCancelling(true);
    try {
      await cancelInferenceRun(pid, rid);
      setCancelTarget(false);
      toast.success("Cancellation requested.");
      await runQuery.refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel run");
    } finally {
      setCancelling(false);
    }
  }

  // ---- Retry ----
  async function handleRetry() {
    setRetrying(true);
    try {
      await retryInferenceRun(pid, rid);
      setRetryTarget(false);
      toast.success("Run retry queued.");
      await runQuery.refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to retry run");
    } finally {
      setRetrying(false);
    }
  }

  // ---- Render ----
  if (runQuery.isPending) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Skeleton className="mb-4 h-7 w-48" />
        <Skeleton className="mb-3 h-4 w-full" />
        <Skeleton className="mb-3 h-4 w-11/12" />
        <Skeleton className="mb-3 h-4 w-3/4" />
        <Skeleton className="mb-6 h-6 w-full rounded-md" />
        <Skeleton className="mb-3 h-4 w-full" />
        <Skeleton className="mb-3 h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    );
  }

  if (runQuery.isError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <ErrorAlert
          message={runQuery.error.message}
          onRetry={() => void runQuery.refetch()}
        />
      </div>
    );
  }

  if (!run) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <p className="text-sm text-muted-foreground">Run not found.</p>
      </div>
    );
  }

  const provider = providerMap.get(run.provider_id);
  const pct = progressPercent(run);

  return (
    <div>
      {/* Back link */}
      <Link
        to={`/projects/${pid}/inference`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Inference Runs
      </Link>

      {/* Run metadata card */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle>Run #{run.id}</CardTitle>
              <RunStatusBadge status={run.status} />
            </div>
            <div className="flex items-center gap-2">
              {isSupervisor &&
                ACTIVE_RUN_STATUSES.includes(run.status) && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCancelTarget(true)}
                    className="border-amber-300 text-amber-700 hover:bg-amber-50 hover:text-amber-700"
                  >
                    Cancel
                  </Button>
                )}
              {isSupervisor && run.status === "failed" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setRetryTarget(true)}
                >
                  Retry
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Details grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <Detail label="Provider" value={provider?.name ?? `Provider #${run.provider_id}`} />
            <Detail label="Created" value={formatDate(run.created_at)} />
            <Detail label="Started" value={formatDate(run.started_at)} />
            <Detail label="Finished" value={formatDate(run.finished_at)} />
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>
                {run.completed_items} / {run.total_items} images (
                {run.failed_items} failed)
              </span>
              <span>{pct}%</span>
            </div>
            <Progress
              value={pct}
              className={cn(
                "h-2.5 [&>div]:transition-all [&>div]:duration-500",
                run.status === "failed" && "[&>div]:bg-red-500",
                run.status === "completed" && "[&>div]:bg-green-500",
                run.status !== "failed" &&
                  run.status !== "completed" &&
                  "[&>div]:bg-blue-500"
              )}
            />
          </div>

          {/* Stats row */}
          <div className="mt-3 flex items-center gap-6 text-xs text-muted-foreground">
            <span>Annotations created: <strong className="text-foreground">{run.annotations_created}</strong></span>
            {run.cancel_requested && (
              <span className="text-amber-600 font-medium">
                Cancellation requested — worker will stop after current task.
              </span>
            )}
          </div>

          {/* Error */}
          {run.error && (
            <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {run.error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tasks table */}
      <h3 className="text-sm font-semibold text-foreground mb-3">
        Tasks ({run.tasks.length})
      </h3>
      {run.tasks.length === 0 ? (
        <p className="text-xs text-muted-foreground">No tasks in this run.</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="px-3 py-2">
                  Image ID
                </TableHead>
                <TableHead className="px-3 py-2">
                  Status
                </TableHead>
                <TableHead className="px-3 py-2">
                  Annotations
                </TableHead>
                <TableHead className="px-3 py-2">
                  Attempts
                </TableHead>
                <TableHead className="px-3 py-2">Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {run.tasks.map((task) => (
                <TableRow
                  key={task.id}
                >
                  <TableCell className="px-3 py-2 tabular-nums text-foreground">
                    <Link
                      to={`/projects/${pid}/images/${task.image_id}/annotate`}
                      className="text-primary hover:underline"
                    >
                      {task.image_id}
                    </Link>
                  </TableCell>
                  <TableCell className="px-3 py-2">
                    <RunStatusBadge status={task.status} />
                  </TableCell>
                  <TableCell className="px-3 py-2 tabular-nums">
                    {task.annotations_created}
                  </TableCell>
                  <TableCell className="px-3 py-2 tabular-nums text-muted-foreground">
                    {task.attempts}
                  </TableCell>
                  <TableCell className="px-3 py-2 max-w-[240px] truncate text-xs text-muted-foreground">
                    {task.error || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Cancel confirmation */}
      <ConfirmDialog
        open={cancelTarget}
        title="Cancel Inference Run"
        message={`Cancel run #${run.id}? The worker will stop after finishing the current task.`}
        confirmLabel={cancelling ? "Cancelling…" : "Cancel Run"}
        onConfirm={handleCancel}
        onCancel={() => setCancelTarget(false)}
      />

      {/* Retry confirmation */}
      <ConfirmDialog
        open={retryTarget}
        title="Retry Inference Run"
        message={`Retry failed tasks for run #${run.id}? Only failed and skipped tasks will be re-processed.`}
        confirmLabel={retrying ? "Retrying…" : "Retry Run"}
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
