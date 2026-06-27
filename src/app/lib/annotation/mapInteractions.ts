import Draw, { createBox } from "ol/interaction/Draw";
import Modify from "ol/interaction/Modify";
import Select from "ol/interaction/Select";
import Translate from "ol/interaction/Translate";
import PointerInteraction from "ol/interaction/Pointer";
import { click, never } from "ol/events/condition";
import Polygon, { fromExtent } from "ol/geom/Polygon";
import type MapBrowserEvent from "ol/MapBrowserEvent";
import type Feature from "ol/Feature";
import type Collection from "ol/Collection";

// ol/interaction/Pointer's handler signatures receive this event union.
type BrowserEvt = MapBrowserEvent<PointerEvent | KeyboardEvent | WheelEvent>;

// All interactions here are plain OpenLayers core (ol/interaction/*). No ol-ext,
// no turf, no openlayers-editor — box resizing is the one thing OL core has no
// built-in for, so it lives in createBoxEditInteraction below (a small Pointer
// subclass), keeping every annotation type on native OL.

/**
 * Box draw: drag to create rectangle using createBox() geometry function.
 */
export function createDrawBoxInteraction(): Draw {
  return new Draw({
    type: "Circle",
    geometryFunction: createBox(),
  });
}

/**
 * Polygon draw: click to add points, double-click or Enter to finish.
 */
export function createDrawPolygonInteraction(): Draw {
  return new Draw({
    type: "Polygon",
  });
}

/**
 * Selection: click to select a feature.  style is set to null so OL's
 * Select interaction NEVER calls feature.setStyle() — the layer's own
 * style function (featureStyleFunction) remains in full control.
 * Passing `undefined` triggers OL's built-in blue selection style instead.
 */
export function createSelectInteraction(): Select {
  return new Select({
    condition: click,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    style: null as any,
  });
}

/**
 * Move a whole feature by dragging its interior.
 */
export function createTranslateInteraction(
  features: Collection<Feature>
): Translate {
  return new Translate({ features });
}

/**
 * Keypoint edit: drag individual points. No vertex insertion/deletion (point
 * count is fixed once the draw session ends).
 */
export function createKeypointModifyInteraction(
  features: Collection<Feature>
): Modify {
  return new Modify({
    features,
    pixelTolerance: 12,
    insertVertexCondition: never,
  });
}

export interface BoxEditCallbacks {
  /** Pixel radius for grabbing a corner handle. */
  pixelTolerance?: number;
  /** Fired on every drag step while resizing/moving (geometry became dirty). */
  onChange?: () => void;
  /** Fired once on pointer-up after an actual drag. */
  onEnd?: () => void;
  /** When true, expose a rotation handle above the box's top edge. */
  rotationEnabled?: boolean;
}

// Screen-pixel distance the rotate handle floats above the box's top edge.
const ROTATE_HANDLE_OFFSET_PX = 26;

/** Rotate point `p` by `rad` around `anchor`. */
function rotatePoint(
  p: [number, number],
  rad: number,
  anchor: [number, number]
): [number, number] {
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = p[0] - anchor[0];
  const dy = p[1] - anchor[1];
  return [anchor[0] + dx * cos - dy * sin, anchor[1] + dx * sin + dy * cos];
}

/** Centre (mean of the 4 corners) of a box ring. */
function boxCenter(corners: [number, number][]): [number, number] {
  return [
    (corners[0][0] + corners[1][0] + corners[2][0] + corners[3][0]) / 4,
    (corners[0][1] + corners[1][1] + corners[2][1] + corners[3][1]) / 4,
  ];
}

/** Box rotation (radians) read from the top edge corners[0]→corners[1]. */
function boxAngle(corners: [number, number][]): number {
  return Math.atan2(corners[1][1] - corners[0][1], corners[1][0] - corners[0][0]);
}

