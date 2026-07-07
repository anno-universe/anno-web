import {
  PlusCircle,
  MinusCircle,
  Square,
  Send,
  Undo2,
  XCircle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import type { InteractivePrompt, InteractivePromptType } from "@/types/interactiveInference";

type SAMTool = "positive_point" | "negative_point" | "box";

const PROMPT_LABELS: Record<InteractivePromptType, string> = {
  positive_point: "+",
  negative_point: "−",
  box: "□",
  mask: "M",
  text: "T",
};

interface Props {
  activeTool: SAMTool;
  onToolChange: (tool: SAMTool) => void;
  prompts: InteractivePrompt[];
  canSend: boolean;
  isLoading: boolean;
  hasCandidate: boolean;
  onSend: () => void;
  onUndo: () => void;
  onDiscard: () => void;
  onCommit: () => void;
}

export function InteractiveToolbar({
  activeTool,
  onToolChange,
  prompts,
  canSend,
  isLoading,
  hasCandidate,
  onSend,
  onUndo,
  onDiscard,
  onCommit,
}: Props) {
  const tools: Array<{
    id: SAMTool;
    icon: typeof PlusCircle;
    label: string;
    shortcut: string;
  }> = [
    { id: "positive_point", icon: PlusCircle, label: "Positive point", shortcut: "Click" },
    { id: "negative_point", icon: MinusCircle, label: "Negative point", shortcut: "Shift+Click" },
    { id: "box", icon: Square, label: "Box prompt", shortcut: "Drag" },
  ];

  return (
    <div
      className="absolute left-1/2 top-3 z-20 -translate-x-1/2 flex items-center gap-1.5 rounded-xl border bg-card/95 px-3 py-2 shadow-lg backdrop-blur"
    >
      {/* Tool buttons */}
      {tools.map(({ id, icon: Icon, label, shortcut }) => (
        <Tooltip key={id}>
          <TooltipTrigger asChild>
            <button
              onClick={() => onToolChange(id)}
              disabled={isLoading}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                activeTool === id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
                isLoading && "opacity-50 cursor-not-allowed"
              )}
              aria-label={label}
            >
              <Icon className="h-[18px] w-[18px]" />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{label} ({shortcut})</p>
          </TooltipContent>
        </Tooltip>
      ))}

      {/* Separator */}
      <div className="mx-1 h-6 w-px bg-border" />

      {/* Prompt chips */}
      <div className="flex items-center gap-1 max-w-[200px] overflow-x-auto">
        {prompts.length === 0 && (
          <span className="text-xs text-muted-foreground px-1">No prompts yet</span>
        )}
        {prompts.map((p, i) => (
          <span
            key={i}
            className="inline-flex h-6 items-center rounded-full bg-muted px-2 text-xs font-medium text-muted-foreground"
          >
            {PROMPT_LABELS[p.type] ?? p.type}
          </span>
        ))}
      </div>

      {/* Separator */}
      <div className="mx-1 h-6 w-px bg-border" />

      {/* Actions */}
      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-primary mx-2" />
      ) : hasCandidate ? (
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onUndo}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Undo last prompt"
              >
                <Undo2 className="h-[16px] w-[16px]" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Undo last prompt</p>
            </TooltipContent>
          </Tooltip>
          <button
            onClick={onCommit}
            className="flex h-7 items-center gap-1 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            Save
          </button>
        </>
      ) : (
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onUndo}
                disabled={prompts.length === 0}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                aria-label="Undo last prompt"
              >
                <Undo2 className="h-[16px] w-[16px]" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Undo last prompt</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onSend}
                disabled={!canSend}
                className={cn(
                  "flex h-7 items-center gap-1 rounded-lg px-3 text-xs font-medium transition-colors",
                  canSend
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                )}
                aria-label="Send prompts"
              >
                <Send className="h-3.5 w-3.5" />
                Send
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Send prompts (Enter)</p>
            </TooltipContent>
          </Tooltip>
        </>
      )}

      {/* Separator */}
      <div className="mx-1 h-6 w-px bg-border" />

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onDiscard}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            aria-label="Discard session"
          >
            <XCircle className="h-[16px] w-[16px]" />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Discard session (Esc)</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
