import {
  useEffect,
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import Map from "ol/Map";
import View from "ol/View";
import Overlay from "ol/Overlay";
import Collection from "ol/Collection";
import Feature from "ol/Feature";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import ImageLayer from "ol/layer/Image";
import StaticImage from "ol/source/ImageStatic";
import Point from "ol/geom/Point";
import MultiPoint from "ol/geom/MultiPoint";
import Polygon from "ol/geom/Polygon";
import Modify from "ol/interaction/Modify";
import DoubleClickZoom from "ol/interaction/DoubleClickZoom";
import type { default as OLMap } from "ol/Map";
import { unByKey } from "ol/Observable";
import { apiGetBlob } from "@/api/client";

// Sentinel id for the not-yet-committed annotation being drawn (awaiting a
// label). Negative so it never collides with real backend ids.
const DRAFT_ID = -1;

/** Reorder a box feature's ring so the rotate handle binds to its top edge. */
function normalizeBoxFeatureWinding(feature: Feature): void {
  const g = feature.getGeometry();
  if (!(g instanceof Polygon)) return;
  const corners = g.getCoordinates()[0].slice(0, 4) as [number, number][];
  if (corners.length !== 4) return;
  const ring = normalizeBoxTopEdge(corners);
  feature.setGeometry(new Polygon([[...ring, ring[0]]]));
}
import {
  annotationToFeature,
  featureToAnnotationInput,
  boxDataToGeometry,
  polygonPointsToGeometry,
  keypointPointsToGeometry,
} from "@/lib/annotation/annotationCodec";
import {
  featureStyleFunction,
  keypointDraftStyleFn,
} from "@/lib/annotation/annotationStyle";
import {
  createDrawBoxInteraction,
  createDrawPolygonInteraction,
  createSelectInteraction,
  createTranslateInteraction,
  createKeypointModifyInteraction,
  createBoxEditInteraction,
  createPolygonEditInteraction,
  normalizeBoxTopEdge,
} from "@/lib/annotation/mapInteractions";
import { mapToImage } from "@/lib/annotation/imageProjection";
import type {
  Annotation2DOutput,
  Annotation2DCreateInput,
  AnnotationType,
} from "@/types/annotation";
import type { ToolType } from "./StatusBar";

import GeoJSON from "ol/format/GeoJSON";

export interface AnnotationSnapshot {
  annotationId: number;
  label: number | null;
  /** GeoJSON geometry object — serialised from the OL feature at edit-start. */
  geometry: Record<string, unknown>;
}

export interface AnnotationMapHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  fitView: () => void;
  zoom100: () => void;
  /** Commit pending geometry edits on the selected annotation (one PATCH). */
  commitEdit: (labelOverride?: number | null) => void;
  /** Discard pending geometry edits, restoring from the captured snapshot. */
  cancelEdit: () => void;
  /** Finish the in-progress keypoint group (moves it to awaiting-label). */
  finishKeypointGroup: () => void;
  /** Discard the in-progress keypoint group. */
  cancelKeypointGroup: () => void;
  /** Remove the draft feature once the parent has created (or discarded) it. */
  clearDraft: () => void;
  /**
   * Read the live geometry of the on-map draft (id = -1) as a create payload.
   * Returns null when no draft is present. The page calls this just before
   * POSTing so resize/rotate edits applied to the preview box are included.
   */
  getDraftAnnotationInput: () => Annotation2DCreateInput | null;
  /**
   * Capture a serialisable snapshot of an annotation's current geometry +
   * label. Called by the page just before dispatching START_EDIT so the
   * reducer holds an immutable reference point for revert.
   */
  captureAnnotationSnapshot: (annotationId: number) => AnnotationSnapshot | null;
}

interface Props {
  imageUrl: string;
  width: number;
  height: number;
  annotations: Annotation2DOutput[];
  selectedAnnotationId: number | null;
  editingAnnotationId: number | null;
  labelMapping: Record<string, unknown>;
  activeTool: ToolType;
  /** A shape was drawn; geometry is ready but the label is not chosen yet. */
  onDrawComplete: (input: Annotation2DCreateInput) => void;
  onModified: (annotationId: number, input: Annotation2DCreateInput) => void;
  onSelect: (id: number | null) => void;
  onEditStart: (id: number) => void;
  onCoordinateChange: (x: number, y: number) => void;
  onZoomChange: (zoom: number) => void;
  onDrawPreview?: (info: string | null) => void;
  /** Fire when user right-clicks an annotation on the map */
  onAnnotationContextMenu?: (
    annotationId: number,
    screenX: number,
    screenY: number
  ) => void;
  /** Callback exposing the overlay DOM element so parent can portal React content into it */
  overlayContainerRef?: (el: HTMLElement | null) => void;
  /** Report whether the selected annotation has uncommitted geometry edits */
  onEditStateChange?: (dirty: boolean) => void;
  /** Report the number of points in the in-progress keypoint group */
  onKeypointDraftChange?: (count: number) => void;
  /** Project flag: expose a rotation handle when editing/drafting boxes. */
  boxRotationEnabled?: boolean;
}