/**
 * Reorder a box ring so edge corners[0]→corners[1] is the edge that currently
 * sits highest on screen (max map-y, since OL is y-up).  The rotate handle
 * binds to that edge, so normalising once on entry to edit/draft makes the
 * handle appear above the box's top edge regardless of how boxDataToGeometry
 * wound the ring — and because the winding is then fixed, the handle follows
 * the box smoothly during a rotation drag (no jumping between edges).
 */
export function normalizeBoxTopEdge(
  corners: [number, number][]
): [number, number][] {
  let topEdge = 0;
  let topMidY = -Infinity;
  for (let i = 0; i < 4; i++) {
    const midY = (corners[i][1] + corners[(i + 1) % 4][1]) / 2;
    if (midY > topMidY) {
      topMidY = midY;
      topEdge = i;
    }
  }
  if (topEdge === 0) return corners;
  return [
    corners[topEdge % 4],
    corners[(topEdge + 1) % 4],
    corners[(topEdge + 2) % 4],
    corners[(topEdge + 3) % 4],
  ];
}

/**
 * Position of the rotation handle in MAP coordinates.
 *
 * The handle floats off the box's "top" edge (corners[0]→corners[1], the edge
 * built first by boxDataToGeometry) along that edge's outward normal, a fixed
 * number of screen pixels away (so the gap is constant across zoom — hence the
 * `resolution` factor).  Because it is bound to a specific edge it rotates with
 * the box instead of jumping between edges.
 *
 * Used by BOTH the interaction (hit-test) and the style (rendering) so the
 * drawn handle and the grabbable handle always coincide.
 */
export function rotateHandleAnchor(
  corners: [number, number][],
  resolution: number
): { handle: [number, number]; edgeMid: [number, number] } {
  const edgeMid: [number, number] = [
    (corners[0][0] + corners[1][0]) / 2,
    (corners[0][1] + corners[1][1]) / 2,
  ];
  const ex = corners[1][0] - corners[0][0];
  const ey = corners[1][1] - corners[0][1];
  const len = Math.hypot(ex, ey) || 1;
  // Two unit normals; choose the one pointing away from the box centre.
  let nx = -ey / len;
  let ny = ex / len;
  const c = boxCenter(corners);
  if ((edgeMid[0] + nx - c[0]) ** 2 + (edgeMid[1] + ny - c[1]) ** 2 <
      (edgeMid[0] - nx - c[0]) ** 2 + (edgeMid[1] - ny - c[1]) ** 2) {
    nx = -nx;
    ny = -ny;
  }
  const off = ROTATE_HANDLE_OFFSET_PX * resolution;
  return { handle: [edgeMid[0] + nx * off, edgeMid[1] + ny * off], edgeMid };
}

/**
 * Native rectangle editor for box annotations — no external deps.
 *
 * - Grab a corner → resize (diagonally-opposite corner anchored). The box's
 *   rotation is preserved: axis-aligned boxes use fromExtent, rotated boxes
 *   resize in the box's local frame.
 * - Press inside → move the whole rectangle.
 * - When `rotationEnabled`, grab the rotation handle (above the top edge) to
 *   spin the box around its centre. Hold Shift to snap to 15° increments.
 * - Press outside → returns false so map pan / other interactions still work.
 *
 * polygonFeatureToBox reads back {x, y, width, height, rotation} on commit.
 */
