/** Top-level job lifecycle status. */
export type JobStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelling"
  | "cancelled";

/** Per-image job-item status. */
export type JobItemStatus =
  | "pending"
  | "running"
  | "done"
  | "failed"
  | "skipped";

/** Summary of a batch or single-image auto-annotation job. */
export interface JobOutput {
  id: number;
  project_id: number;
  provider_id: number;
  status: JobStatus;
  total_items: number;
  completed_items: number;
  failed_items: number;
  annotations_created: number;
  cancel_requested: boolean;
  error: string;
  created_by_id: number;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

/** One image's workload inside a job. */
export interface JobItemOutput {
  id: number;
  image_id: number;
  status: JobItemStatus;
  annotations_created: number;
  attempts: number;
  error: string;
}

/** Job detail includes per-image item statuses. */
export interface JobDetailOutput extends JobOutput {
  items: JobItemOutput[];
}

/** Terminal job statuses — polling stops when the job reaches one of these. */
export const TERMINAL_JOB_STATUSES: JobStatus[] = [
  "completed",
  "failed",
  "cancelled",
];

/** Job statuses that indicate the job is still in flight. */
export const ACTIVE_JOB_STATUSES: JobStatus[] = [
  "pending",
  "running",
  "cancelling",
];
