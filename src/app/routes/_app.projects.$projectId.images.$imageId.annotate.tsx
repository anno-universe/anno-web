import { useEffect, useState, useRef, useCallback, useMemo, useReducer } from "react";
import { useParams, useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import {
  getImages,
  getOriginalImageUrl,
} from "@/api/images";
import { apiGetBlob } from "@/api/client";
import {
  getAnnotations,
  createAnnotation,
  modifyAnnotation,
  deleteAnnotation,
} from "@/api/annotations";
import {
  applyImageTag,
  removeImageTag,
} from "@/api/tags";
import { queryKeys } from "@/lib/queryKeys";
import { AnnotationMap } from "@/components/annotation/AnnotationMap";
import { AnnotationToolbar } from "@/components/annotation/AnnotationToolbar";
import { AnnotationSidePanel } from "@/components/annotation/AnnotationSidePanel";
import { AnnotationInfoCard } from "@/components/annotation/AnnotationInfoCard";
import { ContextMenu } from "@/components/annotation/ContextMenu";
import { StatusBar } from "@/components/annotation/StatusBar";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorAlert } from "@/components/shared/ErrorAlert";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { AnnotationTopToolBar } from "@/components/annotation/AnnotationTopToolBar";
import { InferenceModal } from "@/components/inference/InferenceModal";
import { InteractiveInferenceModal } from "@/components/inference/InteractiveInferenceModal";
import { InteractiveToolbar } from "@/components/inference/InteractiveToolbar";
import { useAuthStore } from "@/stores/authStore";
import {
  startInteractiveSession,
  commitInteractiveSession,
  discardInteractiveSession,
} from "@/api/interactiveInference";
import { createServiceClient } from "@/api/interactiveServiceClient";
import {
  interactiveReducer,
  deriveInteractiveState,
} from "@/lib/annotation/interactiveSession";
import type { ServiceClient } from "@/api/interactiveServiceClient";
import type { InteractiveCandidate } from "@/lib/annotation/interactiveSession";
import type { InteractiveProviderOutput } from "@/types/interactiveInference";
import type { ContextMenuAction } from "@/components/annotation/ContextMenu";
import type { InfoCardMode } from "@/components/annotation/AnnotationInfoCard";
import type { AnnotationMapHandle } from "@/components/annotation/AnnotationMap";
import { useAnnotationViewState } from "@/lib/annotation/annotationViewState";
import { useAnnotationPageData } from "@/hooks/useAnnotationPageData";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import {
  labelMappingLabels,
  upgradeMetaInfoConfig,
} from "@/lib/project/configVersion";
import { labelOptionsFromMapping } from "@/lib/utils/labelMapping";
import { useSetBreadcrumb } from "@/lib/breadcrumb";
import type {
  Annotation2DOutput,
  Annotation2DCreateInput,
} from "@/types/annotation";
import type { Image2DOutput } from "@/types/image";
import type { ToolType } from "@/components/annotation/StatusBar";

