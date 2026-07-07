import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { getInteractiveProviders } from "@/api/interactiveInference";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import type { InteractiveProviderOutput } from "@/types/interactiveInference";

type Phase = "select" | "connecting" | "error";

const STORAGE_KEY_PREFIX = "interactive_inference_provider_";

function loadSavedProviderId(
  projectId: number,
  availableIds: Set<number>
): number | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${projectId}`);
    if (raw != null) {
      const id = Number(raw);
      if (Number.isFinite(id) && availableIds.has(id)) return id;
    }
  } catch {
    // ignore
  }
  return null;
}

function saveProviderId(projectId: number, providerId: number) {
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${projectId}`, String(providerId));
  } catch {
    // ignore
  }
}

interface Props {
  open: boolean;
  projectId: number;
  onClose: () => void;
  /** Called when the session handshake succeeds. The modal closes. */
  onProviderSelected: (provider: InteractiveProviderOutput) => void;
}

export function InteractiveInferenceModal({
  open,
  projectId,
  onClose,
  onProviderSelected,
}: Props) {
  const [phase, setPhase] = useState<Phase>("select");
  const [error, setError] = useState("");

  const [providers, setProviders] = useState<InteractiveProviderOutput[]>([]);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [selectedProviderId, setSelectedProviderId] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);

  // Reset on open
  useEffect(() => {
    if (!open) return;
    setPhase("select");
    setError("");
    setStarting(false);

    let cancelled = false;
    setProvidersLoading(true);
    getInteractiveProviders(projectId, { limit: 50 })
      .then((resp) => {
        if (cancelled) return;
        const active = resp.items.filter((p) => p.is_active);
        setProviders(active);
        if (active.length > 0) {
          const activeIds = new Set(active.map((p) => p.id));
          const saved = loadSavedProviderId(projectId, activeIds);
          setSelectedProviderId(saved ?? active[0].id);
        } else {
          setSelectedProviderId(null);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load interactive inference providers.");
      })
      .finally(() => {
        if (!cancelled) setProvidersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, projectId]);

  function handleStart() {
    const provider = providers.find((p) => p.id === selectedProviderId);
    if (!provider) return;
    setStarting(true);
    setPhase("connecting");

    // The parent (AnnotatePage) runs the actual handshake and dispatches
    // START_SESSION. We just pass the selected provider up.
    saveProviderId(projectId, provider.id);
    onProviderSelected(provider);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Interactive SAM</DialogTitle>
        </DialogHeader>

        {phase === "select" && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-muted-foreground">
              Click on the image to place prompts (points, boxes). The model
              returns polygon candidates you can save as annotations.
            </p>
            <Field>
              <FieldLabel htmlFor="int-provider" className="text-xs">
                Provider
              </FieldLabel>
              {providersLoading ? (
                <LoadingSpinner />
              ) : providers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No active interactive providers. Ask a supervisor to add one
                  in the Developer tab.
                </p>
              ) : (
                <Select
                  value={
                    selectedProviderId != null
                      ? String(selectedProviderId)
                      : undefined
                  }
                  onValueChange={(v) => {
                    const id = v ? Number(v) : null;
                    setSelectedProviderId(id);
                    if (id != null) saveProviderId(projectId, id);
                  }}
                >
                  <SelectTrigger id="int-provider" className="w-full">
                    <SelectValue placeholder="Select a provider…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {providers.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.name}
                          {p.is_global ? " (Global)" : ""}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
            </Field>

            <Button
              type="button"
              onClick={handleStart}
              disabled={starting || !selectedProviderId || providers.length === 0}
              className="w-full"
            >
              {starting ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Sparkles />
              )}
              Start SAM Session
            </Button>
          </div>
        )}

        {phase === "connecting" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm font-medium text-foreground">
              Opening session…
            </p>
            <p className="text-xs text-muted-foreground text-center">
              Contacting the inference service and caching the image embedding.
            </p>
          </div>
        )}

        {phase === "error" && (
          <div className="flex flex-col items-center gap-4 py-6">
            <p className="text-sm text-muted-foreground">{error}</p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setPhase("select");
                  setError("");
                }}
              >
                Try Again
              </Button>
              <Button type="button" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
