import { apiGet } from "./client";
import type { ApiRequestOptions } from "./client";
import type { PaginatedResponse, PaginationParams } from "@/types/api";
import type { OperationOutput } from "@/types/operation";

export function getOperations(
  projectId: number,
  imageId: number,
  params?: PaginationParams,
  options?: ApiRequestOptions
): Promise<PaginatedResponse<OperationOutput>> {
  return apiGet<PaginatedResponse<OperationOutput>>(
    `/api/projects/${projectId}/images/${imageId}/operations/`,
    params,
    options
  );
}
