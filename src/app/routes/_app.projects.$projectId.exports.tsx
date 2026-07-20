import { useState } from "react";
import { useParams, useOutletContext } from "react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  getExportTasks,
  createExport,
  downloadExportFile,
  deleteExportFile,
} from "@/api/exports";
import {
  PaginatedTable,
  type Column,
} from "@/components/shared/PaginatedTable";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { SkeletonTable } from "@/components/shared/SkeletonTable";
import { ErrorAlert } from "@/components/shared/ErrorAlert";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Switch } from "@/components/ui/switch";
import { DatePicker } from "@/components/ui/date-picker";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { normalizeError } from "@/lib/utils/errors";
import { queryKeys } from "@/lib/queryKeys";
import type { ProjectContext } from "./_app.projects.$projectId";
import type { ExportTaskOutput, ExportStatus } from "@/types/export";
import { ACTIVE_EXPORT_STATUSES } from "@/types/export";
import { DownloadIcon, Trash2Icon } from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

const STATUS_STYLES: Record<ExportStatus, string> = {
  pending: "bg-gray-100 text-gray-600 border-gray-200",
  running: "bg-blue-100 text-blue-700 border-blue-200",
  completed: "bg-green-100 text-green-700 border-green-200",
  failed: "bg-red-100 text-red-700 border-red-200",
  cancelled: "bg-muted text-muted-foreground border-muted-foreground/20",
  expired: "bg-amber-100 text-amber-700 border-amber-200",
};

