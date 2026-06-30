import { apiGet, apiPost } from "@/api/client";
import type { PaginatedResponse, PaginationParams } from "@/types/api";
import type { JobOutput, JobDetailOutput } from "@/types/inferenceJob";

/** Start auto-annotation for ALL images in the project using the given provider. */
export function startBatchInference(
  projectId: number,
  providerId: number
): Promise<JobOutput> {
  return apiPost<JobOutput>(
    `/api/projects/${projectId}/auto-annotate/`,
    { provider_id: providerId }
  );
}

/** List auto-annotation jobs for a project (most recent first). */
export function getInferenceJobs(
  projectId: number,
  params?: PaginationParams
): Promise<PaginatedResponse<JobOutput>> {
  return apiGet<PaginatedResponse<JobOutput>>(
    `/api/projects/${projectId}/auto-annotate/jobs`,
    params as Record<string, unknown>
  );
}

/** Get a single job with per-image item statuses. */
export function getInferenceJob(
  projectId: number,
  jobId: number
): Promise<JobDetailOutput> {
  return apiGet<JobDetailOutput>(
    `/api/projects/${projectId}/auto-annotate/jobs/${jobId}`
  );
}

/** Request cancellation of an in-progress job (cooperative — the worker checks between items). */
export function cancelInferenceJob(
  projectId: number,
  jobId: number
): Promise<JobOutput> {
  return apiPost<JobOutput>(
    `/api/projects/${projectId}/auto-annotate/jobs/${jobId}/cancel`
  );
}

/** Reset failed/skipped items to pending and resume a job. */
export function retryInferenceJob(
  projectId: number,
  jobId: number
): Promise<JobOutput> {
  return apiPost<JobOutput>(
    `/api/projects/${projectId}/auto-annotate/jobs/${jobId}/retry`
  );
}

/** Trigger server-driven inference for a single image (returns a slim job to poll). */
export function startSingleImageInference(
  projectId: number,
  imageId: number,
  providerId: number
): Promise<JobOutput> {
  return apiPost<JobOutput>(
    `/api/projects/${projectId}/images/${imageId}/auto-annotate/`,
    { provider_id: providerId }
  );
}