export function createBoxEditInteraction(
  feature: Feature,
  callbacks: BoxEditCallbacks = {}
): PointerInteraction {
  const tol = callbacks.pixelTolerance ?? 10;
  const minSize = 1;
  const rotationEnabled = callbacks.rotationEnabled === true;
  const SNAP = (15 * Math.PI) / 180;

  let mode: "none" | "resize" | "move" | "rotate" = "none";
  let anchor: [number, number] | null = null;
  let last: [number, number] | null = null;
  let dragged = false;
  // Rotation drag state.
  let rotateCenter: [number, number] | null = null;
  let rotateStartAngle = 0;
  let rotateBaseAngle = 0;
  let rotateBaseGeom: Polygon | null = null;

  function currentCorners(): [number, number][] | null {
    const g = feature.getGeometry();
    if (!(g instanceof Polygon)) return null;
    // Ring is closed (last === first); the 4 unique corners are the first 4.
    return g.getCoordinates()[0].slice(0, 4) as [number, number][];
  }

  function handlePixelDist(corners: [number, number][], evt: BrowserEvt): number {
    const res = evt.map.getView().getResolution() ?? 1;
    const { handle } = rotateHandleAnchor(corners, res);
    const hp = evt.map.getPixelFromCoordinate(handle);
    return Math.hypot(hp[0] - evt.pixel[0], hp[1] - evt.pixel[1]);
  }

  return new PointerInteraction({
    handleDownEvent(evt: BrowserEvt) {
      const g = feature.getGeometry();
      if (!(g instanceof Polygon)) return false;
      const corners = currentCorners();
      if (!corners) return false;

      // 1. Rotation handle (outside the box, so test it before corners/interior).
      if (rotationEnabled && handlePixelDist(corners, evt) <= tol + 2) {
        mode = "rotate";
        rotateCenter = boxCenter(corners);
        rotateBaseGeom = g.clone() as Polygon;
        rotateBaseAngle = boxAngle(corners);
        rotateStartAngle = Math.atan2(
          evt.coordinate[1] - rotateCenter[1],
          evt.coordinate[0] - rotateCenter[0]
        );
        dragged = false;
        return true;
      }

      // 2. Nearest corner → resize.
      let nearest = -1;
      let nearestDist = Infinity;
      corners.forEach((c, i) => {
        const px = evt.map.getPixelFromCoordinate(c);
        const d = Math.hypot(px[0] - evt.pixel[0], px[1] - evt.pixel[1]);
        if (d < nearestDist) {
          nearestDist = d;
          nearest = i;
        }
      });

      if (nearest >= 0 && nearestDist <= tol) {
        // Anchor = the corner farthest (diagonally opposite) from the grabbed one.
        const grabbed = corners[nearest];
        let opp = corners[0];
        let oppDist = -1;
        for (const c of corners) {
          const d = Math.hypot(c[0] - grabbed[0], c[1] - grabbed[1]);
          if (d > oppDist) {
            oppDist = d;
            opp = c;
          }
        }
        anchor = [opp[0], opp[1]];
        mode = "resize";
        dragged = false;
        return true;
      }

      // 3. Interior → move.
      if (g.intersectsCoordinate(evt.coordinate)) {
        mode = "move";
        last = [evt.coordinate[0], evt.coordinate[1]];
        dragged = false;
        return true;
      }

      return false;
    },

    handleDragEvent(evt: BrowserEvt) {
      const g = feature.getGeometry();
      if (!(g instanceof Polygon)) return;
      dragged = true;

      if (mode === "resize" && anchor) {
        const a = anchor;
        const p: [number, number] = [evt.coordinate[0], evt.coordinate[1]];

        if (!rotationEnabled) {
          // No rotation → exact axis-aligned extent rebuild (identical to init).
          const minX = Math.min(a[0], p[0]);
          const minY = Math.min(a[1], p[1]);
          const maxX = Math.max(a[0], p[0]);
          const maxY = Math.max(a[1], p[1]);
          if (maxX - minX >= minSize && maxY - minY >= minSize) {
            feature.setGeometry(fromExtent([minX, minY, maxX, maxY]));
          }
        } else {
          // Rotation-aware → resize in the box's local (un-rotated) frame about
          // the fixed anchor, re-rotate to preserve the angle, and re-normalise
          // the winding so the rotate handle stays bound to the top edge.
          const corners = currentCorners();
          const theta = corners ? boxAngle(corners) : 0;
          const pL = rotatePoint(p, -theta, a);
          const w = Math.abs(pL[0] - a[0]);
          const h = Math.abs(pL[1] - a[1]);
          if (w >= minSize && h >= minSize) {
            const loX = Math.min(a[0], pL[0]);
            const loY = Math.min(a[1], pL[1]);
            const hiX = Math.max(a[0], pL[0]);
            const hiY = Math.max(a[1], pL[1]);
            const localRing: [number, number][] = [
              [loX, loY],
              [hiX, loY],
              [hiX, hiY],
              [loX, hiY],
            ];
            const ring = normalizeBoxTopEdge(
              localRing.map((c) => rotatePoint(c, theta, a))
            );
            feature.setGeometry(new Polygon([[...ring, ring[0]]]));
          }
        }
        callbacks.onChange?.();
      } else if (mode === "move" && last) {
        const [cx, cy] = evt.coordinate;
        g.translate(cx - last[0], cy - last[1]);
        last = [cx, cy];
        callbacks.onChange?.();
      } else if (mode === "rotate" && rotateCenter && rotateBaseGeom) {
        const cur = Math.atan2(
          evt.coordinate[1] - rotateCenter[1],
          evt.coordinate[0] - rotateCenter[0]
        );
        let delta = cur - rotateStartAngle;
        if (evt.originalEvent instanceof PointerEvent && evt.originalEvent.shiftKey) {
          // Snap the absolute box angle to 15° steps.
          const snapped = Math.round((rotateBaseAngle + delta) / SNAP) * SNAP;
          delta = snapped - rotateBaseAngle;
        }
        const geom = rotateBaseGeom.clone() as Polygon;
        geom.rotate(delta, rotateCenter);
        feature.setGeometry(geom);
        callbacks.onChange?.();
      }

      // Force a live redraw — the vector layer uses updateWhileInteracting:false,
      // so geometry mutated mid-drag needs an explicit render to follow the cursor.
      evt.map.render();
    },

    handleUpEvent() {
      if (dragged && mode !== "none") callbacks.onEnd?.();
      mode = "none";
      anchor = null;
      last = null;
      rotateCenter = null;
      rotateBaseGeom = null;
      dragged = false;
      return false;
    },

    handleMoveEvent(evt: BrowserEvt) {
      if (!rotationEnabled || mode !== "none") return;
      const corners = currentCorners();
      if (!corners) return;
      const target = evt.map.getTargetElement();
      if (target instanceof HTMLElement) {
        target.style.cursor =
          handlePixelDist(corners, evt) <= tol + 2 ? "grab" : "";
      }
    },
  });
}

