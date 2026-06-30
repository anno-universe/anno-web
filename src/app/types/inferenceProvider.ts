/** Supported annotation result types a provider can return. */
export type ResultType = "box" | "polygon" | "keypoint";

/** Auth strategy for the external inference service. */
export type ProviderAuthType = "none" | "header" | "query";

/** A registered inference service provider (project-scoped or global). */
export interface InferenceProviderOutput {
  id: number;
  name: string;
  model_name: string;
  description: string;
  inference_url: string;
  supported_result_types: ResultType[];
  auth_type: ProviderAuthType;
  auth_param_name: string;
  /** True when a credential is stored — the secret itself is never returned. */
  has_auth_secret: boolean;
  timeout_seconds: number;
  is_active: boolean;
  /** True for admin-managed providers shared across all projects (read-only). */
  is_global: boolean;
  created_at: string;
  updated_at: string;
}

/** Payload to create a new inference service provider for a project. */
export interface InferenceProviderCreateInput {
  name: string;
  inference_url: string;
  supported_result_types: ResultType[];
  model_name?: string;
  description?: string;
  auth_type?: ProviderAuthType;
  auth_param_name?: string;
  /** Plaintext credential — only sent on create/update, never returned. */
  auth_secret?: string;
  timeout_seconds?: number;
  is_active?: boolean;
}

/** Partial update payload for inference provider; all fields optional. */
export interface InferenceProviderUpdateInput {
  name?: string | null;
  inference_url?: string | null;
  supported_result_types?: ResultType[] | null;
  model_name?: string | null;
  description?: string | null;
  auth_type?: ProviderAuthType | null;
  auth_param_name?: string | null;
  auth_secret?: string | null;
  timeout_seconds?: number | null;
  is_active?: boolean | null;
}
