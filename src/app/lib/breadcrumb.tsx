import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

interface BreadcrumbContextValue {
  /** routeId → display label */
  labels: Record<string, string>;
  setLabel: (routeId: string, label: string) => void;
  clearLabel: (routeId: string) => void;
}

const BreadcrumbContext = createContext<BreadcrumbContextValue | null>(null);

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [labels, setLabels] = useState<Record<string, string>>({});

  const setLabel = useCallback((routeId: string, label: string) => {
    setLabels((prev) => {
      if (prev[routeId] === label) return prev;
      return { ...prev, [routeId]: label };
    });
  }, []);

  const clearLabel = useCallback((routeId: string) => {
    setLabels((prev) => {
      if (!(routeId in prev)) return prev;
      const next = { ...prev };
      delete next[routeId];
      return next;
    });
  }, []);

  return (
    <BreadcrumbContext.Provider value={{ labels, setLabel, clearLabel }}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

export function useBreadcrumbContext() {
  const ctx = useContext(BreadcrumbContext);
  if (!ctx) {
    throw new Error("useBreadcrumbContext must be used within BreadcrumbProvider");
  }
  return ctx;
}

/**
 * Register a dynamic breadcrumb label for a given route ID.
 * Pass `null` as label to clear.
 * Cleans up on unmount automatically.
 */
export function useSetBreadcrumb(routeId: string | undefined, label: string | null) {
  const { setLabel, clearLabel } = useBreadcrumbContext();

  useEffect(() => {
    if (!routeId) return;
    if (label != null) {
      setLabel(routeId, label);
    } else {
      clearLabel(routeId);
    }
    return () => {
      clearLabel(routeId);
    };
  }, [routeId, label, setLabel, clearLabel]);
}