export interface PolygonEditCallbacks {
  pixelTolerance?: number;
  /** Fired on every drag step (vertex moved, inserted, or shape translated). */
  onChange?: () => void;
  /** Fired once on pointer-up after an actual drag. */
  onEnd?: () => void;
}

/**
 * Native polygon vertex editor — NO Modify, NO Translate, zero OL overlays.
 *
 * A single `ol/interaction/Pointer` subclass that handles vertex drag, edge
 * insertion, and whole-shape move in pixel space.  Avoids OL Modify's internal
 * VectorLayer overlay (which can draw on top of custom handles) and its rBush
 * query pipeline (which can miss vertices at certain zoom levels).
 *
 * - Drag a vertex → reshape the polygon.
 * - Press on an edge and drag → insert a new vertex, then drag it.
 * - Drag the interior → move the whole polygon.
 * - Press outside → returns false so map pan still works.
 */
export function createPolygonEditInteraction(
  feature: Feature,
  callbacks: PolygonEditCallbacks = {},
): PointerInteraction {
  const tol = callbacks.pixelTolerance ?? 12;

  let mode: "none" | "vertex" | "move" = "none";
  let vertexIdx = -1;
  let last: [number, number] | null = null;
  let dragged = false;

  /** Read the open-polygon ring (last vertex NOT repeated). */
  function ring(): [number, number][] {
    const g = feature.getGeometry();
    if (!(g instanceof Polygon)) return [];
    const c = g.getCoordinates()[0] ?? [];
    const n = c.length;
    if (n > 1 && c[0][0] === c[n - 1][0] && c[0][1] === c[n - 1][1]) {
      return c.slice(0, n - 1) as [number, number][];
    }
    return c as [number, number][];
  }

  /** Write the open ring back (ring is auto-closed). */
  function setRing(coords: [number, number][]) {
    (feature.getGeometry() as Polygon).setCoordinates([
      [...coords, [...coords[0]]],
    ]);
  }

  return new PointerInteraction({
    handleDownEvent(evt: BrowserEvt) {
      const g = feature.getGeometry();
      if (!(g instanceof Polygon)) return false;
      const r = ring();
      if (r.length < 3) return false;

      // 1. Nearest vertex
      let bestV = -1;
      let bestVDist = Infinity;
      for (let i = 0; i < r.length; i++) {
        const vp = evt.map.getPixelFromCoordinate(r[i]);
        const d = Math.hypot(vp[0] - evt.pixel[0], vp[1] - evt.pixel[1]);
        if (d < bestVDist) {
          bestVDist = d;
          bestV = i;
        }
      }
      if (bestV >= 0 && bestVDist <= tol) {
        vertexIdx = bestV;
        mode = "vertex";
        dragged = false;
        return true;
      }

      // 2. Nearest edge — press on edge inserts a vertex & starts dragging it
      let bestE = -1;
      let bestEDist = Infinity;
      let bestECoord: [number, number] = [0, 0];
      for (let i = 0; i < r.length; i++) {
        const a = r[i];
        const b = r[(i + 1) % r.length];
        const axy = evt.map.getPixelFromCoordinate(a);
        const bxy = evt.map.getPixelFromCoordinate(b);
        const abx = bxy[0] - axy[0];
        const aby = bxy[1] - axy[1];
        const lenSq = abx * abx + aby * aby;
        if (lenSq === 0) continue;
        let t =
          ((evt.pixel[0] - axy[0]) * abx + (evt.pixel[1] - axy[1]) * aby) /
          lenSq;
        t = Math.max(0, Math.min(1, t));
        const px = axy[0] + t * abx;
        const py = axy[1] + t * aby;
        const d = Math.hypot(evt.pixel[0] - px, evt.pixel[1] - py);
        if (d < bestEDist) {
          bestEDist = d;
          bestE = i;
          bestECoord = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
        }
      }
      if (bestE >= 0 && bestEDist <= tol) {
        // Insert the vertex after bestE in the ring
        const newRing = [...r];
        newRing.splice(bestE + 1, 0, bestECoord);
        setRing(newRing);
        vertexIdx = bestE + 1;
        mode = "vertex";
        dragged = false;
        callbacks.onChange?.();
        return true;
      }

      // 3. Inside polygon — whole-shape translate
      if (g.intersectsCoordinate(evt.coordinate)) {
        mode = "move";
        last = [evt.coordinate[0], evt.coordinate[1]];
        dragged = false;
        return true;
      }

      return false;
    },

    handleDragEvent(evt: BrowserEvt) {
      dragged = true;
      const [cx, cy] = evt.coordinate;

      if (mode === "vertex") {
        const r = ring();
        if (vertexIdx < 0 || vertexIdx >= r.length) return;
        r[vertexIdx] = [cx, cy];
        setRing(r);
        callbacks.onChange?.();
        evt.map.render(); // force redraw (updateWhileInteracting=false)
      } else if (mode === "move" && last) {
        const g = feature.getGeometry();
        if (g instanceof Polygon) {
          g.translate(cx - last[0], cy - last[1]);
          last = [cx, cy];
          callbacks.onChange?.();
          evt.map.render();
        }
      }
    },

    handleUpEvent() {
      if (dragged && mode !== "none") callbacks.onEnd?.();
      mode = "none";
      vertexIdx = -1;
      last = null;
      dragged = false;
      return false;
    },
  });
}
