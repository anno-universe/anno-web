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
}

/**
 * Native rectangle editor for box annotations — replaces ol-ext's Transform.
 *
 * OpenLayers core has Draw/Modify/Translate but NO interaction that resizes an
 * axis-aligned rectangle while keeping it rectangular. This small
 * `ol/interaction/Pointer` subclass fills that gap:
 *
 * - Grab a corner handle → resize with the diagonally-opposite corner anchored,
 *   staying axis-aligned the whole drag (live, like the old Transform).
 * - Press inside the box → move the whole rectangle.
 * - Press outside → returns false so map pan / other interactions still work.
 *
 * The box stays a clean axis-aligned rect (rotation is fixed at 0 in v1), so
 * polygonFeatureToBox reads back exact {x, y, width, height} on commit.
 */
export function createBoxEditInteraction(
  feature: Feature,
  callbacks: BoxEditCallbacks = {}
): PointerInteraction {
  const tol = callbacks.pixelTolerance ?? 10;
  const minSize = 1;

  let mode: "none" | "resize" | "move" = "none";
  let anchor: [number, number] | null = null;
  let last: [number, number] | null = null;
  let dragged = false;

  function currentCorners(): [number, number][] | null {
    const g = feature.getGeometry();
    if (!(g instanceof Polygon)) return null;
    // Ring is closed (last === first); the 4 unique corners are the first 4.
    return g.getCoordinates()[0].slice(0, 4) as [number, number][];
  }

  return new PointerInteraction({
    handleDownEvent(evt: BrowserEvt) {
      const g = feature.getGeometry();
      if (!(g instanceof Polygon)) return false;
      const corners = currentCorners();
      if (!corners) return false;

      // Nearest corner in screen pixels.
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
        const [cx, cy] = evt.coordinate;
        const minX = Math.min(anchor[0], cx);
        const minY = Math.min(anchor[1], cy);
        const maxX = Math.max(anchor[0], cx);
        const maxY = Math.max(anchor[1], cy);
        if (maxX - minX >= minSize && maxY - minY >= minSize) {
          feature.setGeometry(fromExtent([minX, minY, maxX, maxY]));
        }
        callbacks.onChange?.();
      } else if (mode === "move" && last) {
        const [cx, cy] = evt.coordinate;
        g.translate(cx - last[0], cy - last[1]);
        last = [cx, cy];
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
      dragged = false;
      return false;
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
