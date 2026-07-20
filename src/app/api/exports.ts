import { api, apiGet, apiPost, apiDelete } from "@/api/client";
import type { ApiRequestOptions } from "@/api/client";
import type { PaginatedResponse, PaginationParams } from "@/types/api";
import type {
  ExportCreateInput,
  ExportTaskOutput,
  ExportTaskDetailOutput,
} from "@/types/export";

export function getExportTasks(
  projectId: number,
  params?: PaginationParams,
  options?: ApiRequestOptions
): Promise<PaginatedResponse<ExportTaskOutput>> {
  return apiGet<PaginatedResponse<ExportTaskOutput>>(
    `/api/projects/${projectId}/exports/`,
    params as Record<string, unknown>,
    options
  );
}

export function getExportTask(
  projectId: number,
  taskId: number
): Promise<ExportTaskDetailOutput> {
  return apiGet<ExportTaskDetailOutput>(
    `/api/projects/${projectId}/exports/${taskId}`
  );
}

export function createExport(
  projectId: number,
  input: ExportCreateInput
): Promise<ExportTaskOutput> {
  return apiPost<ExportTaskOutput>(
    `/api/projects/${projectId}/exports/`,
    input
  );
}

export async function downloadExportFile(
  projectId: number,
  taskId: number
): Promise<void> {
  const response = await api.get(
    `/api/projects/${projectId}/exports/${taskId}/download`,
    { responseType: "blob" }
  );
  const contentDisposition = response.headers["content-disposition"] as
    | string
    | undefined;
  let fileName = "";
  if (contentDisposition) {
    const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    if (match && match[1]) {
      fileName = match[1].replace(/['"]/g, "");
    }
  }
  const url = window.URL.createObjectURL(response.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export function deleteExportFile(
  projectId: number,
  taskId: number
): Promise<void> {
  return apiDelete(`/api/projects/${projectId}/exports/${taskId}/file`);
}
