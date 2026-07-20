import { apiGet, apiPost } from "@/api/client";
import type { ApiRequestOptions } from "@/api/client";
import type { PaginatedResponse, PaginationParams } from "@/types/api";
import type {
  RunOutput,
  RunDetailOutput,
  TaskDetailOutput,
} from "@/types/inferenceRun";

/** Start auto-annotation for ALL images in the project using the given provider. */
export function startBatchInference(
  projectId: number,
  providerId: number
): Promise<RunOutput> {
  return apiPost<RunOutput>(
    `/api/projects/${projectId}/auto-annotate/`,
    { provider_id: providerId }
  );
}

/** List auto-annotation runs for a project (most recent first). */
export function getInferenceRuns(
  projectId: number,
  params?: PaginationParams,
  options?: ApiRequestOptions
): Promise<PaginatedResponse<RunOutput>> {
  return apiGet<PaginatedResponse<RunOutput>>(
    `/api/projects/${projectId}/auto-annotate/runs`,
    params as Record<string, unknown>,
    options
  );
}

/** Get a single run with per-image task statuses. */
export function getInferenceRun(
  projectId: number,
  runId: number,
  options?: ApiRequestOptions
): Promise<RunDetailOutput> {
  return apiGet<RunDetailOutput>(
    `/api/projects/${projectId}/auto-annotate/runs/${runId}`,
    undefined,
    options
  );
}

/** Request cancellation of an in-progress run (cooperative — the worker checks between tasks). */
export function cancelInferenceRun(
  projectId: number,
  runId: number
): Promise<RunOutput> {
  return apiPost<RunOutput>(
    `/api/projects/${projectId}/auto-annotate/runs/${runId}/cancel`
  );
}

/** Reset failed/skipped tasks to pending and resume a run. */
export function retryInferenceRun(
  projectId: number,
  runId: number
): Promise<RunOutput> {
  return apiPost<RunOutput>(
    `/api/projects/${projectId}/auto-annotate/runs/${runId}/retry`
  );
}

/** Trigger server-driven inference for a single image (returns a Run with total_items=1). */
export function startSingleImageInference(
  projectId: number,
  imageId: number,
  providerId: number
): Promise<RunOutput> {
  return apiPost<RunOutput>(
    `/api/projects/${projectId}/images/${imageId}/auto-annotate/`,
    { provider_id: providerId }
  );
}

/** Poll a single-image inference run via the image-scoped endpoint. */
export function getInferenceRunForImage(
  projectId: number,
  imageId: number,
  runId: number,
  options?: ApiRequestOptions
): Promise<RunDetailOutput> {
  return apiGet<RunDetailOutput>(
    `/api/projects/${projectId}/images/${imageId}/auto-annotate/runs/${runId}`,
    undefined,
    options
  );
}

/** Get a single task with its candidate results. */
export function getInferenceTask(
  projectId: number,
  runId: number,
  taskId: number
): Promise<TaskDetailOutput> {
  return apiGet<TaskDetailOutput>(
    `/api/projects/${projectId}/auto-annotate/runs/${runId}/tasks/${taskId}`
  );
}
