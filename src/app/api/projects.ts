import { apiGet, apiPost, apiPatch, apiDelete } from "./client";
import type { PaginatedResponse, PaginationParams } from "@/types/api";
import type {
  ProjectOutput,
  ProjectCreateInput,
  ProjectUpdateInput,
  ProjectMemberOutput,
  AddProjectMemberInput,
  UpdateMemberRoleInput,
} from "@/types/project";

export function getProjects(
  params?: PaginationParams
): Promise<PaginatedResponse<ProjectOutput>> {
  return apiGet<PaginatedResponse<ProjectOutput>>("/api/projects/", params);
}

export function getProject(id: number): Promise<ProjectOutput> {
  return apiGet<ProjectOutput>(`/api/projects/${id}`);
}

export function createProject(
  input: ProjectCreateInput
): Promise<ProjectOutput> {
  return apiPost<ProjectOutput>("/api/projects/", input);
}

export function updateProject(
  id: number,
  input: ProjectUpdateInput
): Promise<ProjectOutput> {
  return apiPatch<ProjectOutput>(`/api/projects/${id}`, input);
}

export function deleteProject(id: number): Promise<void> {
  return apiDelete(`/api/projects/${id}`);
}

export function getMembers(
  projectId: number,
  params?: PaginationParams
): Promise<PaginatedResponse<ProjectMemberOutput>> {
  return apiGet<PaginatedResponse<ProjectMemberOutput>>(
    `/api/projects/${projectId}/members`,
    params
  );
}

export function addMember(
  projectId: number,
  input: AddProjectMemberInput
): Promise<ProjectMemberOutput> {
  return apiPost<ProjectMemberOutput>(
    `/api/projects/${projectId}/members`,
    input
  );
}

export function updateMemberRole(
  projectId: number,
  userId: number,
  input: UpdateMemberRoleInput
): Promise<ProjectMemberOutput> {
  return apiPatch<ProjectMemberOutput>(
    `/api/projects/${projectId}/members/${userId}`,
    input
  );
}

export function removeMember(
  projectId: number,
  userId: number
): Promise<void> {
  return apiDelete(`/api/projects/${projectId}/members/${userId}`);
}
