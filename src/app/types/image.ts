export interface Image2DOutput {
  id: number;
  project_id: number;
  image_url: string;
  thumbnail_url: string;
  file_name: string;
  width: number | null;
  height: number | null;
  annotation_count: number;
  created_at: string;
  updated_at: string;
}
