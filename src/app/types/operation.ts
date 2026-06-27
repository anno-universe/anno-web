export type OperationAction = "add" | "modify" | "delete";

export interface OperationOutput {
  id: number;
  image_id: number;
  from_annotation_id: number | null;
  to_annotation_id: number | null;
  action: OperationAction;
  performed_by_id: number;
  created_at: string;
}