export const AnnotationMap = forwardRef<AnnotationMapHandle, Props>(
  function AnnotationMap(
    {
      imageUrl,
      width,
      height,
      annotations,
      selectedAnnotationId,
      editingAnnotationId,
      labelMapping,
      activeTool,
      onDrawComplete,
      onModified,
      onSelect,
      onEditStart,
      onCoordinateChange,
      onZoomChange,
      onDrawPreview,
      onAnnotationContextMenu,
      overlayContainerRef,
      onEditStateChange,
      onKeypointDraftChange,
      boxRotationEnabled,
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<OLMap | null>(null);
    const vectorSourceRef = useRef<VectorSource | null>(null);
    const draftSourceRef = useRef<VectorSource | null>(null);
    const vectorLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
    const selectRef =
      useRef<ReturnType<typeof createSelectInteraction> | null>(null);
    const modifyRef = useRef<Modify | null>(null);
    const translateRef =
      useRef<ReturnType<typeof createTranslateInteraction> | null>(null);
    const boxEditRef =
      useRef<ReturnType<typeof createBoxEditInteraction> | null>(null);
    const polyEditRef =
      useRef<ReturnType<typeof createPolygonEditInteraction> | null>(null);
    // Box-edit interaction attached to the live draft preview (id = -1).
    const draftEditRef =
      useRef<ReturnType<typeof createBoxEditInteraction> | null>(null);
    const drawBoxRef =
      useRef<ReturnType<typeof createDrawBoxInteraction> | null>(null);
    const drawPolygonRef =
      useRef<ReturnType<typeof createDrawPolygonInteraction> | null>(null);
    const blobUrlRef = useRef<string | null>(null);
    const overlayRef = useRef<Overlay | null>(null);
    const overlayDivRef = useRef<HTMLElement | null>(null);
    const dblClickZoomRef = useRef<DoubleClickZoom | null>(null);
    const keypointHandlersRef = useRef<{
      onSingle: (e: any) => void;
      onDbl: (e: any) => void;
    } | null>(null);

    // Edit-session state
    const editFeaturesRef = useRef<Collection<Feature>>(new Collection());
    const editDirtyRef = useRef(false);
    const editingIdRef = useRef<number | null>(null);
    /**
     * Geometry + label snapshot captured at edit-start.
     * Used by cancelEdit to restore the feature to its pre-edit state
     * regardless of what the OL Modify interaction has accumulated.
     */
    const editSnapshotRef = useRef<AnnotationSnapshot | null>(null);
    const keypointDraftRef = useRef<number[][]>([]);
    // Whether an uncommitted draft feature (awaiting label) is on the map.
    const hasDraftRef = useRef(false);
    const previousToolRef = useRef<ToolType>(activeTool);
    const previousSelectedIdRef = useRef<number | null>(selectedAnnotationId);
    const previousEditingIdRef = useRef<number | null>(editingAnnotationId);
    const pointerFrameRef = useRef<number | null>(null);
    const latestPointerCoordinateRef = useRef<number[] | null>(null);
    const positionOverlayFrameRef = useRef<number | null>(null);

    // Mirrors of props/callbacks read inside long-lived interaction closures
    const activeToolRef = useRef(activeTool);
    const selectedIdRef = useRef(selectedAnnotationId);
    const editingIdRefMirror = useRef(editingAnnotationId);
    const labelMappingRef = useRef(labelMapping);
    const annotationsRef = useRef(annotations);
    const onDrawCompleteRef = useRef(onDrawComplete);
    const onModifiedRef = useRef(onModified);
    const onSelectRef = useRef(onSelect);
    const onEditStartRef = useRef(onEditStart);
    const onDrawPreviewRef = useRef(onDrawPreview);
    const onAnnotationContextMenuRef = useRef(onAnnotationContextMenu);
    const onEditStateChangeRef = useRef(onEditStateChange);
    const onKeypointDraftChangeRef = useRef(onKeypointDraftChange);
    const boxRotationEnabledRef = useRef(boxRotationEnabled);

    activeToolRef.current = activeTool;
    selectedIdRef.current = selectedAnnotationId;
    editingIdRefMirror.current = editingAnnotationId;
    labelMappingRef.current = labelMapping;
    annotationsRef.current = annotations;
    onDrawCompleteRef.current = onDrawComplete;
    onModifiedRef.current = onModified;
    onSelectRef.current = onSelect;
    onEditStartRef.current = onEditStart;
    onDrawPreviewRef.current = onDrawPreview;
    onAnnotationContextMenuRef.current = onAnnotationContextMenu;
    onEditStateChangeRef.current = onEditStateChange;
    onKeypointDraftChangeRef.current = onKeypointDraftChange;
    boxRotationEnabledRef.current = boxRotationEnabled;

    // ---- Edit-session helpers ----
    const notifyDirty = useCallback((dirty: boolean) => {
      editDirtyRef.current = dirty;
      onEditStateChangeRef.current?.(dirty);
    }, []);

    const refreshFeatureStyles = useCallback((ids: Array<number | null>) => {
      const source = vectorSourceRef.current;
      if (!source) return;
      ids.forEach((id) => {
        if (id == null) return;
        source.getFeatureById(id)?.changed();
      });
    }, []);

    const commitEditById = useCallback(
      (id: number, labelOverride?: number | null) => {
        const feature = vectorSourceRef.current?.getFeatureById(id);
        if (!feature) {
          notifyDirty(false);
          return;
        }
        const type = (feature.get("annotation_type") || "box") as AnnotationType;
        const label =
          labelOverride !== undefined
            ? labelOverride
            : ((feature.get("label") ?? null) as number | null);
        try {
          const input = featureToAnnotationInput(feature, type, label);
          onModifiedRef.current?.(id, input);
        } catch {
          /* invalid geometry — skip */
        }
        // Clear the snapshot — changes are committed
        editSnapshotRef.current = null;
        notifyDirty(false);
      },
      [notifyDirty]
    );

    /**
     * Restore a feature's geometry + label from the captured snapshot.
     * Falls back to `_backendData` if no snapshot was stored (legacy path).
     */
    const cancelEditById = useCallback(
      (id: number) => {
        const feature = vectorSourceRef.current?.getFeatureById(id);
        if (!feature) return;

        const snap = editSnapshotRef.current;
        if (snap && snap.annotationId === id) {
          // Restore from captured snapshot (primary path)
          try {
            const fmt = new GeoJSON();
            const geom = fmt.readGeometry(snap.geometry);
            if (geom) feature.setGeometry(geom);
            feature.set("label", snap.label);
          } catch {
            /* invalid snapshot geometry — leave as-is */
          }
        } else {
          // Fallback: restore from _backendData (legacy)
          const data = feature.get("_backendData");
          const type = feature.get("annotation_type");
          if (data) {
            try {
              if (type === "box") {
                feature.setGeometry(boxDataToGeometry(data));
              } else if (type === "polygon" && data.points) {
                feature.setGeometry(polygonPointsToGeometry(data.points));
              } else if (type === "keypoint" && data.points) {
                feature.setGeometry(keypointPointsToGeometry(data.points));
              }
            } catch {
              /* ignore */
            }
          }
        }

        editSnapshotRef.current = null;
        notifyDirty(false);
        feature.changed();
      },
      [notifyDirty]
    );

    // ---- Draft (awaiting-label) helpers ----
    // Anchor the floating overlay at the draft (if any) else the selection.
    // Cancel any pending overlay reposition and schedule the next one inside
    // a single requestAnimationFrame.  During drawend → beginDraft → React
    // render → positionOverlay effect cascades, multiple layout reads
    // (getPixelFromCoordinate) would otherwise stack in one frame and cause
    // layout thrashing.  Coalescing into one RAF before paint avoids that.
    const positionOverlay = useCallback(() => {
      if (positionOverlayFrameRef.current != null) {
        cancelAnimationFrame(positionOverlayFrameRef.current);
      }
      positionOverlayFrameRef.current = requestAnimationFrame(() => {
        positionOverlayFrameRef.current = null;
        const overlay = overlayRef.current;
        const source = vectorSourceRef.current;
        const map = mapRef.current;
        if (!overlay || !source) return;
        const targetId = hasDraftRef.current ? DRAFT_ID : selectedIdRef.current;
        if (targetId != null) {
          const feat = source.getFeatureById(targetId);
          const geom = feat?.getGeometry();
          if (geom) {
            // A box with rotation enabled reserves its top edge for the rotate
            // handle, so the card is anchored BELOW the box (lower screen edge,
            // growing downward). Every other case keeps the original behaviour:
            // anchored above the higher screen edge, growing upward — the
            // Overlay uses stopEvent:true, so keeping it off the geometry keeps
            // the vertices under it draggable.
            const rotationBox =
              boxRotationEnabledRef.current === true &&
              feat?.get("annotation_type") === "box";
            const [minX, minY, maxX, maxY] = geom.getExtent();
            const cx = (minX + maxX) / 2;
            let anchor: [number, number] = [cx, maxY];
            if (map) {
              const pTop = map.getPixelFromCoordinate([cx, minY]);
              const pBot = map.getPixelFromCoordinate([cx, maxY]);
              if (pTop && pBot) {
                const higher = pTop[1] < pBot[1] ? [cx, minY] : [cx, maxY];
                const lower = pTop[1] < pBot[1] ? [cx, maxY] : [cx, minY];
                anchor = (rotationBox ? lower : higher) as [number, number];
              }
            }
            if (rotationBox) {
              overlay.setPositioning("top-center");
              overlay.setOffset([0, 12]);
            } else {
              overlay.setPositioning("bottom-center");
              overlay.setOffset([0, -10]);
            }
            overlay.setPosition(anchor);
            return;
          }
        }
        overlay.setPosition(undefined);
      });
    }, []);

    // Attach a rotation-capable box editor to the draft preview, so the user
    // can resize / rotate it before choosing a label. onChange re-anchors the
    // floating card so it tracks the box.
    const activateDraftBoxEdit = useCallback(
      (feature: Feature) => {
        const map = mapRef.current;
        if (!map) return;
        const edit = createBoxEditInteraction(feature, {
          rotationEnabled: true,
          onChange: () => positionOverlay(),
          onEnd: () => positionOverlay(),
        });
        map.addInteraction(edit);
        draftEditRef.current = edit;
      },
      [positionOverlay]
    );

    const clearDraft = useCallback(() => {
      // Tear down the draft editor first so it never fires on a removed feature.
      if (draftEditRef.current) {
        mapRef.current?.removeInteraction(draftEditRef.current);
        draftEditRef.current = null;
      }
      const src = vectorSourceRef.current;
      const f = src?.getFeatureById(DRAFT_ID);
      if (f) src?.removeFeature(f);
      hasDraftRef.current = false;
      // The box draw tool was suspended while the preview was editable — restore
      // it if the user is still on the box tool.
      if (activeToolRef.current === "draw-box") {
        drawBoxRef.current?.setActive(true);
      }
      positionOverlay();
    }, [positionOverlay]);

    // Read the live draft geometry as a create payload (resize/rotate included).
    const getDraftAnnotationInput =
      useCallback((): Annotation2DCreateInput | null => {
        const feature = vectorSourceRef.current?.getFeatureById(DRAFT_ID);
        if (!feature) return null;
        const type = (feature.get("annotation_type") || "box") as AnnotationType;
        const label = (feature.get("label") ?? null) as number | null;
        try {
          return featureToAnnotationInput(feature, type, label);
        } catch {
          return null;
        }
      }, []);

    // Put a freshly drawn shape on the map as a draft and ask the parent to
    // open the label chooser. Replaces any previous draft.
    const beginDraft = useCallback(
      (feature: Feature, type: AnnotationType, input: Annotation2DCreateInput) => {
        const src = vectorSourceRef.current;
        if (!src) return;
        if (hasDraftRef.current) {
          onDrawPreviewRef.current?.(null);
          return;
        }
        const old = src.getFeatureById(DRAFT_ID);
        if (old) src.removeFeature(old);
        feature.setId(DRAFT_ID);
        feature.set("annotation_type", type);
        feature.set("label", null);

        const editableBox =
          type === "box" && boxRotationEnabledRef.current === true;

        // Bind the rotate handle to the box's top edge by normalising the ring
        // winding (createBox()'s winding starts on a vertical edge).
        if (editableBox) normalizeBoxFeatureWinding(feature);

        src.addFeature(feature);
        hasDraftRef.current = true;

        // Make the box draft an editable preview: suspend the draw tool (so its
        // pointer events reach the resize/rotate handles) and attach the editor.
        if (editableBox) {
          drawBoxRef.current?.setActive(false);
          activateDraftBoxEdit(feature);
        }

        positionOverlay();
        onDrawCompleteRef.current?.(input);
      },
      [positionOverlay, activateDraftBoxEdit]
    );

    // ---- Keypoint draft-group helpers ----
    const clearKeypointDraft = useCallback(() => {
      keypointDraftRef.current = [];
      draftSourceRef.current?.clear();
      onDrawPreviewRef.current?.(null);
      onKeypointDraftChangeRef.current?.(0);
    }, []);

    const rebuildDraft = useCallback(() => {
      const src = draftSourceRef.current;
      if (!src) return;
      src.clear();
      keypointDraftRef.current.forEach((p, i) => {
        const f = new Feature(new Point([p[0], p[1]]));
        f.set("index", i);
        src.addFeature(f);
      });
    }, []);

    const addKeypointPoint = useCallback(
      (coord: number[]) => {
        keypointDraftRef.current = [
          ...keypointDraftRef.current,
          [coord[0], coord[1]],
        ];
        rebuildDraft();
        const n = keypointDraftRef.current.length;
        onDrawPreviewRef.current?.(`${n} point${n === 1 ? "" : "s"}`);
        onKeypointDraftChangeRef.current?.(n);
      },
      [rebuildDraft]
    );

    const finishKeypointGroup = useCallback(() => {
      const pts = keypointDraftRef.current;
      if (pts.length >= 1) {
        const coords = pts.map((p) => [p[0], p[1]]);
        const feature = new Feature(new MultiPoint(coords));
        beginDraft(feature, "keypoint", {
          annotation_type: "keypoint",
          label: null,
          box: null,
          polygon: null,
          keypoint: { points: coords },
        });
      }
      clearKeypointDraft();
    }, [clearKeypointDraft, beginDraft]);

    const cancelKeypointGroup = useCallback(() => {
      clearKeypointDraft();
    }, [clearKeypointDraft]);

    // ---- Overlay div creation ----
    useEffect(() => {
      const div = document.createElement("div");
      div.className = "absolute pointer-events-none";
      overlayDivRef.current = div;
      overlayContainerRef?.(div);
      return () => {
        overlayContainerRef?.(null);
        overlayDivRef.current = null;
      };
    }, []);

    // ---- Zoom + edit methods exposed to parent ----
    const zoomIn = useCallback(() => {
      const view = mapRef.current?.getView();
      if (view) view.setZoom((view.getZoom() ?? 1) + 0.5);
    }, []);

    const zoomOut = useCallback(() => {
      const view = mapRef.current?.getView();
      if (view) view.setZoom((view.getZoom() ?? 1) - 0.5);
    }, []);

    const fitView = useCallback(() => {
      const view = mapRef.current?.getView();
      if (view) view.fit([0, 0, width, height], { padding: [20, 20, 20, 20] });
    }, [width, height]);

    const zoom100 = useCallback(() => {
      const view = mapRef.current?.getView();
      if (view && width > 0 && containerRef.current) {
        const containerWidth = containerRef.current.clientWidth;
        const resolution = width / containerWidth;
        view.setResolution(resolution);
      }
    }, [width]);

    const commitEdit = useCallback((labelOverride?: number | null) => {
      const id = selectedIdRef.current;
      if (id != null && (editDirtyRef.current || labelOverride !== undefined)) {
        commitEditById(id, labelOverride);
      }
    }, [commitEditById]);

    const cancelEdit = useCallback(() => {
      const id = selectedIdRef.current;
      if (id != null) cancelEditById(id);
    }, [cancelEditById]);

    /**
     * Capture a serialisable snapshot of the annotation's current geometry
     * and label. The page calls this before dispatching START_EDIT so the
     * reducer stores an immutable reference point.  On revert the map
     * restores from this snapshot rather than from stale `_backendData`.
     */
    const captureAnnotationSnapshot = useCallback(
      (annotationId: number): AnnotationSnapshot | null => {
        const feature =
          vectorSourceRef.current?.getFeatureById(annotationId);
        if (!feature) return null;
        const geom = feature.getGeometry();
        if (!geom) return null;
        const fmt = new GeoJSON();
        const geometry = fmt.writeGeometryObject(geom) as Record<
          string,
          unknown
        >;
        const label = (feature.get("label") ?? null) as number | null;
        const snap: AnnotationSnapshot = {
          annotationId,
          label,
          geometry,
        };
        // Store internally so cancelEditById can use it
        editSnapshotRef.current = snap;
        return snap;
      },
      []
    );

    useImperativeHandle(
      ref,
      () => ({
        zoomIn,
        zoomOut,
        fitView,
        zoom100,
        commitEdit,
        cancelEdit,
        finishKeypointGroup,
        cancelKeypointGroup,
        clearDraft,
        getDraftAnnotationInput,
        captureAnnotationSnapshot,
      }),
      [
        zoomIn,
        zoomOut,
        fitView,
        zoom100,
        commitEdit,
        cancelEdit,
        finishKeypointGroup,
        cancelKeypointGroup,
        clearDraft,
        getDraftAnnotationInput,
        captureAnnotationSnapshot,
      ]
    );

    // ---- Initialize map ----
    useEffect(() => {
      if (!containerRef.current || width <= 0 || height <= 0) return;

      const extent: [number, number, number, number] = [0, 0, width, height];

      const vectorSource = new VectorSource();
      vectorSourceRef.current = vectorSource;

      const vectorLayer = new VectorLayer({
        source: vectorSource,
        renderBuffer: 16,
        updateWhileAnimating: false,
        updateWhileInteracting: false,
        style: (feature, resolution) =>
          featureStyleFunction(
            feature as Feature,
            selectedIdRef.current,
            editingIdRefMirror.current,
            labelMappingRef.current,
            boxRotationEnabledRef.current === true,
            resolution
          ),
      });
      vectorLayerRef.current = vectorLayer;

      const draftSource = new VectorSource();
      draftSourceRef.current = draftSource;
      const draftLayer = new VectorLayer({
        source: draftSource,
        renderBuffer: 16,
        updateWhileAnimating: false,
        updateWhileInteracting: false,
        style: (feature) => keypointDraftStyleFn(feature as Feature),
      });

      const map = new Map({
        target: containerRef.current,
        layers: [],
        view: new View({
          center: [width / 2, height / 2],
          zoom: 1,
          maxZoom: 24,
          minZoom: 14,
          extent: [-width * 2, -height * 2, width * 3, height * 3],
        }),
        controls: [],
      });

      dblClickZoomRef.current =
        (map
          .getInteractions()
          .getArray()
          .find((i) => i instanceof DoubleClickZoom) as DoubleClickZoom) ?? null;

      // ---- Info overlay for selected annotation ----
      if (overlayDivRef.current) {
        const overlay = new Overlay({
          element: overlayDivRef.current,
          positioning: "bottom-center",
          offset: [0, -10],
          // stopEvent must be true so clicks on the floating info card (delete,
          // label dropdown, save/revert) don't leak through to the map and
          // trigger an empty-space deselect.
          stopEvent: true,
        });
        map.addOverlay(overlay);
        overlayRef.current = overlay;
      }

      // Load authenticated image blob, then create image layer
      let disposed = false;
      apiGetBlob(imageUrl).then((blob) => {
        if (disposed) return;
        const url = URL.createObjectURL(blob);
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = url;

        const imageLayer = new ImageLayer({
          source: new StaticImage({
            url,
            imageExtent: extent,
          }),
        });

        map.addLayer(imageLayer);
        map.addLayer(vectorLayer);
        map.addLayer(draftLayer);
        map.getView().fit(extent, { padding: [20, 20, 20, 20] });
      });

      mapRef.current = map;

      // ---- Right-click → context menu ----
      const viewport = map.getViewport();
      function handleContextMenu(e: MouseEvent) {
        e.preventDefault();
        const pixel = map.getEventPixel(e);
        const feature = map.forEachFeatureAtPixel(pixel, (f) => f, {
          hitTolerance: 5,
        }) as Feature | undefined;

        if (feature) {
          const id = feature.getId() as number | undefined;
          if (id != null && id >= 0) {
            onSelectRef.current?.(id);
            onAnnotationContextMenuRef.current?.(id, e.clientX, e.clientY);
          }
        }
      }
      viewport.addEventListener("contextmenu", handleContextMenu);

      // Pointer move → coordinates
      const pointerMoveKey = map.on("pointermove", (e: any) => {
        const coord = e.coordinate;
        if (coord && pointerFrameRef.current == null) {
          latestPointerCoordinateRef.current = [coord[0], coord[1]];
          pointerFrameRef.current = window.requestAnimationFrame(() => {
            pointerFrameRef.current = null;
            const latest = latestPointerCoordinateRef.current;
            if (!latest) return;
            const pt = mapToImage([latest[0], latest[1]]);
            onCoordinateChange(pt.x, pt.y);
          });
        } else if (coord) {
          latestPointerCoordinateRef.current = [coord[0], coord[1]];
        }
      });

      const resolutionKey = map.getView().on("change:resolution", () => {
        const z = map.getView().getZoom();
        if (z != null) onZoomChange(Math.round(z * 100) / 100);
      });

      return () => {
        disposed = true;
        viewport.removeEventListener("contextmenu", handleContextMenu);
        unByKey(pointerMoveKey);
        unByKey(resolutionKey);
        if (pointerFrameRef.current != null) {
          window.cancelAnimationFrame(pointerFrameRef.current);
          pointerFrameRef.current = null;
        }
        if (positionOverlayFrameRef.current != null) {
          window.cancelAnimationFrame(positionOverlayFrameRef.current);
          positionOverlayFrameRef.current = null;
        }
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
        map.setTarget(undefined);
        mapRef.current = null;
        overlayRef.current = null;
        vectorSourceRef.current = null;
        draftSourceRef.current = null;
        vectorLayerRef.current = null;
      };
    }, [width, height]);

    // ---- Sync annotations into the vector source ----
    useEffect(() => {
      const source = vectorSourceRef.current;
      if (!source) return;

      const existingIds = new Set(
        source.getFeatures().map((f) => f.getId() as number)
      );
      const newIds = new Set(annotations.map((a) => a.id));

      source.getFeatures().forEach((f) => {
        const id = f.getId() as number;
        // Keep the draft feature (negative id) — it isn't a backend annotation.
        if (id != null && id >= 0 && !newIds.has(id)) {
          source.removeFeature(f);
        }
      });

      annotations.forEach((ann) => {
        const existing = source.getFeatureById(ann.id);
        if (!existingIds.has(ann.id) || !existing) {
          source.addFeature(annotationToFeature(ann));
          return;
        }

        const currentData = existing.get("_backendData");
        const currentType = existing.get("annotation_type");
        if (
          existing.get("label") !== ann.label ||
          currentType !== ann.annotation_type ||
          currentData !== ann.data
        ) {
          const updated = annotationToFeature(ann);
          existing.set("annotation_type", ann.annotation_type);
          existing.set("label", ann.label);
          existing.set("_backendData", ann.data);
          existing.setGeometry(updated.getGeometry() ?? undefined);
          existing.changed();
        }
      });

      vectorSourceRef.current?.changed();
    }, [annotations]);

    useEffect(() => {
      refreshFeatureStyles([
        previousSelectedIdRef.current,
        previousEditingIdRef.current,
        selectedAnnotationId,
        editingAnnotationId,
        DRAFT_ID,
      ]);
      previousSelectedIdRef.current = selectedAnnotationId;
      previousEditingIdRef.current = editingAnnotationId;
    }, [selectedAnnotationId, editingAnnotationId, labelMapping, refreshFeatureStyles]);

    // ---- Position the floating overlay (draft or selection) ----
    useEffect(() => {
      positionOverlay();
    }, [selectedAnnotationId, annotations, positionOverlay]);

    // ---- Stable select / draw interactions ----
    useEffect(() => {
      const map = mapRef.current;
      if (!map) return;

      const select = createSelectInteraction();
      const drawBox = createDrawBoxInteraction();
      const drawPolygon = createDrawPolygonInteraction();
      select.setActive(false);
      drawBox.setActive(false);
      drawPolygon.setActive(false);
      selectRef.current = select;
      drawBoxRef.current = drawBox;
      drawPolygonRef.current = drawPolygon;

      map.addInteraction(select);
      map.addInteraction(drawBox);
      map.addInteraction(drawPolygon);

      const selectKey = select.on("select", (e) => {
        const sel = e.selected[0];
        onSelectRef.current?.(sel ? ((sel.getId() as number) ?? null) : null);
      });
      const drawBoxStartKey = drawBox.on("drawstart", () =>
        onDrawPreviewRef.current?.("drawing...")
      );
      const drawBoxEndKey = drawBox.on("drawend", (e) => {
        onDrawPreviewRef.current?.(null);
        const feature = e.feature;
        const ext = feature.getGeometry()?.getExtent();
        if (!ext) return;
        if (ext[2] - ext[0] < 5 || ext[3] - ext[1] < 5) return;
        const input = featureToAnnotationInput(feature, "box", null);
        beginDraft(feature, "box", input);
      });
      const drawPolygonStartKey = drawPolygon.on("drawstart", () =>
        onDrawPreviewRef.current?.("Enter ↵ or double-click to finish")
      );
      const drawPolygonEndKey = drawPolygon.on("drawend", (e) => {
        onDrawPreviewRef.current?.(null);
        const input = featureToAnnotationInput(e.feature, "polygon", null);
        beginDraft(e.feature, "polygon", input);
      });

      return () => {
        unByKey([
          selectKey,
          drawBoxStartKey,
          drawBoxEndKey,
          drawPolygonStartKey,
          drawPolygonEndKey,
        ]);
        map.removeInteraction(select);
        map.removeInteraction(drawBox);
        map.removeInteraction(drawPolygon);
        if (draftEditRef.current) {
          map.removeInteraction(draftEditRef.current);
          draftEditRef.current = null;
        }
        selectRef.current = null;
        drawBoxRef.current = null;
        drawPolygonRef.current = null;
      };
    }, [beginDraft]);

    useEffect(() => {
      selectRef.current?.setActive(
        activeTool === "select" && editingAnnotationId == null
      );
      // Keep the box draw suspended while a draft preview is being edited, so
      // its pointer events don't compete with the resize/rotate handles.
      drawBoxRef.current?.setActive(
        activeTool === "draw-box" && !hasDraftRef.current
      );
      drawPolygonRef.current?.setActive(activeTool === "draw-polygon");

      if (previousToolRef.current === "draw-point" && activeTool !== "draw-point") {
        clearKeypointDraft();
      }
      previousToolRef.current = activeTool;
    }, [activeTool, editingAnnotationId, clearKeypointDraft]);

    // ---- Enter key to finish polygon draw ----
    useEffect(() => {
      if (activeTool !== "draw-polygon") return;

      const onKeyDown = (e: KeyboardEvent) => {
        // Don't steal Enter from input fields, textareas, or selects
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        if (e.key === "Enter") {
          e.preventDefault();
          drawPolygonRef.current?.finishDrawing();
        }
      };
      document.addEventListener("keydown", onKeyDown);

      return () => {
        document.removeEventListener("keydown", onKeyDown);
      };
    }, [activeTool]);

    // ---- Keypoint tool events ----
    useEffect(() => {
      const map = mapRef.current;
      if (!map || activeTool !== "draw-point") return;

      // Keypoint groups: single-click adds a numbered point, double-click
      // finishes. singleclick is suppressed by OL on the 2nd click of a
      // dblclick, so finishing never adds a stray point.
      dblClickZoomRef.current?.setActive(false);
      const onSingle = (e: any) => addKeypointPoint(e.coordinate);
      const onDbl = (e: any) => {
        finishKeypointGroup();
        e.stopPropagation();
      };
      map.on("singleclick", onSingle);
      map.on("dblclick", onDbl);
      keypointHandlersRef.current = { onSingle, onDbl };

      return () => {
        if (keypointHandlersRef.current) {
          map.un("singleclick", keypointHandlersRef.current.onSingle);
          map.un("dblclick", keypointHandlersRef.current.onDbl);
          keypointHandlersRef.current = null;
          if (dblClickZoomRef.current) dblClickZoomRef.current.setActive(true);
        }
      };
    }, [
      activeTool,
      addKeypointPoint,
      finishKeypointGroup,
    ]);

    // ---- Double-click a feature to enter the edit state ----
    useEffect(() => {
      const map = mapRef.current;
      if (!map || activeTool !== "select") return;

      const onDblClick = (e: any) => {
        const feature = map.forEachFeatureAtPixel(
          e.pixel,
          (f) => f,
          { hitTolerance: 5 }
        ) as Feature | undefined;

        const id = feature?.getId() as number | undefined;
        if (id != null && id >= 0) {
          onSelectRef.current?.(id);
          onEditStartRef.current?.(id);
          e.preventDefault?.();
          e.stopPropagation?.();
        }
      };

      dblClickZoomRef.current?.setActive(false);
      map.on("dblclick", onDblClick);

      return () => {
        map.un("dblclick", onDblClick);
        dblClickZoomRef.current?.setActive(true);
      };
    }, [activeTool]);

    // ---- Edit interactions for the selected feature (per type) ----
    useEffect(() => {
      const map = mapRef.current;
      if (!map) return;

      if (activeTool === "select" && editingAnnotationId != null) {
        const feature =
          vectorSourceRef.current?.getFeatureById(editingAnnotationId);
        if (feature) {
          const type = (feature.get("annotation_type") || "box") as AnnotationType;
          // Fresh collection per edit session — the shared ref accumulated
          // listeners from prior (removed-but-not-disposed) Modify/Translate
          // interactions. A new Collection holds exactly this feature.
          const editColl = new Collection<Feature>([feature]);
          editFeaturesRef.current = editColl;
          editingIdRef.current = editingAnnotationId;

          if (type === "box") {
            // Box: native Pointer interaction — grab a corner to resize
            // (rectangle-preserving, opposite corner anchored) or drag the
            // interior to move. Replaces ol-ext's Transform.
            // Put the rotate handle above the box's top edge before editing.
            if (boxRotationEnabledRef.current === true) {
              normalizeBoxFeatureWinding(feature);
            }
            const boxEdit = createBoxEditInteraction(feature, {
              onChange: () => notifyDirty(true),
              onEnd: () => notifyDirty(true),
              rotationEnabled: boxRotationEnabledRef.current === true,
            });
            map.addInteraction(boxEdit);
            boxEditRef.current = boxEdit;
          } else if (type === "polygon") {
            // Polygon: native Pointer interaction — drag vertex to reshape,
            // press-drag edge to insert + drag vertex, drag interior to move.
            // One interaction replaces the old Modify + Translate pair and
            // sidesteps Modify's internal overlay layer + rBush entirely.
            const polyEdit = createPolygonEditInteraction(feature, {
              onChange: () => notifyDirty(true),
              onEnd: () => notifyDirty(true),
            });
            map.addInteraction(polyEdit);
            polyEditRef.current = polyEdit;
          } else {
            // Keypoint: Modify for vertex drag + Translate for whole-group move.
            const translate = createTranslateInteraction(editColl);
            translate.on("translateend", () => notifyDirty(true));
            map.addInteraction(translate);
            translateRef.current = translate;

            const modify = createKeypointModifyInteraction(editColl);
            modify.on("modifyend", () => notifyDirty(true));
            map.addInteraction(modify);
            modifyRef.current = modify;
          }
          refreshFeatureStyles([editingAnnotationId]);
        }
      }

      return () => {
        const leavingId = editingIdRef.current;
        if (modifyRef.current) map.removeInteraction(modifyRef.current);
        if (translateRef.current) map.removeInteraction(translateRef.current);
        if (boxEditRef.current) map.removeInteraction(boxEditRef.current);
        if (polyEditRef.current) map.removeInteraction(polyEditRef.current);
        modifyRef.current = null;
        translateRef.current = null;
        boxEditRef.current = null;
        polyEditRef.current = null;
        editFeaturesRef.current.clear();
        editingIdRef.current = null;
        // Discard any lingering snapshot — it belongs to the edit session
        editSnapshotRef.current = null;
        refreshFeatureStyles([leavingId]);
      };
    }, [
      activeTool,
      editingAnnotationId,
      notifyDirty,
      refreshFeatureStyles,
    ]);

    return (
      <div className="relative flex-1">
        <div ref={containerRef} className="h-full w-full" />
      </div>
    );
  }
);
