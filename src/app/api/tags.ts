import { apiGet, apiPost, apiPatch, apiDelete } from "./client";
import type { PaginatedResponse, PaginationParams } from "@/types/api";
import type {
  TagOutput,
  TagCreateInput,
  TagUpdateInput,
  TagStatsOutput,
  ImageTagOutput,
  ImageTagApplyInput,
} from "@/types/tag";

// ---- Project tag definitions ----

export function getProjectTags(
  projectId: number,
  params?: PaginationParams & { is_active?: boolean }
): Promise<PaginatedResponse<TagOutput>> {
  return apiGet<PaginatedResponse<TagOutput>>(
    `/api/projects/${projectId}/tags/`,
    params
  );
}

export function createTag(
  projectId: number,
  input: TagCreateInput
): Promise<TagOutput> {
  return apiPost<TagOutput>(
    `/api/projects/${projectId}/tags/`,
    input
  );
}

export function getTagStats(
  projectId: number
): Promise<TagStatsOutput> {
  return apiGet<TagStatsOutput>(
    `/api/projects/${projectId}/tags/stats`
  );
}

export function getTag(
  projectId: number,
  tagId: number
): Promise<TagOutput> {
  return apiGet<TagOutput>(
    `/api/projects/${projectId}/tags/${tagId}`
  );
}

export function updateTag(
  projectId: number,
  tagId: number,
  input: TagUpdateInput
): Promise<TagOutput> {
  return apiPatch<TagOutput>(
    `/api/projects/${projectId}/tags/${tagId}`,
    input
  );
}

export function deleteTag(
  projectId: number,
  tagId: number
): Promise<void> {
  return apiDelete(
    `/api/projects/${projectId}/tags/${tagId}`
  );
}

// ---- Image tag application ----

export function getImageTags(
  projectId: number,
  imageId: number
): Promise<ImageTagOutput[]> {
  return apiGet<ImageTagOutput[]>(
    `/api/projects/${projectId}/images/${imageId}/tags/`
  );
}

export function applyImageTag(
  projectId: number,
  imageId: number,
  input: ImageTagApplyInput
): Promise<ImageTagOutput> {
  return apiPost<ImageTagOutput>(
    `/api/projects/${projectId}/images/${imageId}/tags/`,
    input
  );
}

export function removeImageTag(
  projectId: number,
  imageId: number,
  tagId: number
): Promise<void> {
  return apiDelete(
    `/api/projects/${projectId}/images/${imageId}/tags/${tagId}`
  );
}
