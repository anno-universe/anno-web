/** Interactive inference session state machine (SAM / SAM2–style).
 *
 * This reducer is **separate** from ``annotationViewState`` because SAM
 * interaction is session-based (N cumulative prompts → 1 candidate →
 * commit/discard), while the existing reducer models a single-annotation
 * lifecycle (select → view → edit/create → save). The two coexist at
 * ``AnnotatePage``: when a SAM session is active (``type !== "idle"``),
 * normal annotation selection/editing is paused.
 */

import type {
  InteractivePrompt,
  InteractiveSessionStartOutput,
} from "@/types/interactiveInference";

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

/** The candidate the interactive service returned. */
export interface InteractiveCandidate {
  annotation_type: string;
  label: number | null;
  polygon?: { points: number[][] } | null;
  box?: { x: number; y: number; width: number; height: number; rotation?: number } | null;
  keypoint?: { points: number[][] } | null;
  score: number | null;
  model_version: string | null;
}

export type InteractiveState =
  | { type: "idle" }
  | { type: "connecting"; session: InteractiveSessionStartOutput }
  | { type: "prompting"; session: InteractiveSessionStartOutput; prompts: InteractivePrompt[] }
  | { type: "loading"; session: InteractiveSessionStartOutput; prompts: InteractivePrompt[] }
  | {
      type: "reviewing";
      session: InteractiveSessionStartOutput;
      prompts: InteractivePrompt[];
      candidate: InteractiveCandidate;
    }
  | {
      type: "committing";
      session: InteractiveSessionStartOutput;
      candidate: InteractiveCandidate;
      saving: boolean;
      label: number | null;
    }
  | {
      type: "error";
      session: InteractiveSessionStartOutput;
      error: string;
      prompts: InteractivePrompt[];
      /** True when the user can retry (e.g. a network failure vs a 404). */
      recoverable: boolean;
    };

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type InteractiveAction =
  | { type: "START_SESSION"; session: InteractiveSessionStartOutput }
  | { type: "SESSION_READY" }
  | { type: "SESSION_ERROR"; error: string; recoverable?: boolean }
  | { type: "ADD_PROMPT"; prompt: InteractivePrompt }
  | { type: "POP_PROMPT" }
  | { type: "SEND_PROMPTS" }
  | { type: "CANDIDATE_ARRIVED"; candidate: InteractiveCandidate }
  | { type: "REFINE" }
  | { type: "SET_LABEL"; label: number | null }
  | { type: "COMMIT_REQUEST" }
  | { type: "COMMIT_SUCCESS" }
  | { type: "COMMIT_FAILED"; error: string }
  | { type: "DISCARD" };

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function interactiveReducer(
  state: InteractiveState,
  action: InteractiveAction,
): InteractiveState {
  switch (action.type) {
    // -- session lifecycle --------------------------------------------------
    case "START_SESSION":
      if (state.type !== "idle") return state;
      return { type: "connecting", session: action.session };

    case "SESSION_READY":
      if (state.type !== "connecting") return state;
      return { type: "prompting", session: state.session, prompts: [] };

    case "SESSION_ERROR":
      if (state.type === "idle" || state.type === "committing" && !("session" in state)) return state;
      return {
        type: "error",
        session: (state as { session: InteractiveSessionStartOutput }).session,
        error: action.error,
        prompts: "prompts" in state ? state.prompts : [],
        recoverable: action.recoverable ?? true,
      };

    case "DISCARD":
      if (state.type === "idle") return state;
      return { type: "idle" };

    // -- prompts ------------------------------------------------------------
    case "ADD_PROMPT":
      if (state.type === "prompting") {
        return { ...state, prompts: [...state.prompts, action.prompt] };
      }
      if (state.type === "reviewing") {
        // Adding a prompt to a candidate implicitly refines.
        return {
          type: "prompting",
          session: state.session,
          prompts: [...state.prompts, action.prompt],
        };
      }
      return state;

    case "POP_PROMPT":
      if (state.type !== "prompting" && state.type !== "reviewing") return state;
      return {
        ...state,
        prompts: state.prompts.slice(0, -1),
      };

    case "SEND_PROMPTS":
      if (state.type !== "prompting") return state;
      return { type: "loading", session: state.session, prompts: state.prompts };

    // -- candidate ----------------------------------------------------------
    case "CANDIDATE_ARRIVED":
      if (state.type !== "loading") return state;
      return {
        type: "reviewing",
        session: state.session,
        prompts: state.prompts,
        candidate: action.candidate,
      };

    // -- refine (add more prompts to a candidate) ---------------------------
    case "REFINE":
      if (state.type !== "reviewing") return state;
      return { type: "prompting", session: state.session, prompts: state.prompts };

    // -- commit -------------------------------------------------------------
    case "SET_LABEL":
      if (state.type !== "committing") return state;
      return { ...state, label: action.label };

    case "COMMIT_REQUEST":
      if (state.type !== "reviewing" && state.type !== "loading") return state;
      return {
        type: "committing",
        session: state.session,
        candidate: ("candidate" in state ? state.candidate : null) as InteractiveCandidate,
        saving: true,
        label:
          "candidate" in state && state.candidate ? state.candidate.label : null,
      };

    case "COMMIT_SUCCESS":
      if (state.type !== "committing") return state;
      return { type: "idle" };

    case "COMMIT_FAILED":
      if (state.type !== "committing") return state;
      return {
        type: "error",
        session: state.session,
        error: action.error,
        prompts: [],
        recoverable: true,
      };

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Derived helpers
// ---------------------------------------------------------------------------

export interface DerivedInteractiveState {
  /** True when a SAM session is active and normal annotation tools should be
   *  disabled. */
  isActive: boolean;
  /** True when the user is waiting on the service (connecting or loading). */
  isLoading: boolean;
  /** True when a candidate is present and ready to be committed. */
  hasCandidate: boolean;
  /** True when prompt tools (click/box) are available. */
  canPrompt: boolean;
  /** The current session start data (null when idle). */
  session: InteractiveSessionStartOutput | null;
}

export function deriveInteractiveState(
  state: InteractiveState,
): DerivedInteractiveState {
  const t = state.type;
  return {
    isActive: t !== "idle",
    isLoading: t === "connecting" || t === "loading" || t === "committing",
    hasCandidate: t === "reviewing" || t === "committing",
    canPrompt: t === "prompting" || t === "reviewing",
    session: state.type === "idle" ? null : state.session,
  };
}
