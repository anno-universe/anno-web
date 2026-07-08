import { useReducer, useRef, useMemo, useCallback } from "react";
import type { Annotation2DOutput, Annotation2DCreateInput } from "@/types/annotation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Serializable snapshot captured when entering edit mode.
 * Used to restore geometry + label on revert.
 */
export interface AnnotationSnapshot {
  annotationId: number;
  label: number | null;
  /** GeoJSON geometry object — plain JS, not an OL Geometry instance. */
  geometry: Record<string, unknown>;
}

/**
 * Discriminated union — prevents illegal combinations like
 * "viewing state with editingId set" or "editing state with pendingCreate".
 */
export type AnnotationViewState =
  | { type: "idle" }
  | { type: "viewing"; selectedId: number }
  | {
      type: "editing";
      selectedId: number;
      editingId: number;
      dirty: { geometry: boolean; label: boolean };
      pendingLabel: number | null;
      originalSnapshot: AnnotationSnapshot;
      saving: boolean;
      error: string | null;
    }
  | {
      type: "drafting";
      pendingCreate: Annotation2DCreateInput;
      selectedLabel: number | null;
      saving: boolean;
      error: string | null;
    };

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type AnnotationViewAction =
  // Selection
  | { type: "SELECT"; annotationId: number }
  | { type: "DESELECT" }
  // Edit lifecycle
  | { type: "START_EDIT"; annotationId: number; snapshot: AnnotationSnapshot }
  | { type: "SET_GEOMETRY_DIRTY" }
  | { type: "SET_GEOMETRY_CLEAN" }
  | { type: "SET_LABEL_DIRTY"; label: number | null }
  | { type: "SAVE_EDIT_REQUEST" }
  | { type: "SAVE_EDIT_SUCCESS"; annotation: Annotation2DOutput }
  | { type: "SAVE_EDIT_FAILED"; error: string }
  | { type: "CANCEL_EDIT" }
  // Draft lifecycle
  | { type: "START_DRAFT"; input: Annotation2DCreateInput }
  | { type: "SET_DRAFT_LABEL"; label: number | null }
  | { type: "COMMIT_DRAFT_REQUEST" }
  | { type: "COMMIT_DRAFT_SUCCESS"; annotation: Annotation2DOutput }
  | { type: "COMMIT_DRAFT_FAILED"; error: string }
  | { type: "DISCARD_DRAFT" }
  // Misc
  | { type: "CLEAR_ERROR" };

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function annotationViewReducer(
  state: AnnotationViewState,
  action: AnnotationViewAction
): AnnotationViewState {
  switch (action.type) {
    // ---- Selection ----
    case "SELECT": {
      // Blocked while drafting
      if (state.type === "drafting") return state;
      // Blocked while editing with dirty changes
      if (
        state.type === "editing" &&
        (state.dirty.geometry || state.dirty.label)
      )
        return state;
      // Already viewing this annotation — no-op
      if (state.type === "viewing" && state.selectedId === action.annotationId) return state;
      return { type: "viewing", selectedId: action.annotationId };
    }

    case "DESELECT": {
      // Blocked while drafting
      if (state.type === "drafting") return state;
      // Blocked while editing with dirty changes
      if (
        state.type === "editing" &&
        (state.dirty.geometry || state.dirty.label)
      )
        return state;
      return { type: "idle" };
    }

    // ---- Edit lifecycle ----
    case "START_EDIT": {
      // Can only enter edit from viewing (same annotation) or idle (via double-click)
      // Blocked while drafting
      if (state.type === "drafting") return state;
      // If already editing another annotation, blocked
      if (state.type === "editing" && state.selectedId !== action.annotationId) return state;
      // If already editing the same annotation, no-op
      if (state.type === "editing" && state.selectedId === action.annotationId) return state;

      return {
        type: "editing",
        selectedId: action.annotationId,
        editingId: action.annotationId,
        dirty: { geometry: false, label: false },
        pendingLabel: action.snapshot.label,
        originalSnapshot: action.snapshot,
        saving: false,
        error: null,
      };
    }

    case "SET_GEOMETRY_DIRTY": {
      if (state.type !== "editing") return state;
      return { ...state, dirty: { ...state.dirty, geometry: true } };
    }

    case "SET_GEOMETRY_CLEAN": {
      if (state.type !== "editing") return state;
      return { ...state, dirty: { ...state.dirty, geometry: false } };
    }

    case "SET_LABEL_DIRTY": {
      if (state.type !== "editing") return state;
      return {
        ...state,
        dirty: { ...state.dirty, label: true },
        pendingLabel: action.label,
      };
    }

    case "SAVE_EDIT_REQUEST": {
      if (state.type !== "editing" || state.saving) return state;
      return { ...state, saving: true, error: null };
    }

    case "SAVE_EDIT_SUCCESS": {
      if (state.type !== "editing" || !state.saving) return state;
      return {
        type: "viewing",
        selectedId: action.annotation.id,
      };
    }

    case "SAVE_EDIT_FAILED": {
      if (state.type !== "editing" || !state.saving) return state;
      return { ...state, saving: false, error: action.error };
    }

    case "CANCEL_EDIT": {
      if (state.type !== "editing") return state;
      return {
        type: "viewing",
        selectedId: state.originalSnapshot.annotationId,
      };
    }

    // ---- Draft lifecycle ----
    case "START_DRAFT": {
      // Blocked while editing (dirty) or another draft exists
      if (state.type === "editing" || state.type === "drafting") return state;

      return {
        type: "drafting",
        pendingCreate: action.input,
        selectedLabel: action.input.label ?? null,
        saving: false,
        error: null,
      };
    }

    case "SET_DRAFT_LABEL": {
      if (state.type !== "drafting") return state;
      return { ...state, selectedLabel: action.label };
    }

    case "COMMIT_DRAFT_REQUEST": {
      if (state.type !== "drafting" || state.saving) return state;
      return { ...state, saving: true, error: null };
    }

    case "COMMIT_DRAFT_SUCCESS": {
      if (state.type !== "drafting" || !state.saving) return state;
      return {
        type: "viewing",
        selectedId: action.annotation.id,
      };
    }

    case "COMMIT_DRAFT_FAILED": {
      if (state.type !== "drafting" || !state.saving) return state;
      return { ...state, saving: false, error: action.error };
    }

    case "DISCARD_DRAFT": {
      if (state.type !== "drafting") return state;
      return { type: "idle" };
    }

    // ---- Misc ----
    case "CLEAR_ERROR": {
      if (state.type === "editing" || state.type === "drafting") {
        return { ...state, error: null };
      }
      return state;
    }

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Derived values
// ---------------------------------------------------------------------------

export interface AnnotationViewDerived {
  selectedId: number | null;
  editingId: number | null;
  isDirty: boolean;
  hasPendingWork: boolean;
}

export function deriveViewState(state: AnnotationViewState): AnnotationViewDerived {
  const selectedId =
    state.type === "viewing" || state.type === "editing" ? state.selectedId : null;

  const editingId = state.type === "editing" ? state.editingId : null;

  const isDirty =
    state.type === "editing" ? state.dirty.geometry || state.dirty.label : false;

  const hasPendingWork =
    (state.type === "editing" &&
      (isDirty || state.pendingLabel !== state.originalSnapshot.label)) ||
    state.type === "drafting";

  return { selectedId, editingId, isDirty, hasPendingWork };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAnnotationViewState() {
  const [state, dispatch] = useReducer(annotationViewReducer, { type: "idle" });

  // Ref mirror for callbacks that need the latest state without stale closures
  const stateRef = useRef(state);
  stateRef.current = state;

  const derived = useMemo(() => deriveViewState(state), [state]);

  // Convenience dispatchers (stable references)
  const select = useCallback((annotationId: number | null) => {
    if (annotationId == null) {
      dispatch({ type: "DESELECT" });
    } else {
      dispatch({ type: "SELECT", annotationId });
    }
  }, []);

  const startEdit = useCallback(
    (annotationId: number, snapshot: AnnotationSnapshot) => {
      dispatch({ type: "START_EDIT", annotationId, snapshot });
    },
    []
  );

  const setGeometryDirty = useCallback(() => {
    dispatch({ type: "SET_GEOMETRY_DIRTY" });
  }, []);

  const setGeometryClean = useCallback(() => {
    dispatch({ type: "SET_GEOMETRY_CLEAN" });
  }, []);

  const setLabelDirty = useCallback((label: number | null) => {
    dispatch({ type: "SET_LABEL_DIRTY", label });
  }, []);

  const saveEditRequest = useCallback(() => {
    dispatch({ type: "SAVE_EDIT_REQUEST" });
  }, []);

  const saveEditSuccess = useCallback((annotation: Annotation2DOutput) => {
    dispatch({ type: "SAVE_EDIT_SUCCESS", annotation });
  }, []);

  const saveEditFailed = useCallback((error: string) => {
    dispatch({ type: "SAVE_EDIT_FAILED", error });
  }, []);

  const cancelEdit = useCallback(() => {
    dispatch({ type: "CANCEL_EDIT" });
  }, []);

  const startDraft = useCallback((input: Annotation2DCreateInput) => {
    dispatch({ type: "START_DRAFT", input });
  }, []);

  const setDraftLabel = useCallback((label: number | null) => {
    dispatch({ type: "SET_DRAFT_LABEL", label });
  }, []);

  const commitDraftRequest = useCallback(() => {
    dispatch({ type: "COMMIT_DRAFT_REQUEST" });
  }, []);

  const commitDraftSuccess = useCallback((annotation: Annotation2DOutput) => {
    dispatch({ type: "COMMIT_DRAFT_SUCCESS", annotation });
  }, []);

  const commitDraftFailed = useCallback((error: string) => {
    dispatch({ type: "COMMIT_DRAFT_FAILED", error });
  }, []);

  const discardDraft = useCallback(() => {
    dispatch({ type: "DISCARD_DRAFT" });
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: "CLEAR_ERROR" });
  }, []);

  return {
    state,
    dispatch,
    stateRef,
    ...derived,
    // Convenience dispatchers
    select,
    startEdit,
    setGeometryDirty,
    setGeometryClean,
    setLabelDirty,
    saveEditRequest,
    saveEditSuccess,
    saveEditFailed,
    cancelEdit,
    startDraft,
    setDraftLabel,
    commitDraftRequest,
    commitDraftSuccess,
    commitDraftFailed,
    discardDraft,
    clearError,
  };
}
