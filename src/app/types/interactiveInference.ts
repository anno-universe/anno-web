/** Prompt types the interactive inference service accepts. */
export type InteractivePromptType =
  | "box"
  | "positive_point"
  | "negative_point"
  | "mask"
  | "text";

/** Supported annotation result types. */
export type InteractiveResultType = "polygon" | "box" | "keypoint";

/** A single prompt on the wire — a plain dict tagged with ``type``. */
export interface InteractivePrompt {
  type: InteractivePromptType;
  /** Box prompt fields. */
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  /** Text prompt. */
  text?: string;
  /** Mask prompt fields. */
  points?: number[][];
  rle?: Record<string, unknown> | string;
}

/** A registered interactive inference service provider. */
export interface InteractiveProviderOutput {
  id: number;
  name: string;
  model_name: string;
  description: string;
  inference_url: string;
  supported_prompt_types: InteractivePromptType[];
  supported_result_types: InteractiveResultType[];
  auth_type: "none" | "header" | "query";
  auth_param_name: string;
  has_auth_secret: boolean;
  timeout_seconds: number;
  is_active: boolean;
  is_global: boolean;
  created_at: string;
  updated_at: string;
}

/** Partial update payload; all fields optional. ``auth_secret`` is write-only. */
export interface InteractiveProviderUpdateInput {
  name?: string | null;
  inference_url?: string | null;
  supported_prompt_types?: InteractivePromptType[] | null;
  supported_result_types?: InteractiveResultType[] | null;
  model_name?: string | null;
  description?: string | null;
  auth_type?: ("none" | "header" | "query") | null;
  auth_param_name?: string | null;
  auth_secret?: string | null;
  timeout_seconds?: number | null;
  is_active?: boolean | null;
}

/** Payload to create an interactive provider. */
export interface InteractiveProviderCreateInput {
  name: string;
  inference_url: string;
  supported_prompt_types: InteractivePromptType[];
  supported_result_types: InteractiveResultType[];
  model_name?: string;
  description?: string;
  auth_type?: "none" | "header" | "query";
  auth_param_name?: string;
  auth_secret?: string;
  timeout_seconds?: number;
  is_active?: boolean;
}

/** Session start request body. */
export interface InteractiveSessionStartInput {
  provider_id: number;
}

/** Returned when a session is opened — session state + token for direct calls. */
export interface InteractiveSessionStartOutput {
  id: number;
  project_id: number;
  image_id: number;
  provider_id: number;
  performed_by_id: number;
  status: string;
  error: string;
  created_at: string;
  updated_at: string;
  /** Short-lived token for the browser → service direct calls. */
  token: string;
  /** Header name to present the token in. */
  token_header: string;
  /** Service-reported token expiry (ISO-8601). */
  token_expires_at: string | null;
  /** Browser-reachable base URL. Calls go to ``{predict_url}/{session_id}/...``. */
  predict_url: string | null;
  /** Service-side session handle. */
  session_ref: string | null;
  /** Prompt types the service supports. */
  supported_prompt_types: InteractivePromptType[];
  /** Result types the service can return. */
  supported_result_types: InteractiveResultType[];
}

/** Base session output (commit / discard / get). */
export interface InteractiveSessionOutput {
  id: number;
  project_id: number;
  image_id: number;
  provider_id: number;
  performed_by_id: number;
  status: string;
  error: string;
  created_at: string;
  updated_at: string;
}

/** A single recorded step on a session. */
export interface InteractiveStepOutput {
  id: number;
  session_id: number;
  step_index: number;
  prompt: Record<string, unknown>;
  result: Record<string, unknown>;
  result_type: string;
  result_data: Record<string, unknown>;
  error: string;
  created_at: string;
}

/** Session detail with ordered steps. */
export interface InteractiveSessionDetailOutput extends InteractiveSessionOutput {
  steps: InteractiveStepOutput[];
}

/** Commit payload — chosen geometry + prompts for audit. */
export interface InteractiveCommitInput {
  annotation_type: string;
  label?: number | null;
  polygon?: { points: number[][] } | null;
  box?: { x: number; y: number; width: number; height: number; rotation?: number } | null;
  keypoint?: { points: number[][] } | null;
  prompts?: Record<string, unknown>[];
  score?: number | null;
  model_version?: string;
}
