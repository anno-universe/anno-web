import { apiGet, apiPostForm } from "./client";
import type { PaginatedResponse, PaginationParams } from "@/types/api";
import type { Image2DOutput } from "@/types/image";

export function getImages(
  projectId: number,
  params?: PaginationParams
): Promise<PaginatedResponse<Image2DOutput>> {
  return apiGet<PaginatedResponse<Image2DOutput>>(
    `/api/projects/${projectId}/images/`,
    params
  );
}

export function getImage(
  projectId: number,
  imageId: number
): Promise<Image2DOutput> {
  return apiGet<Image2DOutput>(
    `/api/projects/${projectId}/images/${imageId}`
  );
}

export function uploadImage(
  projectId: number,
  file: File
): Promise<Image2DOutput> {
  const form = new FormData();
  form.append("file", file);
  return apiPostForm<Image2DOutput>(
    `/api/projects/${projectId}/images/`,
    form
  );
}

export function getOriginalImageUrl(
  projectId: number,
  imageId: number
): string {
  return `/api/projects/${projectId}/images/${imageId}/original_image`;
}

export function getThumbnailUrl(
  projectId: number,
  imageId: number,
  w = 300,
  h = 300
): string {
  return `/api/projects/${projectId}/images/${imageId}/thumbnail_image?w=${w}&h=${h}`;
}
