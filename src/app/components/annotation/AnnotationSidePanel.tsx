import { useState } from "react";
import { AnnotationList } from "./AnnotationList";
import { OperationHistory } from "./OperationHistory";
import type { Annotation2DOutput } from "@/types/annotation";
import type { OperationOutput } from "@/types/operation";

type Tab = "annotations" | "history";

interface Props {
  annotations: Annotation2DOutput[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  operations: OperationOutput[];
  labelMapping: Record<string, unknown>;
}

export function AnnotationSidePanel({
  annotations,
  selectedId,
  onSelect,
  operations,
  labelMapping,
}: Props) {
  const [tab, setTab] = useState<Tab>("annotations");

  return (
    <div className="flex h-full w-[320px] shrink-0 flex-col border-l bg-card">
      {/* Tabs */}
      <div className="flex shrink-0 border-b">
        <TabButton
          active={tab === "annotations"}
          onClick={() => setTab("annotations")}
        >
          Annotations
        </TabButton>
        <TabButton
          active={tab === "history"}
          onClick={() => setTab("history")}
        >
          History
        </TabButton>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {tab === "annotations" ? (
          <AnnotationList
            annotations={annotations}
            selectedId={selectedId}
            onSelect={onSelect}
            labelMapping={labelMapping}
          />
        ) : (
          <OperationHistory operations={operations} />
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 border-b-2 px-4 py-2.5 text-xs font-medium transition-colors ${
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
