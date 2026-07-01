import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

interface Props {
  onClick: () => void;
}

export function InferenceToolbarSection({ onClick }: Props) {
  return (
    <>
      <Separator className="my-2 w-8" />

      {/* Trigger button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClick}
            className="text-amber-500 hover:bg-amber-50 hover:text-amber-600"
            aria-label="Open AI inference panel"
          >
            <Sparkles />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>AI Inference</p>
        </TooltipContent>
      </Tooltip>
    </>
  );
}
