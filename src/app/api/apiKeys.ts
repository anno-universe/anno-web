import { apiGet, apiPost, apiPatch, apiDelete } from "@/api/client";
import type { PaginatedResponse, PaginationParams } from "@/types/api";
import type {
  APIKeyOutput,
  APIKeyCreatedOutput,
  APIKeyCreateInput,
  APIKeyUpdateInput,
} from "@/types/apiKey";

export function getApiKeys(
  projectId: number,
  params?: PaginationParams
): Promise<PaginatedResponse<APIKeyOutput>> {
  return apiGet<PaginatedResponse<APIKeyOutput>>(
    `/api/projects/${projectId}/api-keys/`,
    params as Record<string, unknown>
  );
}

export function createApiKey(
  projectId: number,
  input: APIKeyCreateInput
): Promise<APIKeyCreatedOutput> {
  return apiPost<APIKeyCreatedOutput>(
    `/api/projects/${projectId}/api-keys/`,
    input
  );
}

export function updateApiKey(
  projectId: number,
  keyId: number,
  input: APIKeyUpdateInput
): Promise<APIKeyOutput> {
  return apiPatch<APIKeyOutput>(
    `/api/projects/${projectId}/api-keys/${keyId}`,
    input
  );
}

export function deleteApiKey(
  projectId: number,
  keyId: number
): Promise<void> {
  return apiDelete(`/api/projects/${projectId}/api-keys/${keyId}`);
}
