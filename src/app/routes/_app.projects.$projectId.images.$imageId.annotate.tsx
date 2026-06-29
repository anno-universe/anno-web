import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router";
import { createPortal } from "react-dom";
import { Pencil, Tag, Trash2 } from "lucide-react";
import { getProject } from "@/api/projects";
import { getImage, getImages, getOriginalImageUrl } from "@/api/images";
import {
  getAnnotations,
  createAnnotation,
  modifyAnnotation,
  deleteAnnotation,
} from "@/api/annotations";
import { getOperations } from "@/api/operations";
import {
  getProjectTags,
  getImageTags,
  applyImageTag,
  removeImageTag,
} from "@/api/tags";
import { AnnotationMap } from "@/components/annotation/AnnotationMap";
import { AnnotationToolbar } from "@/components/annotation/AnnotationToolbar";
import { AnnotationSidePanel } from "@/components/annotation/AnnotationSidePanel";
import { AnnotationInfoCard } from "@/components/annotation/AnnotationInfoCard";
import { ContextMenu } from "@/components/annotation/ContextMenu";
import { StatusBar } from "@/components/annotation/StatusBar";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { ErrorAlert } from "@/components/shared/ErrorAlert";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { AnnotationTopToolBar } from "@/components/annotation/AnnotationTopToolBar";
import type { ContextMenuAction } from "@/components/annotation/ContextMenu";
import type { InfoCardMode } from "@/components/annotation/AnnotationInfoCard";
import type { AnnotationMapHandle } from "@/components/annotation/AnnotationMap";
import { useAnnotationViewState } from "@/lib/annotation/annotationViewState";
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
import type { OperationOutput } from "@/types/operation";
import type { ProjectOutput } from "@/types/project";
import type { Image2DOutput } from "@/types/image";
import type { TagOutput, ImageTagOutput } from "@/types/tag";
import type { ToolType } from "@/components/annotation/StatusBar";

