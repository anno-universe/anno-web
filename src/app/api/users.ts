import { apiGet, apiPatch, apiPost } from "./client";
import type { ApiRequestOptions } from "./client";
import type { PaginatedResponse } from "@/types/api";
import type { UserProfile, RegisterInput, ProfileUpdateInput, UserSearchResult } from "@/types/user";

export function getMe(): Promise<UserProfile> {
  return apiGet<UserProfile>("/api/users/me");
}

export function postRegister(input: RegisterInput): Promise<UserProfile> {
  return apiPost<UserProfile>("/api/users/register", input);
}

export function patchProfile(input: ProfileUpdateInput): Promise<UserProfile> {
  return apiPatch<UserProfile>("/api/users/me", input);
}

export function searchUsers(
  params?: { q: string; limit?: number; offset?: number },
  options?: ApiRequestOptions
): Promise<PaginatedResponse<UserSearchResult>> {
  return apiGet<PaginatedResponse<UserSearchResult>>(
    "/api/users/search",
    params,
    options
  );
}
