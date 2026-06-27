export interface UserProfile {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  groups: string[];
}

export interface RegisterInput {
  username: string;
  email: string;
  password: string;
}

export interface ProfileUpdateInput {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}

export interface UserSearchResult {
  id: number;
  username: string;
  email: string;
}
