import { Eye, EyeOff, RotateCcw, Save, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { KeypointTuple, KeypointVisibility } from "@/types/annotation";

export interface KeypointSchemaOption {
  label: number;
  name: string;
  keypoints: string[];
  schemaKey: string;
}

export interface KeypointSession {
  label: number;
  name: string;
  names: string[];
  schemaKey: string;
  points: KeypointTuple[];
  placementVisibility: 1 | 2;
  saving: boolean;
}

interface Props {
  schemas: KeypointSchemaOption[];
  session: KeypointSession | null;
  onSelectSchema: (schema: KeypointSchemaOption) => void;
  onPlacementVisibilityChange: (visibility: 1 | 2) => void;
  onMarkAbsent: () => void;
  onUndo: () => void;
  onCancel: () => void;
  onSave: () => void;
}

function visibilityLabel(visibility: KeypointVisibility | undefined) {
  if (visibility === 2) return "Visible";
  if (visibility === 1) return "Occluded";
  if (visibility === 0) return "Absent";
  return "Pending";
}

export function KeypointWorkflowPanel({
  schemas,
  session,
  onSelectSchema,
  onPlacementVisibilityChange,
  onMarkAbsent,
  onUndo,
  onCancel,
  onSave,
}: Props) {
  if (!session) {
    return (
      <Card className="absolute right-[332px] top-3 z-20 w-80 shadow-lg">
        <CardHeader>
          <CardTitle>New keypoint instance</CardTitle>
          <CardDescription>
            Select a category before placing its ordered keypoints.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            onValueChange={(value) => {
              const schema = schemas.find((candidate) => candidate.label === Number(value));
              if (schema) onSelectSchema(schema);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {schemas.map((schema) => (
                  <SelectItem key={schema.label} value={String(schema.label)}>
                    {schema.label} - {schema.name} ({schema.keypoints.length})
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </CardContent>
        <CardFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            <X data-icon="inline-start" />
            Cancel
          </Button>
        </CardFooter>
      </Card>
    );
  }

  const complete = session.points.length === session.names.length;
  const currentName = session.names[session.points.length];
  const percent = Math.round((session.points.length / session.names.length) * 100);

  return (
    <Card className="absolute right-[332px] top-3 z-20 max-h-[calc(100%-1.5rem)] w-80 shadow-lg">
      <CardHeader>
        <CardTitle>{session.label} - {session.name}</CardTitle>
        <CardDescription>
          {complete
            ? "Review all points, then save the instance."
            : `Place ${session.points.length + 1}. ${currentName}`}
        </CardDescription>
        <Progress value={percent} />
      </CardHeader>
      <CardContent className="flex min-h-0 flex-col gap-3 overflow-auto">
        {!complete && (
          <div className="flex items-center gap-2">
            <Select
              value={String(session.placementVisibility)}
              onValueChange={(value) =>
                onPlacementVisibilityChange(Number(value) as 1 | 2)
              }
            >
              <SelectTrigger className="min-w-0 flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="2"><Eye /> Visible click</SelectItem>
                  <SelectItem value="1"><EyeOff /> Occluded click</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" onClick={onMarkAbsent}>
              Mark absent
            </Button>
          </div>
        )}

        <div className="flex flex-col gap-1">
          {session.names.map((name, index) => {
            const visibility = session.points[index]?.[2];
            return (
              <div
                key={`${index}-${name}`}
                className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm"
              >
                <span className="truncate">
                  <span className="mr-2 tabular-nums text-muted-foreground">{index}</span>
                  {name}
                </span>
                <Badge variant={visibility == null ? "outline" : "secondary"}>
                  {visibilityLabel(visibility)}
                </Badge>
              </div>
            );
          })}
        </div>
      </CardContent>
      <CardFooter className="justify-between">
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onUndo}
            disabled={session.points.length === 0 || session.saving}
            aria-label="Undo last keypoint"
          >
            <RotateCcw />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onCancel}
            disabled={session.saving}
            aria-label="Cancel keypoint instance"
          >
            <X />
          </Button>
        </div>
        <Button type="button" onClick={onSave} disabled={!complete || session.saving}>
          <Save data-icon="inline-start" />
          {session.saving ? "Saving…" : "Complete and save"}
        </Button>
      </CardFooter>
    </Card>
  );
}
