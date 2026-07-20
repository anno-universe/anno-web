import { apiGet, apiPost, apiPatch, apiDelete } from "./client";
import type { ApiRequestOptions } from "./client";
import type { PaginatedResponse, PaginationParams } from "@/types/api";
import type {
  Annotation2DOutput,
  Annotation2DCreateInput,
} from "@/types/annotation";

export function getAnnotations(
  projectId: number,
  imageId: number,
  params?: PaginationParams,
  options?: ApiRequestOptions
): Promise<PaginatedResponse<Annotation2DOutput>> {
  return apiGet<PaginatedResponse<Annotation2DOutput>>(
    `/api/projects/${projectId}/images/${imageId}/annotations/`,
    params,
    options
  );
}

export function getAnnotation(
  projectId: number,
  imageId: number,
  annotationId: number
): Promise<Annotation2DOutput> {
  return apiGet<Annotation2DOutput>(
    `/api/projects/${projectId}/images/${imageId}/annotations/${annotationId}`
  );
}

export function createAnnotation(
  projectId: number,
  imageId: number,
  input: Annotation2DCreateInput
): Promise<Annotation2DOutput> {
  return apiPost<Annotation2DOutput>(
    `/api/projects/${projectId}/images/${imageId}/annotations/`,
    input
  );
}

/** PATCH annotation — returns a NEW annotation ID! Old annotation becomes is_active=False */
export function modifyAnnotation(
  projectId: number,
  imageId: number,
  annotationId: number,
  input: Annotation2DCreateInput
): Promise<Annotation2DOutput> {
  return apiPatch<Annotation2DOutput>(
    `/api/projects/${projectId}/images/${imageId}/annotations/${annotationId}`,
    input
  );
}

/** Soft delete — sets is_active=False */
export function deleteAnnotation(
  projectId: number,
  imageId: number,
  annotationId: number
): Promise<void> {
  return apiDelete(
    `/api/projects/${projectId}/images/${imageId}/annotations/${annotationId}`
  );
}
