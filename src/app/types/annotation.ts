export type AnnotationType = "box" | "polygon" | "keypoint";

export interface Box2DDataInput {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

export interface Polygon2DDataInput {
  points: number[][];
}

export interface Keypoint2DDataInput {
  points: number[][];
}

export interface Annotation2DCreateInput {
  annotation_type: AnnotationType;
  label?: number | null;
  box?: Box2DDataInput | null;
  polygon?: Polygon2DDataInput | null;
  keypoint?: Keypoint2DDataInput | null;
}

export interface BoxData {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export interface PointsData {
  points: number[][];
}

export type AnnotationData = BoxData | PointsData;

export interface Annotation2DOutput {
  id: number;
  image_id: number;
  project_id: number;
  annotation_type: AnnotationType;
  label: number | null;
  is_active: boolean;
  data: AnnotationData;
  created_at: string;
  updated_at: string;
}

/** Type guard: narrow AnnotationData to BoxData */
export function isBoxData(data: AnnotationData): data is BoxData {
  return "x" in data && "width" in data;
}

/** Type guard: narrow AnnotationData to PointsData */
export function isPointsData(data: AnnotationData): data is PointsData {
  return "points" in data;
}
