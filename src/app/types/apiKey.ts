export interface APIKeyOutput {
  id: number;
  project_id: number;
  name: string;
  prefix: string;
  is_active: boolean;
  expires_at: string | null;
  last_used_at: string | null;
  created_by_id: number;
  created_at: string;
}

/** Returned only at creation time — includes the plaintext token. */
export interface APIKeyCreatedOutput extends APIKeyOutput {
  token: string;
}

export interface APIKeyCreateInput {
  name: string;
  expires_at?: string | null;
}

export interface APIKeyUpdateInput {
  name?: string | null;
  is_active?: boolean | null;
  expires_at?: string | null;
}
