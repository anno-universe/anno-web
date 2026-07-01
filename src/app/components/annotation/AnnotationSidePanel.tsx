import { useState } from "react";
import { AnnotationList } from "./AnnotationList";
import { OperationHistory } from "./OperationHistory";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
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
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as Tab)}
        className="flex flex-1 flex-col"
      >
        <TabsList className="grid w-full grid-cols-2 shrink-0">
          <TabsTrigger value="annotations">Annotations</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="annotations" className="flex-1 mt-0">
          <ScrollArea className="h-full">
            <AnnotationList
              annotations={annotations}
              selectedId={selectedId}
              onSelect={onSelect}
              labelMapping={labelMapping}
            />
          </ScrollArea>
        </TabsContent>
        <TabsContent value="history" className="flex-1 mt-0">
          <ScrollArea className="h-full">
            <OperationHistory operations={operations} />
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
