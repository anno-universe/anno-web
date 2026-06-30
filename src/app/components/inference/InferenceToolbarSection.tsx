import { Sparkles } from "lucide-react";

interface Props {
  onClick: () => void;
}

export function InferenceToolbarSection({ onClick }: Props) {
  return (
    <>
      {/* Separator */}
      <div className="my-2 h-px w-8 bg-border" />

      {/* Trigger button */}
      <button
        onClick={onClick}
        className="flex h-9 w-9 items-center justify-center rounded-md text-amber-500 hover:bg-amber-50 hover:text-amber-600 transition-colors"
        title="AI Inference"
        aria-label="Open AI inference panel"
      >
        <Sparkles className="h-[18px] w-[18px]" />
      </button>
    </>
  );
}
