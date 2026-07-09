import type { ImageTagOutput } from "./tag";

export interface Image2DOutput {
  id: number;
  project_id: number;
  image_url: string;
  thumbnail_url: string;
  file_name: string;
  width: number | null;
  height: number | null;
  annotation_count: number;
  tags: ImageTagOutput[];
  created_at: string;
  updated_at: string;
}

/** Short-lived pre-signed URL for loading an original image directly. */
export interface ImageURLOutput {
  url: string;
}