export default function AnnotatePage() {
  const { projectId, imageId } = useParams();
  const pid = Number(projectId);
  const iid = Number(imageId);
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const {
    project,
    image,
    annotations,
    setAnnotations,
    operations,
    projectTags,
    imageTags,
    setImageTags,
    loading,
    error,
    reload,
    refreshOperations,
  } = useAnnotationPageData(pid, iid);

  // Image list for prev/next navigation
  const [imageList, setImageList] = useState<Image2DOutput[]>([]);
  const [imageListLoading, setImageListLoading] = useState(false);
  const navigate = useNavigate();

  // ---- Annotation state machine ----
  const {
    state,
    stateRef,
    selectedId,
    editingId,
    isDirty,
    select,
    startEdit,
    setGeometryDirty,
    setGeometryClean,
    setLabelDirty,
    saveEditRequest,
    saveEditSuccess,
    saveEditFailed,
    cancelEdit: cancelEditDispatch,
    startDraft,
    commitDraftRequest,
    commitDraftSuccess,
    commitDraftFailed,
    setDraftLabel,
    discardDraft: discardDraftDispatch,
  } = useAnnotationViewState();

  // ---- Tool / viewport state (not part of annotation state machine) ----
  const [activeTool, setActiveTool] = useState<ToolType>("select");
  const [mouseX, setMouseX] = useState<number | null>(null);
  const [mouseY, setMouseY] = useState<number | null>(null);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [drawPreview, setDrawPreview] = useState<string | null>(null);

  // Delete dialog
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);

  // Keypoint draft count (separate from annotation state — draw interaction)
  const [keypointDraftCount, setKeypointDraftCount] = useState(0);
  const keypointDraftCountRef = useRef(keypointDraftCount);
  keypointDraftCountRef.current = keypointDraftCount;

  // Warn before navigating away (prev/next, breadcrumb, back, refresh) while an
  // annotation draft, dirty edit, or in-progress keypoint would be discarded.
  const hasPendingWork =
    state.type === "drafting" ||
    (state.type === "editing" && isDirty) ||
    keypointDraftCount > 0;
  const leaveGuard = useUnsavedChangesGuard(hasPendingWork);

  // Inference modal
  const [showInferenceModal, setShowInferenceModal] = useState(false);

  // ---- Interactive SAM session ----
  const [interactiveState, dispatchInteractive] = useReducer(
    interactiveReducer,
    { type: "idle" }
  );
  const interactive = deriveInteractiveState(interactiveState);
  const [showInteractiveModal, setShowInteractiveModal] = useState(false);
  const [samTool, setSamTool] = useState<"positive_point" | "negative_point" | "box">("positive_point");
  const serviceClientRef = useRef<ServiceClient | null>(null);
  const interactiveStateRef = useRef(interactiveState);
  interactiveStateRef.current = interactiveState;
  const [samCandidateLabel, setSamCandidateLabel] = useState<number | null>(null);

  // Determine the tool passed to AnnotationMap. When interactive is active,
  // SAM tool buttons map to the corresponding canvas tool.
  const effectiveTool: ToolType = interactive.isActive
    ? (samTool === "box" ? "sam-box" : "sam-point")
    : activeTool;

  // Context menu
  const [ctxMenu, setCtxMenu] = useState<{
    annotationId: number;
    x: number;
    y: number;
  } | null>(null);

  // Overlay container for floating info card
  const [overlayEl, setOverlayEl] = useState<HTMLElement | null>(null);

  const mapRef = useRef<AnnotationMapHandle>(null);

  // Prevent Escape from cancelling an edit mid-save (race between async
  // API call in handleModify and user-triggered CANCEL_EDIT).
  const savingRef = useRef(false);

  // ---- Blocking guard (used by tool changes, etc.) ----
  const blockPendingWork = useCallback(() => {
    const s = stateRef.current;
    if (s.type === "drafting") {
      toast.error("Save or discard the pending annotation before continuing.");
      return true;
    }
    if (s.type === "editing") {
      if (
        s.dirty.geometry ||
        s.dirty.label ||
        s.pendingLabel !== s.originalSnapshot.label
      ) {
        toast.error("Save or revert the current edit before continuing.");
        return true;
      }
    }
    if (keypointDraftCountRef.current > 0) {
      toast.error("Finish or cancel the current keypoint before continuing.");
      return true;
    }
    return false;
  }, []);

  // ---- Interactive SAM handlers ----

  const handleOpenInteractiveModal = useCallback(() => {
    if (blockPendingWork()) return;
    setShowInteractiveModal(true);
  }, [blockPendingWork]);

  const handleInteractiveProviderSelected = useCallback(
    async (provider: InteractiveProviderOutput) => {
      try {
        // 1. Start the session (server handshake)
        const session = await startInteractiveSession(pid, iid, {
          provider_id: provider.id,
        });

        dispatchInteractive({ type: "START_SESSION", session });

        // 2. Create the bare service client
        const svc = createServiceClient({
          predictUrl: session.predict_url || provider.inference_url,
          sessionId: session.id,
          token: session.token,
          tokenHeader: session.token_header,
        });
        serviceClientRef.current = svc;

        // 3. Upload the image to the service (cache the embedding)
        try {
          const blob = await apiGetBlob(getOriginalImageUrl(pid, iid));
          await svc.inferImage(blob, {
            image_id: iid,
            session_id: session.id,
            label_mapping: project?.label_mapping ?? {},
            requested_types: session.supported_result_types,
            width: image?.width,
            height: image?.height,
          });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Failed to upload image";
          await Promise.allSettled([
            svc.release(),
            discardInteractiveSession(pid, iid, session.id),
          ]);
          serviceClientRef.current = null;
          dispatchInteractive({ type: "SESSION_ERROR", error: msg });
          toast.error(msg);
          setShowInteractiveModal(false);
          return;
        }

        dispatchInteractive({ type: "SESSION_READY" });
        setSamTool("positive_point");
        setShowInteractiveModal(false);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to start interactive session";
        dispatchInteractive({ type: "SESSION_ERROR", error: msg });
        toast.error(msg);
        setShowInteractiveModal(false);
      }
    },
    [pid, iid, project, image]
  );

  const handleSamPoint = useCallback((x: number, y: number) => {
    const promptType = samTool === "negative_point" ? "negative_point" : "positive_point";
    dispatchInteractive({
      type: "ADD_PROMPT",
      prompt: { type: promptType, x, y },
    });
  }, [samTool]);

  const handleSamBox = useCallback((x: number, y: number, width: number, height: number) => {
    dispatchInteractive({
      type: "ADD_PROMPT",
      prompt: { type: "box", x, y, width, height },
    });
  }, []);

  const handleSamSend = useCallback(async () => {
    const s = interactiveStateRef.current;
    if (s.type !== "prompting") return;
    const svc = serviceClientRef.current;
    if (!svc) return;

    dispatchInteractive({ type: "SEND_PROMPTS" });
    try {
      const raw = await svc.predict({
        session_id: s.session.id,
        image_id: iid,
        step_index: s.prompts.length,
        prompts: s.prompts.map((p) => ({ ...p })),
        label_mapping: project?.label_mapping ?? {},
        requested_types: s.session.supported_result_types,
        width: image?.width,
        height: image?.height,
      });

      const ann = raw.annotation as Record<string, unknown> | null;
      const candidate: InteractiveCandidate = {
        annotation_type: (ann?.["annotation_type"] as string) || "polygon",
        label: (ann?.["label"] as number) ?? null,
        polygon: ann?.["polygon"] as InteractiveCandidate["polygon"],
        box: ann?.["box"] as InteractiveCandidate["box"],
        keypoint: ann?.["keypoint"] as InteractiveCandidate["keypoint"],
        score: (raw.score as number | null) ?? null,
        model_version: (raw.model_version as string | null) ?? null,
      };

      dispatchInteractive({ type: "CANDIDATE_ARRIVED", candidate });
      setSamCandidateLabel(candidate.label);
      // Render the candidate polygon on the map.
      mapRef.current?.setSamCandidate(candidate.polygon?.points ?? null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Prediction failed";
      dispatchInteractive({ type: "SESSION_ERROR", error: msg });
      toast.error(msg);
    }
  }, [iid, project, image]);

  const handleSamCommit = useCallback(async () => {
    const s = interactiveStateRef.current;
    if (s.type !== "reviewing") return;

    dispatchInteractive({ type: "COMMIT_REQUEST" });
    try {
      const c = s.candidate;
      await commitInteractiveSession(pid, iid, s.session.id, {
        annotation_type: c.annotation_type,
        label: samCandidateLabel,
        polygon: c.polygon,
        box: c.box,
        keypoint: c.keypoint,
        prompts: s.prompts.map((p) => ({ ...p })),
        score: c.score,
        model_version: c.model_version ?? "",
      });
      dispatchInteractive({ type: "COMMIT_SUCCESS" });
      // Clean up prompt + candidate rendering for the next annotation.
      mapRef.current?.clearSamPrompts();
      mapRef.current?.setSamCandidate(null);
      setSamCandidateLabel(null);
      // Refresh annotations so the newly created one appears on the map.
      const annResp = await getAnnotations(pid, iid, { limit: 500 });
      setAnnotations(annResp.items);
      refreshOperations();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Commit failed";
      dispatchInteractive({ type: "COMMIT_FAILED", error: msg });
      toast.error(msg);
    }
  }, [pid, iid, samCandidateLabel, refreshOperations]);

  const handleSamDiscard = useCallback(async () => {
    const s = interactiveStateRef.current;
    const sid = s.type !== "idle" ? s.session.id : null;
    const svc = serviceClientRef.current;

    // Best-effort: release service session + server discard
    if (svc) svc.release().catch(() => {});
    if (sid) discardInteractiveSession(pid, iid, sid).catch(() => {});

    dispatchInteractive({ type: "DISCARD" });
    serviceClientRef.current = null;
    setSamCandidateLabel(null);
    mapRef.current?.clearSamPrompts();
    mapRef.current?.setSamCandidate(null);
  }, [pid, iid]);

  const handleSamUndo = useCallback(() => {
    const s = interactiveStateRef.current;
    if (s.type === "prompting" || s.type === "reviewing") {
      dispatchInteractive({ type: "POP_PROMPT" });
      setSamCandidateLabel(null);
      mapRef.current?.setSamCandidate(null);
      mapRef.current?.popSamPrompt();
    }
  }, []);

  // ---- Selection ----
  const selectAnnotation = useCallback(
    (id: number | null) => {
      const s = stateRef.current;
      // Blocked while drafting
      if (s.type === "drafting") {
        toast.error("Save or discard the pending annotation before selecting another.");
        return;
      }
      // Blocked while editing with dirty changes
      if (s.type === "editing") {
        if (
          s.dirty.geometry ||
          s.dirty.label ||
          s.pendingLabel !== s.originalSnapshot.label
        ) {
          toast.error("Save or revert the current edit before selecting another.");
          return;
        }
      }
      // If deselecting while editing (clean), cancel edit first
      if (id === null && s.type === "editing") {
        mapRef.current?.cancelEdit();
        cancelEditDispatch();
        return;
      }
      select(id);
    },
    [select, cancelEditDispatch]
  );

  // ---- Edit start (double-click or context menu "Modify") ----
  const startEditingAnnotation = useCallback(
    (id: number) => {
      const s = stateRef.current;
      // Blocked while drafting
      if (s.type === "drafting") {
        toast.error("Save or discard the pending annotation before editing.");
        return;
      }
      // Blocked while editing another annotation with dirty changes
      if (
        s.type === "editing" &&
        s.selectedId !== id &&
        (s.dirty.geometry ||
          s.dirty.label ||
          s.pendingLabel !== s.originalSnapshot.label)
      ) {
        toast.error("Save or revert the current edit before editing another annotation.");
        return;
      }
      // If already editing this annotation, no-op
      if (s.type === "editing" && s.selectedId === id) return;

      // Capture geometry snapshot BEFORE dispatching START_EDIT
      const snap = mapRef.current?.captureAnnotationSnapshot(id);
      if (!snap) {
        toast.error("Cannot edit — annotation not found on map.");
        return;
      }

      startEdit(id, snap);
      setActiveTool("select");
    },
    [startEdit]
  );

  // ---- Tool change ----
  const changeTool = useCallback(
    (tool: ToolType) => {
      if (tool === activeTool) return;
      if (interactiveStateRef.current.type !== "idle") return; // blocked during SAM
      if (blockPendingWork()) return;
      setActiveTool(tool);
      // Leaving select mode: if editing, cancel it
      if (tool !== "select" && stateRef.current.type === "editing") {
        mapRef.current?.cancelEdit();
        cancelEditDispatch();
      }
    },
    [activeTool, blockPendingWork, cancelEditDispatch]
  );

  // ---- Edit commit (Save button) ----
  const handleSaveEdit = useCallback(async () => {
    const s = stateRef.current;
    if (s.type !== "editing") return;

    const labelOverride =
      s.pendingLabel !== s.originalSnapshot.label
        ? s.pendingLabel
        : undefined;

    saveEditRequest();
    savingRef.current = true;

    try {
      mapRef.current?.commitEdit(labelOverride);
      // handleModify will call saveEditSuccess or saveEditFailed
    } catch {
      saveEditFailed("Couldn't save your changes.");
      toast.error("Couldn't save your changes. Please try again.");
    } finally {
      savingRef.current = false;
    }
  }, [saveEditRequest, saveEditFailed]);

  // ---- Edit revert (Revert button / Esc) ----
  const handleRevertEdit = useCallback(() => {
    mapRef.current?.cancelEdit();
    cancelEditDispatch();
  }, [cancelEditDispatch]);

  // Release image-scoped inference resources when navigating or unmounting.
  useEffect(() => {
    return () => {
      const current = interactiveStateRef.current;
      const serviceClient = serviceClientRef.current;
      if (serviceClient) void serviceClient.release();
      if (current.type !== "idle") {
        void discardInteractiveSession(pid, iid, current.session.id);
        dispatchInteractive({ type: "DISCARD" });
      }
      serviceClientRef.current = null;
      mapRef.current?.clearSamPrompts();
      mapRef.current?.setSamCandidate(null);
    };
  }, [pid, iid]);

  // ---- Inference completion handler ----
  const handleInferenceComplete = useCallback(
    async (_annotationsCreated: number) => {
      try {
        const annResp = await getAnnotations(pid, iid, { limit: 500 });
        setAnnotations(annResp.items);
        refreshOperations();
      } catch {
        // non-blocking
      }
    },
    [pid, iid]
  );

  // Fetch image list for prev/next navigation (non-blocking)
  useEffect(() => {
    let cancelled = false;
    setImageListLoading(true);
    getImages(pid, { limit: 500 })
      .then((resp) => {
        if (!cancelled) setImageList(resp.items);
      })
      .catch(() => {
        // non-blocking — prev/next buttons stay disabled
      })
      .finally(() => {
        if (!cancelled) setImageListLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pid]);

  // Reset annotation state when switching images
  useEffect(() => {
    mapRef.current?.cancelEdit();
    mapRef.current?.clearDraft();
    const s = stateRef.current;
    if (s.type === "drafting") discardDraftDispatch();
    if (s.type === "editing") cancelEditDispatch();
    select(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iid]);

  // Register project name + image filename as dynamic breadcrumb segments.
  useSetBreadcrumb("project", project?.name ?? null);
  useSetBreadcrumb("image", image?.file_name ?? null);

  // Prev/next image navigation
  const imageIndex = imageList.findIndex((img) => img.id === iid);
  const prevImageId =
    imageIndex > 0 ? imageList[imageIndex - 1].id : undefined;
  const nextImageId =
    imageIndex < imageList.length - 1
      ? imageList[imageIndex + 1].id
      : undefined;

  const handleNavigate = useCallback(
    (imageId: number) => {
      navigate(`/projects/${pid}/images/${imageId}/annotate`);
    },
    [navigate, pid],
  );

  // ---- Annotation handlers ----

  /** Create the annotation on the server (used by draft commit). */
  const commitCreate = useCallback(
    async (input: Annotation2DCreateInput) => {
      try {
        const created = await createAnnotation(pid, iid, input);
        setAnnotations((prev) => [...prev, created]);
        refreshOperations();
        // Keep the images-list annotation_count fresh on back-navigation.
        queryClient.invalidateQueries({ queryKey: queryKeys.images.all(pid) });
        return created;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to create";
        toast.error(msg);
        return null;
      }
    },
    [pid, iid, queryClient]
  );

  // A shape was drawn (box/polygon closed, keypoint group finished).
  const handleDrawComplete = useCallback(
    (input: Annotation2DCreateInput) => {
      if (stateRef.current.type === "drafting") {
        toast.error("Save or discard the pending annotation before drawing another.");
        return;
      }
      startDraft(input);
    },
    [startDraft]
  );

  // Draft label change — local only, does NOT save to server.
  const handleDraftLabelChange = useCallback(
    (newLabel: number | null) => {
      setDraftLabel(newLabel);
    },
    [setDraftLabel]
  );

  // Commit the draft to the server (Save button in draft card).
  const handleSaveDraft = useCallback(async () => {
    const s = stateRef.current;
    if (s.type !== "drafting") return;

    // The preview box may have been resized/rotated after it was drawn, so read
    // the live geometry off the map (falling back to the original draw payload).
    const liveInput = mapRef.current?.getDraftAnnotationInput();

    commitDraftRequest();
    savingRef.current = true;
    try {
      const created = await commitCreate({
        ...(liveInput ?? s.pendingCreate),
        label: s.selectedLabel,
      });
      if (!created) {
        commitDraftFailed("Failed to create annotation");
        return;
      }

      mapRef.current?.clearDraft();
      commitDraftSuccess(created);
    } finally {
      savingRef.current = false;
    }
  }, [commitCreate, commitDraftRequest, commitDraftFailed, commitDraftSuccess]);

  // Discard the draft without creating anything.
  const handleDiscardDraft = useCallback(() => {
    mapRef.current?.clearDraft();
    discardDraftDispatch();
  }, [discardDraftDispatch]);

  // Modify handler — called by AnnotationMap.commitEdit
  const handleModify = useCallback(
    async (annotationId: number, input: Annotation2DCreateInput) => {
      try {
        const modified = await modifyAnnotation(
          pid,
          iid,
          annotationId,
          input
        );
        setAnnotations((prev) =>
          prev
            .map((a) => (a.id === annotationId ? null : a))
            .filter(Boolean)
            .concat(modified) as Annotation2DOutput[]
        );

        // If we're in an edit save flow, transition to viewing with new id
        const s = stateRef.current;
        if (s.type === "editing" && s.saving) {
          saveEditSuccess(modified);
        }

        refreshOperations();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to modify";

        // If in save flow, report failure
        const s = stateRef.current;
        if (s.type === "editing" && s.saving) {
          saveEditFailed(msg);
        } else {
          toast.error(msg);
        }
      }
    },
    [pid, iid, saveEditSuccess, saveEditFailed, setGeometryClean]
  );

  // Label change from the info card — in edit mode, marks dirty
  const handleLabelChange = useCallback(
    (newLabel: number | null) => {
      const s = stateRef.current;
      if (s.type === "editing") {
        setLabelDirty(newLabel);
      }
      // In view mode, this callback is never called (label is read-only)
      // In draft mode, onLabelChange is handlePickLabel
    },
    [setLabelDirty]
  );

  // ---- Delete ----
  const requestDelete = useCallback(
    (annotationId: number) => {
      const s = stateRef.current;
      if (s.type === "drafting") {
        toast.error("Save or discard the pending annotation before deleting.");
        return;
      }
      if (
        s.type === "editing" &&
        s.selectedId === annotationId &&
        (s.dirty.geometry ||
          s.dirty.label ||
          s.pendingLabel !== s.originalSnapshot.label)
      ) {
        toast.error("Save or revert the current edit before deleting.");
        return;
      }
      setDeleteTargetId(annotationId);
      setShowDeleteConfirm(true);
    },
    []
  );

  const handleDelete = useCallback(async () => {
    if (deleteTargetId == null) return;
    const targetId = deleteTargetId;
    try {
      await deleteAnnotation(pid, iid, targetId);
      setAnnotations((prev) => prev.filter((a) => a.id !== targetId));

      // If the deleted annotation was selected, deselect
      const s = stateRef.current;
      if (
        (s.type === "viewing" || s.type === "editing") &&
        s.selectedId === targetId
      ) {
        select(null);
      }

      setShowDeleteConfirm(false);
      setDeleteTargetId(null);
      refreshOperations();
      // Keep the images-list annotation_count fresh on back-navigation.
      queryClient.invalidateQueries({ queryKey: queryKeys.images.all(pid) });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete";
      toast.error(msg);
      setShowDeleteConfirm(false);
      setDeleteTargetId(null);
    }
  }, [pid, iid, deleteTargetId, select, queryClient]);

  // ---- Tag handlers ----

  const handleApplyTag = useCallback(
    async (tagId: number) => {
      try {
        const applied = await applyImageTag(pid, iid, { tag_id: tagId });
        setImageTags((prev) => [...prev, applied]);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to apply tag";
        toast.error(msg);
      }
    },
    [pid, iid]
  );

  const handleRemoveTag = useCallback(
    async (tagId: number) => {
      try {
        await removeImageTag(pid, iid, tagId);
        setImageTags((prev) => prev.filter((t) => t.tag_id !== tagId));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to remove tag";
        toast.error(msg);
      }
    },
    [pid, iid]
  );

  // ---- Context menu ----
  const handleAnnotationContextMenu = useCallback(
    (annotationId: number, screenX: number, screenY: number) => {
      setCtxMenu({ annotationId, x: screenX, y: screenY });
    },
    []
  );

  const contextMenuActions: ContextMenuAction[] = [
    { label: "Modify", icon: Pencil, shortcut: "drag" },
    { label: "Delete", icon: Trash2, shortcut: "Del", destructive: true },
  ];

  function handleContextMenuAction(index: number) {
    if (!ctxMenu) return;
    const id = ctxMenu.annotationId;

    switch (index) {
      case 0: // Modify
        startEditingAnnotation(id);
        break;
      case 1: // Delete
        requestDelete(id);
        break;
    }
  }

  const metaInfo = upgradeMetaInfoConfig(
    project?.meta_info as Record<string, unknown>
  );
  const keypointEnabled = metaInfo.keypoint_enabled === true;
  const boxRotationEnabled = metaInfo.box_rotation_enabled === true;

  // ---- Keyboard shortcuts ----
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      )
        return;

      const s = stateRef.current;
      const key = e.key.toLowerCase();
      switch (key) {
        case "v":
          changeTool("select");
          break;
        case "h":
          changeTool("pan");
          break;
        case "b":
          changeTool("draw-box");
          break;
        case "p":
          changeTool("draw-polygon");
          break;
        case "k":
          if (keypointEnabled) changeTool("draw-point");
          break;
        case "delete":
        case "backspace":
          if (
            (s.type === "viewing" || s.type === "editing") &&
            activeTool === "select"
          ) {
            requestDelete(s.selectedId);
          }
          break;
        case "enter":
          if (interactive.isActive) {
            const ist = interactiveStateRef.current;
            if (ist.type === "reviewing") {
              handleSamCommit();
            } else if (ist.type === "prompting" && ist.prompts.length > 0) {
              handleSamSend();
            }
          } else if (activeTool === "draw-point" && keypointDraftCount > 0) {
            mapRef.current?.finishKeypointGroup();
          } else if (s.type === "drafting" && !s.saving) {
            handleSaveDraft();
          } else if (s.type === "editing" && !s.saving) {
            handleSaveEdit();
          }
          break;
        case "escape":
          if (interactive.isActive) {
            handleSamDiscard();
            break;
          }
          setCtxMenu(null);
          if (activeTool === "draw-point" && keypointDraftCount > 0) {
            mapRef.current?.cancelKeypointGroup();
          } else if (s.type === "editing" && !savingRef.current) {
            handleRevertEdit();
          } else if (s.type === "drafting" && !savingRef.current) {
            handleDiscardDraft();
          } else {
            selectAnnotation(null);
            changeTool("select");
          }
          break;
        case "f":
          mapRef.current?.fitView();
          break;
        case "1":
          mapRef.current?.zoom100();
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedId,
    activeTool,
    keypointDraftCount,
    keypointEnabled,
    interactive.isActive,
    selectAnnotation,
    changeTool,
    handleSaveDraft,
    handleSaveEdit,
    handleRevertEdit,
    handleDiscardDraft,
    requestDelete,
    handleSamSend,
    handleSamCommit,
    handleSamDiscard,
  ]);

  // ---- Derived values ----
  const labelMapping = labelMappingLabels(
    project?.label_mapping as Record<string, unknown>
  );
  const labelOptions = labelOptionsFromMapping(labelMapping);

  // Unique labels used across all annotations on this image (for dropdown when no mapping).
  const usedLabels = useMemo(() => {
    const set = new Set<number>();
    for (const a of annotations) {
      if (a.label != null) set.add(a.label);
    }
    return [...set].sort((a, b) => a - b);
  }, [annotations]);

  // Selected annotation for the info card
  const selectedAnnotation = useMemo(() => {
    if (state.type !== "viewing" && state.type !== "editing") return null;
    return annotations.find((a) => a.id === state.selectedId) ?? null;
  }, [state, annotations]);

  // Display annotation: apply pending label in edit mode
  const displayAnnotation = useMemo(() => {
    if (!selectedAnnotation) return null;
    if (
      state.type === "editing" &&
      state.pendingLabel !== state.originalSnapshot.label
    ) {
      return { ...selectedAnnotation, label: state.pendingLabel };
    }
    return selectedAnnotation;
  }, [selectedAnnotation, state]);

  // SAM candidate card annotation (reviewing or committing state)
  const samCandidateAnnotation = useMemo(() => {
    if (interactiveState.type === "reviewing" || interactiveState.type === "committing") {
      const c = interactiveState.candidate;
      return {
        annotation_type: c.annotation_type,
        label: interactiveState.type === "committing" ? interactiveState.label : samCandidateLabel,
      };
    }
    return null;
  }, [interactiveState, samCandidateLabel]);

  // InfoCard mode derived from state machine
  const infoCardMode: InfoCardMode =
    interactiveState.type === "reviewing" || interactiveState.type === "committing"
    ? "draft"
    : state.type === "drafting" ? "draft"
    : state.type === "editing" ? "edit"
    : state.type === "viewing" ? "view"
    : "view"; // idle → shouldn't render, but safe fallback

  // Is the info card visible?
  const showInfoCard =
    state.type === "viewing" ||
    state.type === "editing" ||
    state.type === "drafting" ||
    interactiveState.type === "reviewing" ||
    interactiveState.type === "committing";

  // ---- Render ----
  if (loading) {
    return (
      <div className="flex h-[calc(100vh-5rem)] flex-col">
        <Skeleton className="h-12 w-full rounded-none" />
        <div className="flex flex-1">
          <Skeleton className="flex-1 rounded-none" />
          <div className="flex w-80 shrink-0 flex-col gap-4 border-l p-4">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-48 w-full rounded-md" />
            <Skeleton className="h-36 w-full rounded-md" />
          </div>
        </div>
      </div>
    );
  }

  if (error && !image) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <ErrorAlert message={error} onRetry={reload} />
      </div>
    );
  }

  if (!image) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <p className="text-sm text-muted-foreground">Image not found.</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-5rem)] flex-col">
      <AnnotationTopToolBar
        image={image}
        prevImageId={prevImageId}
        nextImageId={nextImageId}
        onNavigate={handleNavigate}
        imagesLoading={imageListLoading}
        imageTags={imageTags}
        projectTags={projectTags}
        onApplyTag={handleApplyTag}
        onRemoveTag={handleRemoveTag}
        currentUserId={user?.id}
        userRole={project?.my_role}
      />

      {/* Main area: Toolbar | Map | SidePanel */}
      <div className="relative flex flex-1 overflow-hidden">
        <AnnotationToolbar
          activeTool={activeTool}
          onToolChange={changeTool}
          selectedCount={selectedId != null ? 1 : 0}
          onDeleteSelected={() => {
            if (selectedId != null) requestDelete(selectedId);
          }}
          onZoomIn={() => mapRef.current?.zoomIn()}
          onZoomOut={() => mapRef.current?.zoomOut()}
          onFitView={() => mapRef.current?.fitView()}
          onZoom100={() => mapRef.current?.zoom100()}
          keypointDrafting={
            activeTool === "draw-point" && keypointDraftCount > 0
          }
          draftCount={keypointDraftCount}
          onFinishKeypoint={() => mapRef.current?.finishKeypointGroup()}
          onCancelKeypoint={() => mapRef.current?.cancelKeypointGroup()}
          keypointEnabled={keypointEnabled}
          onOpenInference={
            project?.my_role != null
              ? () => setShowInferenceModal(true)
              : undefined
          }
          onOpenInteractive={
            project?.my_role != null
              ? () => handleOpenInteractiveModal()
              : undefined
          }
          interactiveActive={interactive.isActive}
        />

        {/* Interactive SAM toolbar — floats above the map */}
        {interactive.isActive && (
          <InteractiveToolbar
            activeTool={samTool}
            onToolChange={setSamTool}
            prompts={
              "prompts" in interactiveState ? interactiveState.prompts : []
            }
            canSend={
              interactiveState.type === "prompting" &&
              interactiveState.prompts.length > 0
            }
            isLoading={interactiveState.type === "loading"}
            hasCandidate={interactive.hasCandidate}
            onSend={handleSamSend}
            onUndo={handleSamUndo}
            onDiscard={handleSamDiscard}
          />
        )}

        <AnnotationMap
          ref={mapRef}
          imageUrl={getOriginalImageUrl(pid, iid)}
          width={image.width ?? 800}
          height={image.height ?? 600}
          annotations={annotations}
          selectedAnnotationId={selectedId}
          editingAnnotationId={editingId}
          labelMapping={labelMapping}
          activeTool={effectiveTool}
          onDrawComplete={handleDrawComplete}
          onModified={handleModify}
          onSelect={selectAnnotation}
          onEditStart={startEditingAnnotation}
          onCoordinateChange={(x, y) => {
            setMouseX(x);
            setMouseY(y);
          }}
          onZoomChange={setZoomPercent}
          onDrawPreview={setDrawPreview}
          onAnnotationContextMenu={handleAnnotationContextMenu}
          overlayContainerRef={setOverlayEl}
          onEditStateChange={(dirty) => {
            if (dirty) {
              setGeometryDirty();
            } else {
              setGeometryClean();
            }
          }}
          onKeypointDraftChange={setKeypointDraftCount}
          boxRotationEnabled={boxRotationEnabled}
          onSamPoint={handleSamPoint}
          onSamBox={handleSamBox}
          interactiveActive={interactive.isActive}
          samPointNegative={samTool === "negative_point"}
          hasSamCandidate={interactiveState.type === "reviewing"}
        />

        {/* Floating info card — portalled into the OL overlay. Mode-driven:
            draft = label picker, edit = commit surface, view = read-only. */}
        {overlayEl &&
          showInfoCard &&
          createPortal(
            (interactiveState.type === "reviewing" || interactiveState.type === "committing") ? (
              <AnnotationInfoCard
                annotation={samCandidateAnnotation}
                labelMapping={labelMapping}
                labelOptions={labelOptions}
                usedLabels={usedLabels}
                mode="draft"
                saving={interactiveState.type === "committing"}
                onSave={handleSamCommit}
                onLabelChange={(lbl) => {
                  setSamCandidateLabel(lbl);
                  dispatchInteractive({ type: "SET_LABEL", label: lbl });
                }}
                onDelete={handleSamUndo}
              />
            ) : state.type === "drafting" ? (
              <AnnotationInfoCard
                annotation={{
                  annotation_type: state.pendingCreate.annotation_type,
                  label: state.selectedLabel,
                }}
                labelMapping={labelMapping}
                labelOptions={labelOptions}
                usedLabels={usedLabels}
                mode="draft"
                saving={state.saving}
                onSave={handleSaveDraft}
                onLabelChange={handleDraftLabelChange}
                onDelete={handleDiscardDraft}
              />
            ) : (
              <AnnotationInfoCard
                annotation={displayAnnotation}
                labelMapping={labelMapping}
                labelOptions={labelOptions}
                usedLabels={usedLabels}
                mode={infoCardMode}
                saving={state.type === "editing" ? state.saving : false}
                isDirty={isDirty}
                onSave={handleSaveEdit}
                onRevert={handleRevertEdit}
                onLabelChange={handleLabelChange}
                onDelete={() => {
                  const id =
                    state.type === "viewing" || state.type === "editing"
                      ? state.selectedId
                      : null;
                  if (id != null) requestDelete(id);
                }}
              />
            ),
            overlayEl
          )}

        <AnnotationSidePanel
          annotations={annotations}
          selectedId={selectedId}
          onSelect={selectAnnotation}
          operations={operations}
          labelMapping={labelMapping}
        />
      </div>

      {/* Status bar */}
      <StatusBar
        activeTool={activeTool}
        mouseX={mouseX}
        mouseY={mouseY}
        zoomPercent={Math.round(zoomPercent * 100)}
        drawPreview={drawPreview ?? undefined}
      />

      {/* Right-click context menu */}
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          actions={contextMenuActions}
          onAction={handleContextMenuAction}
          onDismiss={() => setCtxMenu(null)}
        />
      )}

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete Annotation"
        message={`Delete annotation #${deleteTargetId}? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setDeleteTargetId(null);
        }}
      />

      <ConfirmDialog
        open={leaveGuard.blocked}
        title="Discard unsaved annotation?"
        message="You have an unsaved annotation. If you leave now, it will be lost."
        confirmLabel="Leave"
        onConfirm={leaveGuard.proceed}
        onCancel={leaveGuard.cancel}
      />

      {/* Inference modal — available to all project members */}
      {project?.my_role != null && (
        <InferenceModal
          open={showInferenceModal}
          projectId={pid}
          imageId={iid}
          onClose={() => setShowInferenceModal(false)}
          onComplete={handleInferenceComplete}
        />
      )}
      {/* Interactive SAM modal */}
      {project?.my_role != null && (
        <InteractiveInferenceModal
          open={showInteractiveModal}
          projectId={pid}
          onClose={() => setShowInteractiveModal(false)}
          onProviderSelected={handleInteractiveProviderSelected}
        />
      )}
    </div>
  );
}