function ExportStatusBadge({ status }: { status: ExportStatus }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.pending;
  return (
    <Badge variant="outline" className={cn("gap-1.5 px-2.5", style)}>
      {status}
    </Badge>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

export default function ProjectExportsPage() {
  const { projectId } = useParams();
  const pid = Number(projectId);
  const { project } = useOutletContext<ProjectContext>();

  const isSupervisor = project.my_role?.toLowerCase() === "supervisor";

  const [limit, setLimit] = useState(20);
  const [offset, setOffset] = useState(0);

  const [showStartModal, setShowStartModal] = useState(false);
  const [format, setFormat] = useState<"coco" | "yolo">("coco");
  const [includeImages, setIncludeImages] = useState(false);
  const [expiresAt, setExpiresAt] = useState<Date | undefined>(undefined);
  const [starting, setStarting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ExportTaskOutput | null>(null);
  const [deleting, setDeleting] = useState(false);

  const tasksQuery = useQuery({
    queryKey: queryKeys.exports.list(pid, limit, offset),
    queryFn: ({ signal }) => getExportTasks(pid, { limit, offset }, { signal }),
    placeholderData: keepPreviousData,
    refetchInterval: (query) =>
      query.state.data?.items.some((task) =>
        ACTIVE_EXPORT_STATUSES.includes(task.status)
      )
        ? 3000
        : false,
  });

  const tasks = tasksQuery.data?.items ?? [];
  const count = tasksQuery.data?.count ?? 0;

  function handlePageChange(newOffset: number, newLimit: number) {
    setOffset(newOffset);
    setLimit(newLimit);
  }

  async function handleCreate() {
    setStarting(true);
    try {
      const payload: Parameters<typeof createExport>[1] = {
        format,
        include_images: includeImages,
      };
      if (expiresAt) {
        payload.expires_at = expiresAt.toISOString();
      }
      const task = await createExport(pid, payload);
      setShowStartModal(false);
      toast.success(`Export task #${task.id} started (${task.format}).`);
      await tasksQuery.refetch();
    } catch (err: unknown) {
      toast.error(normalizeError(err).message);
    } finally {
      setStarting(false);
    }
  }

  async function handleDownload(task: ExportTaskOutput) {
    try {
      await downloadExportFile(pid, task.id);
    } catch (err: unknown) {
      toast.error(normalizeError(err).message);
    }
  }

  async function handleDeleteFile() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteExportFile(pid, deleteTarget.id);
      setDeleteTarget(null);
      toast.success("Export file deleted.");
      await tasksQuery.refetch();
    } catch (err: unknown) {
      toast.error(normalizeError(err).message);
    } finally {
      setDeleting(false);
    }
  }

  const columns: Column<ExportTaskOutput>[] = [
    {
      key: "id",
      header: "Task",
      render: (task) => (
        <span className="font-medium tabular-nums">#{task.id}</span>
      ),
    },
    {
      key: "format",
      header: "Format",
      render: (task) => (
        <Badge variant="secondary" className="uppercase text-xs">
          {task.format}
        </Badge>
      ),
    },
    {
      key: "include_images",
      header: "Images",
      render: (task) => (
        <span className="text-xs text-muted-foreground">
          {task.include_images ? "Yes" : "No"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (task) => <ExportStatusBadge status={task.status} />,
    },
    {
      key: "error",
      header: "Error",
      render: (task) =>
        task.error ? (
          <span
            className="block max-w-[200px] truncate text-xs text-red-600"
            title={task.error}
          >
            {task.error}
          </span>
        ) : null,
    },
    {
      key: "created",
      header: "Created",
      render: (task) => (
        <span className="text-xs text-muted-foreground">
          {formatDate(task.created_at)}
        </span>
      ),
    },
  ];

  columns.push({
    key: "actions",
    header: "",
    className: "w-[60px]",
    render: (task) => (
      <div className="flex gap-0.5">
        {task.status === "completed" && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload(task);
                }}
              >
                <DownloadIcon className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Download</TooltipContent>
          </Tooltip>
        )}
        {isSupervisor && task.status === "completed" && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteTarget(task);
                }}
              >
                <Trash2Icon className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Delete File</TooltipContent>
          </Tooltip>
        )}
      </div>
    ),
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Export all active annotations in this project to COCO JSON or YOLO
            format. Exported files are available for 24 hours.
          </p>
        </div>
        {isSupervisor && (
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setFormat("coco");
              setIncludeImages(false);
              setExpiresAt(undefined);
              setShowStartModal(true);
            }}
            className="ml-4 shrink-0"
          >
            New Export
          </Button>
        )}
      </div>

      {tasksQuery.isError && (
        <ErrorAlert
          message={tasksQuery.error.message}
          onRetry={() => void tasksQuery.refetch()}
        />
      )}

      {tasksQuery.isPending ? (
        <SkeletonTable rows={4} />
      ) : !tasksQuery.isFetching && count === 0 ? (
        <div className="rounded-md border bg-muted/30 px-4 py-12 text-center text-sm text-muted-foreground">
          No export tasks yet. Create one to export annotations in COCO or YOLO
          format.
        </div>
      ) : (
        <PaginatedTable
          columns={columns}
          rows={tasks}
          pagination={{ count, limit, offset }}
          onPageChange={handlePageChange}
          isLoading={tasksQuery.isFetching && count > 0}
          getRowKey={(task) => task.id}
        />
      )}

      <Dialog
        open={showStartModal}
        onOpenChange={(next) => {
          if (!next) setShowStartModal(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Export</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Export all active annotations across all images in this project.
              The generated file will be available for download for 24 hours.
            </p>

            <Field>
              <FieldLabel htmlFor="exportFormat">Format</FieldLabel>
              <Select
                value={format}
                onValueChange={(v) => setFormat(v as "coco" | "yolo")}
              >
                <SelectTrigger id="exportFormat" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="coco">COCO JSON</SelectItem>
                    <SelectItem value="yolo">YOLO</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            <div className="flex items-center justify-between gap-4">
              <div>
                <span className="text-sm font-medium">Include Images</span>
                <p className="text-xs text-muted-foreground">
                  Bundle original images in the export zip
                </p>
              </div>
              <Switch
                checked={includeImages}
                onCheckedChange={setIncludeImages}
              />
            </div>

            <Field>
              <FieldLabel>Expiry Date</FieldLabel>
              <DatePicker
                date={expiresAt}
                onDateChange={setExpiresAt}
                placeholder="Default (24h)"
                fromDate={new Date()}
              />
              <p className="text-xs text-muted-foreground">
                If no date is selected, the export file will automatically
                expire after 24 hours.
              </p>
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
              onClick={handleCreate}
              disabled={starting}
            >
              {starting ? <LoadingSpinner /> : "Start Export"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete Export File"
        message={
          deleteTarget
            ? `Delete the export file for task #${deleteTarget.id}? The task record will be kept but the file will be permanently removed.`
            : ""
        }
        confirmLabel={deleting ? "Deleting…" : "Delete File"}
        onConfirm={handleDeleteFile}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
