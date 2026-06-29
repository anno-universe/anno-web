// ---- Project tag definitions ----

export interface TagOutput {
  id: number;
  project_id: number;
  name: string;
  display_name: string;
  color: string;
  description: string;
  is_active: boolean;
  created_by_id: number;
  created_at: string;
  updated_at: string;
}

export interface TagCreateInput {
  name: string;
  display_name: string;
  color?: string;
  description?: string;
}

export interface TagUpdateInput {
  display_name?: string | null;
  color?: string | null;
  description?: string | null;
  is_active?: boolean | null;
}

// ---- Tag statistics ----

export interface TagStatItem {
  tag_id: number;
  name: string;
  display_name: string;
  color: string;
  image_count: number;
}

export interface TagStatsOutput {
  project_id: number;
  tags: TagStatItem[];
}

// ---- Image tag application ----

export interface ImageTagOutput {
  id: number;
  image_id: number;
  tag_id: number;
  tag_name: string;
  tag_display_name: string;
  tag_color: string;
  applied_by_id: number;
  note: string;
  created_at: string;
}

export interface ImageTagApplyInput {
  tag_id: number;
  note?: string;
}
