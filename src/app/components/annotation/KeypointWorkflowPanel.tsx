import { Eye, EyeOff, RotateCcw, Save, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/shared/LoadingSpinner";
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
  saving: boolean;
}

interface Props {
  schemas: KeypointSchemaOption[];
  session: KeypointSession | null;
  onSelectSchema: (schema: KeypointSchemaOption) => void;
  onTogglePointVisibility: (index: number) => void;
  onMarkCurrentAbsent: () => void;
  onUndo: () => void;
  onCancel: () => void;
  onSave: () => void;
}

function VisibilityToggle({
  visibility,
  onClick,
}: {
  visibility: KeypointVisibility | undefined;
  onClick: () => void;
}) {
  if (visibility === 2) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="rounded p-0.5 text-blue-600 transition-colors hover:bg-blue-50"
        aria-label="Toggle to occluded"
        title="Visible — click to toggle"
      >
        <Eye className="size-4" />
      </button>
    );
  }
  if (visibility === 1) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="rounded p-0.5 text-amber-600 transition-colors hover:bg-amber-50"
        aria-label="Toggle to absent"
        title="Occluded — click to toggle"
      >
        <EyeOff className="size-4" />
      </button>
    );
  }
  if (visibility === 0) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="rounded p-0.5 text-gray-400 opacity-50 transition-colors hover:bg-gray-50 hover:opacity-75"
        aria-label="Toggle to visible"
        title="Absent — click to toggle"
      >
        <EyeOff className="size-4" />
      </button>
    );
  }
  return null;
}

export function KeypointWorkflowPanel({
  schemas,
  session,
  onSelectSchema,
  onTogglePointVisibility,
  onMarkCurrentAbsent,
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
  const currentIndex = session.points.length;
  const currentName = session.names[currentIndex];
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
      <CardContent className="flex min-h-0 flex-col gap-1 overflow-auto">
        <div className="flex flex-col">
          {session.names.map((name, index) => {
            const point = session.points[index];
            const isCurrent = index === currentIndex && !complete;

            return (
              <div
                key={`${index}-${name}`}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                  isCurrent && "border-l-[3px] border-blue-300 bg-blue-50"
                )}
              >
                <span
                  className={cn(
                    "mr-1 min-w-[2ch] tabular-nums text-muted-foreground",
                    isCurrent && "font-bold text-blue-600"
                  )}
                >
                  {index}
                </span>
                <span
                  className={cn(
                    "flex-1 truncate",
                    isCurrent && "font-semibold",
                    point && point[2] === 0 && "line-through text-muted-foreground"
                  )}
                >
                  {name}
                </span>
                {point ? (
                  <VisibilityToggle
                    visibility={point[2] as KeypointVisibility}
                    onClick={() => onTogglePointVisibility(index)}
                  />
                ) : isCurrent ? (
                  <button
                    type="button"
                    onClick={onMarkCurrentAbsent}
                    className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Mark absent"
                    title="Mark absent — skip this point"
                  >
                    <EyeOff className="size-3.5" />
                  </button>
                ) : null}
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
          {session.saving ? (
            <Spinner />
          ) : (
            <Save data-icon="inline-start" />
          )}
          {session.saving ? "Saving…" : "Complete and save"}
        </Button>
      </CardFooter>
    </Card>
  );
}
