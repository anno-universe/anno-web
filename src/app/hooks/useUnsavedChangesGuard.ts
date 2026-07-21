import { useCallback, useEffect, useRef } from "react";
import { useBlocker } from "react-router";

/**
 * Guards against losing unsaved work. Blocks in-app navigation (react-router
 * `useBlocker`) and warns on full-page unload (refresh / close / external nav)
 * whenever `shouldBlock` is — or evaluates to — true.
 *
 * Pass a boolean for reactive dirty state, or a function to evaluate dirtiness
 * lazily at navigation time (e.g. when it depends on an imperative ref).
 *
 * Returns `blocked` plus `proceed` / `cancel` so the caller renders its own
 * confirmation dialog.
 */
export function useUnsavedChangesGuard(shouldBlock: boolean | (() => boolean)) {
  // Hold the latest predicate in a ref so the blocker/listener stay stable and
  // don't re-subscribe on every render when an inline function is passed.
  const shouldBlockRef = useRef(shouldBlock);
  shouldBlockRef.current = shouldBlock;

  const isDirty = useCallback(() => {
    const current = shouldBlockRef.current;
    return typeof current === "function" ? current() : current;
  }, []);

  const blocker = useBlocker(useCallback(() => isDirty(), [isDirty]));

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty()) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  return {
    blocked: blocker.state === "blocked",
    proceed: () => blocker.proceed?.(),
    cancel: () => blocker.reset?.(),
  };
}
