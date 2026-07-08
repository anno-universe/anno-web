import { apiGet, apiPost, apiPatch, apiDelete } from "@/api/client";
import type { PaginatedResponse, PaginationParams } from "@/types/api";
import type {
  InteractiveProviderOutput,
  InteractiveProviderCreateInput,
  InteractiveProviderUpdateInput,
  InteractiveSessionStartOutput,
  InteractiveSessionStartInput,
  InteractiveSessionOutput,
  InteractiveSessionDetailOutput,
  InteractiveCommitInput,
} from "@/types/interactiveInference";

// ---------------------------------------------------------------------------
// Interactive provider CRUD (JWT)
// ---------------------------------------------------------------------------

export function getInteractiveProviders(
  projectId: number,
  params?: PaginationParams & { is_active?: boolean }
): Promise<PaginatedResponse<InteractiveProviderOutput>> {
  return apiGet<PaginatedResponse<InteractiveProviderOutput>>(
    `/api/projects/${projectId}/interactive-providers/`,
    params as Record<string, unknown>
  );
}

export function createInteractiveProvider(
  projectId: number,
  input: InteractiveProviderCreateInput
): Promise<InteractiveProviderOutput> {
  return apiPost<InteractiveProviderOutput>(
    `/api/projects/${projectId}/interactive-providers/`,
    input
  );
}

export function updateInteractiveProvider(
  projectId: number,
  providerId: number,
  input: InteractiveProviderUpdateInput
): Promise<InteractiveProviderOutput> {
  return apiPatch<InteractiveProviderOutput>(
    `/api/projects/${projectId}/interactive-providers/${providerId}`,
    input
  );
}

export function deleteInteractiveProvider(
  projectId: number,
  providerId: number
): Promise<void> {
  return apiDelete(
    `/api/projects/${projectId}/interactive-providers/${providerId}`
  );
}

// ---------------------------------------------------------------------------
// Interactive sessions (JWT)
// ---------------------------------------------------------------------------

export function startInteractiveSession(
  projectId: number,
  imageId: number,
  input: InteractiveSessionStartInput
): Promise<InteractiveSessionStartOutput> {
  return apiPost<InteractiveSessionStartOutput>(
    `/api/projects/${projectId}/images/${imageId}/interactive-sessions/`,
    input
  );
}

export function getInteractiveSession(
  projectId: number,
  imageId: number,
  sessionId: number
): Promise<InteractiveSessionDetailOutput> {
  return apiGet<InteractiveSessionDetailOutput>(
    `/api/projects/${projectId}/images/${imageId}/interactive-sessions/${sessionId}`
  );
}

export function commitInteractiveSession(
  projectId: number,
  imageId: number,
  sessionId: number,
  payload: InteractiveCommitInput
): Promise<InteractiveSessionOutput> {
  return apiPost<InteractiveSessionOutput>(
    `/api/projects/${projectId}/images/${imageId}/interactive-sessions/${sessionId}/commit`,
    payload
  );
}

export function discardInteractiveSession(
  projectId: number,
  imageId: number,
  sessionId: number
): Promise<InteractiveSessionOutput> {
  return apiPost<InteractiveSessionOutput>(
    `/api/projects/${projectId}/images/${imageId}/interactive-sessions/${sessionId}/discard`
  );
}
