/** Top-level run lifecycle status. */
export type RunStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelling"
  | "cancelled";

/** Per-image task status. */
export type TaskStatus =
  | "pending"
  | "running"
  | "done"
  | "failed"
  | "skipped";

/** Result status within a task. */
export type ResultStatus = "proposed" | "committed" | "rejected";

/** Summary of a batch or single-image auto-annotation run. */
export interface RunOutput {
  id: number;
  project_id: number;
  provider_id: number;
  status: RunStatus;
  provider_snapshot: Record<string, unknown>;
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

/** One image's unit of work within a run. */
export interface TaskOutput {
  id: number;
  run_id: number;
  image_id: number;
  status: TaskStatus;
  annotations_created: number;
  attempts: number;
  error: string;
}

/** Run detail includes per-image task statuses. */
export interface RunDetailOutput extends RunOutput {
  tasks: TaskOutput[];
}

/** One candidate result the model returned for a single image. */
export interface ResultOutput {
  id: number;
  result_index: number;
  result_type: string;
  label: number | null;
  score: number | null;
  result_data: Record<string, unknown>;
  annotation_id: number | null;
  status: ResultStatus;
  created_at: string;
  committed_at: string | null;
  rejected_at: string | null;
}

/** Task detail includes candidate results. */
export interface TaskDetailOutput extends TaskOutput {
  results: ResultOutput[];
}

/** Terminal run statuses — polling stops when the run reaches one of these. */
export const TERMINAL_RUN_STATUSES: RunStatus[] = [
  "completed",
  "failed",
  "cancelled",
];

/** Run statuses that indicate the run is still in flight. */
export const ACTIVE_RUN_STATUSES: RunStatus[] = [
  "pending",
  "running",
  "cancelling",
];
