import { apiGet, apiPost, apiPatch, apiDelete } from "@/api/client";
import type { ApiRequestOptions } from "@/api/client";
import type { PaginatedResponse, PaginationParams } from "@/types/api";
import type {
  InferenceProviderOutput,
  InferenceProviderCreateInput,
  InferenceProviderUpdateInput,
} from "@/types/inferenceProvider";

export function getInferenceProviders(
  projectId: number,
  params?: PaginationParams,
  options?: ApiRequestOptions
): Promise<PaginatedResponse<InferenceProviderOutput>> {
  return apiGet<PaginatedResponse<InferenceProviderOutput>>(
    `/api/projects/${projectId}/inference-providers/`,
    params as Record<string, unknown>,
    options
  );
}

export function createInferenceProvider(
  projectId: number,
  input: InferenceProviderCreateInput
): Promise<InferenceProviderOutput> {
  return apiPost<InferenceProviderOutput>(
    `/api/projects/${projectId}/inference-providers/`,
    input
  );
}

export function getInferenceProvider(
  projectId: number,
  providerId: number
): Promise<InferenceProviderOutput> {
  return apiGet<InferenceProviderOutput>(
    `/api/projects/${projectId}/inference-providers/${providerId}`
  );
}

export function updateInferenceProvider(
  projectId: number,
  providerId: number,
  input: InferenceProviderUpdateInput
): Promise<InferenceProviderOutput> {
  return apiPatch<InferenceProviderOutput>(
    `/api/projects/${projectId}/inference-providers/${providerId}`,
    input
  );
}

export function deleteInferenceProvider(
  projectId: number,
  providerId: number
): Promise<void> {
  return apiDelete(
    `/api/projects/${projectId}/inference-providers/${providerId}`
  );
}
