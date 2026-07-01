import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  onClick: () => void;
}

export function InferenceToolbarSection({ onClick }: Props) {
  return (
    <>
      {/* Separator */}
      <div className="my-2 h-px w-8 bg-border" />

      {/* Trigger button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onClick}
        className="text-amber-500 hover:bg-amber-50 hover:text-amber-600"
        title="AI Inference"
        aria-label="Open AI inference panel"
      >
        <Sparkles />
      </Button>
    </>
  );
}
