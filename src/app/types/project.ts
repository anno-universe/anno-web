export type ProjectRole = "supervisor" | "worker" | "admin" | string | null;

export interface ProjectOutput {
  id: number;
  name: string;
  description: string;
  meta_info: Record<string, unknown>;
  label_mapping: Record<string, unknown>;
  created_by_id: number;
  my_role: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectCreateInput {
  name: string;
  description?: string;
  meta_info?: Record<string, unknown>;
  label_mapping?: Record<string, unknown>;
}

/** PATCH: only send changed fields (exclude_unset on backend) */
export interface ProjectUpdateInput {
  name?: string | null;
  description?: string | null;
  meta_info?: Record<string, unknown> | null;
  label_mapping?: Record<string, unknown> | null;
}

export interface ProjectMemberOutput {
  user_id: number;
  username: string;
  email: string;
  role: string;
  created_at: string;
}

export interface AddProjectMemberInput {
  user_id: number;
  role: string;
}

export interface UpdateMemberRoleInput {
  role: string;
}