export default function AnnotatePage() {
  const { projectId, imageId } = useParams();
  const pid = Number(projectId);
  const iid = Number(imageId);

  // Data
  const [project, setProject] = useState<ProjectOutput | null>(null);
  const [image, setImage] = useState<Image2DOutput | null>(null);
  const [annotations, setAnnotations] = useState<Annotation2DOutput[]>([]);
  const [operations, setOperations] = useState<OperationOutput[]>([]);
  const [projectTags, setProjectTags] = useState<TagOutput[]>([]);
  const [imageTags, setImageTags] = useState<ImageTagOutput[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
    clearError,
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

  // Context menu
  const [ctxMenu, setCtxMenu] = useState<{
    annotationId: number;
    x: number;
    y: number;
  } | null>(null);

  // Overlay container for floating info card
  const [overlayEl, setOverlayEl] = useState<HTMLElement | null>(null);

  const mapRef = useRef<AnnotationMapHandle>(null);

  // ---- Blocking guard (used by tool changes, etc.) ----
  const blockPendingWork = useCallback(() => {
    const s = stateRef.current;
    if (s.type === "drafting") {
      setError("Save or discard the pending annotation before continuing.");
      return true;
    }
    if (s.type === "editing") {
      if (s.dirty.geometry || s.dirty.label || s.pendingLabel !== null) {
        setError("Save or revert the current edit before continuing.");
        return true;
      }
    }
    return false;
  }, []);

  // ---- Selection ----
  const selectAnnotation = useCallback(
    (id: number | null) => {
      const s = stateRef.current;
      // Blocked while drafting
      if (s.type === "drafting") {
        setError("Save or discard the pending annotation before selecting another.");
        return;
      }
      // Blocked while editing with dirty changes
      if (s.type === "editing") {
        if (s.dirty.geometry || s.dirty.label || s.pendingLabel !== null) {
          setError("Save or revert the current edit before selecting another.");
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
        setError("Save or discard the pending annotation before editing.");
        return;
      }
      // Blocked while editing another annotation with dirty changes
      if (
        s.type === "editing" &&
        s.selectedId !== id &&
        (s.dirty.geometry || s.dirty.label || s.pendingLabel !== null)
      ) {
        setError("Save or revert the current edit before editing another annotation.");
        return;
      }
      // If already editing this annotation, no-op
      if (s.type === "editing" && s.selectedId === id) return;

      // Capture geometry snapshot BEFORE dispatching START_EDIT
      const snap = mapRef.current?.captureAnnotationSnapshot(id);
      if (!snap) {
        setError("Cannot edit — annotation not found on map.");
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

    try {
      // commitEdit calls onModified which does the PATCH and returns the new annotation
      // We need to intercept this flow. Actually, commitEdit calls onModifiedRef.current
      // which is handleModify. handleModify does the API call.
      // So the flow is: commitEdit → handleModify → API → state update
      //
      // But handleModify handles its own success/failure. We need to bridge this.
      // For now, commitEdit triggers the modify flow; we'll handle the transition
      // in handleModify based on the current state.
      mapRef.current?.commitEdit(labelOverride);
      // handleModify will call saveEditSuccess or saveEditFailed
    } catch {
      saveEditFailed("Failed to save");
    }
  }, [saveEditRequest, saveEditFailed]);

  // ---- Edit revert (Revert button / Esc) ----
  const handleRevertEdit = useCallback(() => {
    mapRef.current?.cancelEdit();
    cancelEditDispatch();
  }, [cancelEditDispatch]);

  // ---- Data fetching ----
  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      // Fetch annotations/ops with max page size — map needs all annotations
      const [proj, img, annResp, opsResp] = await Promise.all([
        getProject(pid),
        getImage(pid, iid),
        getAnnotations(pid, iid, { limit: 500 }),
        getOperations(pid, iid, { limit: 500 }),
      ]);
      setProject(proj);
      setImage(img);
      setAnnotations(annResp.items);
      setOperations(opsResp.items);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }

    // Tags — fetched separately so failures don't block the main page
    loadTags();
  }

  async function loadTags() {
    try {
      const [ptags, itags] = await Promise.all([
        getProjectTags(pid, { limit: 200, is_active: true }),
        getImageTags(pid, iid),
      ]);
      setProjectTags(ptags.items);
      setImageTags(itags);
    } catch {
      // non-blocking — tag bar just stays empty
    }
  }

  useEffect(() => {
    loadAll();
  }, [pid, iid]);

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

  async function refreshOperations() {
    try {
      const opsResp = await getOperations(pid, iid, { limit: 500 });
      setOperations(opsResp.items);
    } catch {
      // non-blocking
    }
  }

  // ---- Annotation handlers ----

  /** Create the annotation on the server (used by draft commit). */
  const commitCreate = useCallback(
    async (input: Annotation2DCreateInput) => {
      try {
        const created = await createAnnotation(pid, iid, input);
        setAnnotations((prev) => [...prev, created]);
        refreshOperations();
        return created;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to create";
        setError(msg);
        return null;
      }
    },
    [pid, iid]
  );

  // A shape was drawn (box/polygon closed, keypoint group finished).
  const handleDrawComplete = useCallback(
    (input: Annotation2DCreateInput) => {
      if (stateRef.current.type === "drafting") {
        setError("Save or discard the pending annotation before drawing another.");
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

        // Update selectedId to follow the new annotation ID
        setGeometryClean();
        refreshOperations();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to modify";

        // If in save flow, report failure
        const s = stateRef.current;
        if (s.type === "editing" && s.saving) {
          saveEditFailed(msg);
        } else {
          setError(msg);
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
        setError("Save or discard the pending annotation before deleting.");
        return;
      }
      if (
        s.type === "editing" &&
        s.selectedId === annotationId &&
        (s.dirty.geometry || s.dirty.label || s.pendingLabel !== null)
      ) {
        setError("Save or revert the current edit before deleting.");
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete";
      setError(msg);
      setShowDeleteConfirm(false);
      setDeleteTargetId(null);
    }
  }, [pid, iid, deleteTargetId, select]);

  // Delete from context menu (specific annotation, not necessarily selected)
  const handleDeleteById = useCallback(
    async (annotationId: number) => {
      const s = stateRef.current;
      if (s.type === "drafting") {
        setError("Save or discard the pending annotation before deleting.");
        return;
      }
      if (
        s.type === "editing" &&
        s.selectedId === annotationId &&
        (s.dirty.geometry || s.dirty.label || s.pendingLabel !== null)
      ) {
        setError("Save or revert the current edit before deleting.");
        return;
      }
      try {
        await deleteAnnotation(pid, iid, annotationId);
        setAnnotations((prev) => prev.filter((a) => a.id !== annotationId));

        if (
          (s.type === "viewing" || s.type === "editing") &&
          s.selectedId === annotationId
        ) {
          select(null);
        }

        refreshOperations();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to delete";
        setError(msg);
      }
    },
    [pid, iid, select]
  );

  // ---- Tag handlers ----

  const handleApplyTag = useCallback(
    async (tagId: number) => {
      try {
        const applied = await applyImageTag(pid, iid, { tag_id: tagId });
        setImageTags((prev) => [...prev, applied]);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to apply tag");
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
        setError(err instanceof Error ? err.message : "Failed to remove tag");
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
    { label: "Change Label", icon: Tag },
    { label: "Delete", icon: Trash2, shortcut: "Del", destructive: true },
  ];

  function handleContextMenuAction(index: number) {
    if (!ctxMenu) return;
    const id = ctxMenu.annotationId;

    switch (index) {
      case 0: // Modify
        startEditingAnnotation(id);
        break;
      case 1: // Change Label
        selectAnnotation(id);
        break;
      case 2: // Delete
        handleDeleteById(id);
        break;
    }
  }

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
          if (activeTool === "draw-point" && keypointDraftCount > 0) {
            mapRef.current?.finishKeypointGroup();
          } else if (s.type === "drafting" && !s.saving) {
            handleSaveDraft();
          } else if (s.type === "editing" && !s.saving) {
            handleSaveEdit();
          }
          break;
        case "escape":
          setCtxMenu(null);
          if (activeTool === "draw-point" && keypointDraftCount > 0) {
            mapRef.current?.cancelKeypointGroup();
          } else if (s.type === "editing") {
            handleRevertEdit();
          } else if (s.type === "drafting") {
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
    selectAnnotation,
    changeTool,
    handleSaveDraft,
    handleSaveEdit,
    handleRevertEdit,
    handleDiscardDraft,
    requestDelete,
  ]);

  // ---- Derived values ----
  const labelMapping = labelMappingLabels(
    project?.label_mapping as Record<string, unknown>
  );
  const labelOptions = labelOptionsFromMapping(labelMapping);
  const metaInfo = upgradeMetaInfoConfig(
    project?.meta_info as Record<string, unknown>
  );
  const keypointEnabled = metaInfo.keypoint_enabled === true;
  const boxRotationEnabled = metaInfo.box_rotation_enabled === true;

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

  // InfoCard mode derived from state machine
  const infoCardMode: InfoCardMode =
    state.type === "drafting" ? "draft"
    : state.type === "editing" ? "edit"
    : state.type === "viewing" ? "view"
    : "view"; // idle → shouldn't render, but safe fallback

  // Is the info card visible?
  const showInfoCard =
    state.type === "viewing" ||
    state.type === "editing" ||
    state.type === "drafting";

  // Show error from edit state
  const editError =
    state.type === "editing" ? state.error
    : state.type === "drafting" ? state.error
    : null;

  const displayError = error || editError;

  // ---- Render ----
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner />
      </div>
    );
  }

  if (error && !image) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <ErrorAlert message={error} onRetry={loadAll} />
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
        error={displayError || undefined}
        onDismissError={() => {
          setError("");
          clearError();
        }}
      />

      {/* Main area: Toolbar | Map | SidePanel */}
      <div className="flex flex-1 overflow-hidden">
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
        />

        <AnnotationMap
          ref={mapRef}
          imageUrl={getOriginalImageUrl(pid, iid)}
          width={image.width ?? 800}
          height={image.height ?? 600}
          annotations={annotations}
          selectedAnnotationId={selectedId}
          editingAnnotationId={editingId}
          labelMapping={labelMapping}
          activeTool={activeTool}
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
        />

        {/* Floating info card — portalled into the OL overlay. Mode-driven:
            draft = label picker, edit = commit surface, view = read-only. */}
        {overlayEl &&
          showInfoCard &&
          createPortal(
            state.type === "drafting" ? (
              <AnnotationInfoCard
                annotation={{
                  annotation_type: state.pendingCreate.annotation_type,
                  label: state.selectedLabel,
                }}
                labelMapping={labelMapping}
                labelOptions={labelOptions}
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
    </div>
  );
}
