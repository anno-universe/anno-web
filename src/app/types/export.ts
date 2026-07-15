export type ExportFormat = "coco" | "yolo";

export type ExportStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export const TERMINAL_EXPORT_STATUSES: ExportStatus[] = [
  "completed",
  "failed",
  "cancelled",
];

export const ACTIVE_EXPORT_STATUSES: ExportStatus[] = [
  "pending",
  "running",
];

export interface ExportCreateInput {
  format: ExportFormat;
  include_images?: boolean;
  expires_at?: string | null;
}

export interface ExportTaskOutput {
  id: number;
  project_id: number;
  created_by_id: number;
  format: ExportFormat;
  include_images: boolean;
  status: ExportStatus;
  expires_at: string | null;
  error: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface ExportTaskResultOutput {
  file_name: string;
  file_size: number;
  file_available: boolean;
  file_deleted_at: string | null;
  created_at: string;
}

export interface ExportTaskDetailOutput extends ExportTaskOutput {
  result: ExportTaskResultOutput | null;
}
