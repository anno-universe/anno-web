import { useEffect, useState, useRef } from "react";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import {
  getInferenceProviders,
} from "@/api/inferenceProviders";
import {
  startSingleImageInference,
  getInferenceJob,
} from "@/api/inferenceJobs";
import { Modal } from "@/components/shared/Modal";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import type { InferenceProviderOutput } from "@/types/inferenceProvider";
import { TERMINAL_JOB_STATUSES } from "@/types/inferenceJob";

type Phase = "select" | "running" | "success" | "error";

// ---- Persist provider selection per project ----

const PROVIDER_STORAGE_PREFIX = "inference_provider_";

function loadSavedProviderId(
  projectId: number,
  availableIds: Set<number>
): number | null {
  try {
    const raw = localStorage.getItem(`${PROVIDER_STORAGE_PREFIX}${projectId}`);
    if (raw != null) {
      const id = Number(raw);
      if (Number.isFinite(id) && availableIds.has(id)) return id;
    }
  } catch {
    // localStorage unavailable (private browsing, etc.) — ignore
  }
  return null;
}

function saveProviderId(projectId: number, providerId: number) {
  try {
    localStorage.setItem(
      `${PROVIDER_STORAGE_PREFIX}${projectId}`,
      String(providerId)
    );
  } catch {
    // ignore
  }
}

interface Props {
  open: boolean;
  projectId: number;
  imageId: number;
  onClose: () => void;
  /** Called when inference completes successfully so the caller can refresh annotations. */
  onComplete: (annotationsCreated: number) => void;
}

export function InferenceModal({
  open,
  projectId,
  imageId,
  onClose,
  onComplete,
}: Props) {
  // ---- Phase ----
  const [phase, setPhase] = useState<Phase>("select");
  const [error, setError] = useState("");
  const [annotationsCreated, setAnnotationsCreated] = useState(0);

  // ---- Providers ----
  const [providers, setProviders] = useState<InferenceProviderOutput[]>([]);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [selectedProviderId, setSelectedProviderId] = useState<number | null>(
    null
  );
  const [starting, setStarting] = useState(false);

  // Minimum-visible-time ref (so the spinner shows at least 1 second)
  const startedAtRef = useRef<number>(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---- Fetch providers on open ----
  useEffect(() => {
    if (!open) return;
    // Reset phase
    setPhase("select");
    setError("");
    setAnnotationsCreated(0);
    setStarting(false);

    let cancelled = false;
    setProvidersLoading(true);
    getInferenceProviders(projectId, { limit: 50 })
      .then((resp) => {
        if (cancelled) return;
        const active = resp.items.filter((p) => p.is_active);
        setProviders(active);
        if (active.length > 0) {
          // Restore saved selection for this project, fall back to first active
          const activeIds = new Set(active.map((p) => p.id));
          const saved = loadSavedProviderId(projectId, activeIds);
          setSelectedProviderId(saved ?? active[0].id);
        } else {
          setSelectedProviderId(null);
        }
      })
      .catch(() => {
        if (!cancelled)
          setError("Failed to load inference providers.");
      })
      .finally(() => {
        if (!cancelled) setProvidersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, projectId]);

  // ---- Cleanup polling on unmount ----
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // ---- Start inference ----
  async function handleStart() {
    if (!selectedProviderId) return;
    setStarting(true);
    try {
      const job = await startSingleImageInference(
        projectId,
        imageId,
        selectedProviderId
      );
      setPhase("running");
      setStarting(false);
      startedAtRef.current = Date.now();

      // Poll for job completion
      pollRef.current = setInterval(async () => {
        try {
          const j = await getInferenceJob(projectId, job.id);
          if (TERMINAL_JOB_STATUSES.includes(j.status)) {
            clearInterval(pollRef.current!);
            pollRef.current = null;

            // Ensure at least 1 second of spinner visibility
            const elapsed = Date.now() - startedAtRef.current;
            const minRemaining = Math.max(0, 1000 - elapsed);
            setTimeout(() => {
              if (j.status === "completed") {
                setAnnotationsCreated(j.annotations_created);
                setPhase("success");
                onComplete(j.annotations_created);
              } else {
                setError(j.error || `Inference ${j.status}.`);
                setPhase("error");
              }
            }, minRemaining);
          }
        } catch {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          const elapsed = Date.now() - startedAtRef.current;
          const minRemaining = Math.max(0, 1000 - elapsed);
          setTimeout(() => {
            setError("Lost connection while checking inference status.");
            setPhase("error");
          }, minRemaining);
        }
      }, 2000);
    } catch (err: unknown) {
      setStarting(false);
      setError(
        err instanceof Error ? err.message : "Failed to start inference"
      );
      setPhase("error");
    }
  }

  // ---- Close ----
  function handleClose() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    onClose();
  }

  // ---- Render ----
  return (
    <Modal
      open={open}
      title="AI Inference"
      size="sm"
      onClose={handleClose}
    >
      {/* Provider selector (select phase) */}
      {phase === "select" && (
        <>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">
                Provider
              </label>
              {providersLoading ? (
                <LoadingSpinner />
              ) : providers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No active inference providers configured for this project.
                  Ask a supervisor to add one in the Developer tab.
                </p>
              ) : (
                <select
                  value={selectedProviderId ?? ""}
                  onChange={(e) => {
                    const id = e.target.value ? Number(e.target.value) : null;
                    setSelectedProviderId(id);
                    if (id != null) saveProviderId(projectId, id);
                  }}
                  className="w-full rounded-md border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="" disabled>
                    Select a provider…
                  </option>
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.is_global ? " (Global)" : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <button
              type="button"
              onClick={handleStart}
              disabled={
                starting || !selectedProviderId || providers.length === 0
              }
              className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {starting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Start Inference
            </button>
          </div>
        </>
      )}

      {/* Running phase */}
      {phase === "running" && (
        <div className="flex flex-col items-center gap-4 py-8">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">
              Running inference…
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              The AI model is analyzing this image. This may take a moment.
            </p>
          </div>
        </div>
      )}

      {/* Success phase */}
      {phase === "success" && (
        <div className="flex flex-col items-center gap-4 py-6">
          <CheckCircle2 className="h-10 w-10 text-green-500" />
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">
              Inference complete
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {annotationsCreated}{" "}
              {annotationsCreated === 1 ? "annotation" : "annotations"} created
              for this image.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Done
          </button>
        </div>
      )}

      {/* Error phase */}
      {phase === "error" && (
        <div className="flex flex-col items-center gap-4 py-6">
          {error.includes("connection") || error.includes("Failed to start") ? (
            <AlertTriangle className="h-10 w-10 text-amber-500" />
          ) : (
            <XCircle className="h-10 w-10 text-red-500" />
          )}
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">
              Inference failed
            </p>
            <p className="mt-1 text-xs text-muted-foreground max-w-sm">
              {error || "An unknown error occurred."}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setPhase("select");
                setError("");
              }}
              className="rounded-md border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              Try Again
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
