import Feature from "ol/Feature";
import Polygon from "ol/geom/Polygon";
import Point from "ol/geom/Point";
import MultiPoint from "ol/geom/MultiPoint";
import { fromExtent } from "ol/geom/Polygon";
import type {
  Annotation2DOutput,
  Annotation2DCreateInput,
  Box2DDataInput,
  Polygon2DDataInput,
  Keypoint2DDataInput,
  AnnotationType,
} from "@/types/annotation";
import { isBoxData, isPointsData } from "@/types/annotation";
import { flipGeometryY } from "@/lib/annotation/imageProjection";
import { normalizeBoxTopEdge } from "@/lib/annotation/mapInteractions";

// ---- Backend → OpenLayers ----

export function annotationToFeature(
  ann: Annotation2DOutput,
  imageHeight: number
): Feature {
  let geometry;

  if (ann.annotation_type === "box" && isBoxData(ann.data)) {
    geometry = boxDataToGeometry(ann.data);
  } else if (
    (ann.annotation_type === "polygon" || ann.annotation_type === "keypoint") &&
    isPointsData(ann.data)
  ) {
    if (ann.annotation_type === "polygon") {
      geometry = polygonPointsToGeometry(ann.data.points);
    } else {
      // keypoint: render every point, preserving click order
      geometry = keypointPointsToGeometry(ann.data.points);
    }
  }

  // Converters build geometry in image-pixel space (y-down); flip into
  // OpenLayers map space (y-up) before the feature goes on the map.
  if (geometry) flipGeometryY(geometry, imageHeight);

  const feature = new Feature({ geometry });
  feature.setId(ann.id);
  feature.set("annotation_type", ann.annotation_type);
  feature.set("label", ann.label);
  feature.set("_backendData", ann.data);
  return feature;
}

// ---- OpenLayers → Backend ----

export function featureToAnnotationInput(
  feature: Feature,
  annotationType: AnnotationType,
  label: number | null,
  imageHeight: number
): Annotation2DCreateInput {
  const live = feature.getGeometry();
  if (!live) {
    throw new Error("Feature has no geometry");
  }
  // The on-map geometry is in OpenLayers map space (y-up); extract from a
  // flipped clone so we emit image-pixel coords without mutating the feature.
  const geometry = live.clone();
  flipGeometryY(geometry, imageHeight);

  const base: Annotation2DCreateInput = {
    annotation_type: annotationType,
    label,
    box: null,
    polygon: null,
    keypoint: null,
  };

  if (annotationType === "box" && geometry instanceof Polygon) {
    base.box = polygonFeatureToBox(geometry);
  } else if (annotationType === "polygon" && geometry instanceof Polygon) {
    base.polygon = polygonFeatureToPoints(geometry);
  } else if (annotationType === "keypoint") {
    if (geometry instanceof MultiPoint) {
      base.keypoint = {
        points: geometry.getCoordinates().map((c) => [c[0], c[1]]),
      };
    } else if (geometry instanceof Point) {
      const coords = geometry.getCoordinates();
      base.keypoint = { points: [[coords[0], coords[1]]] };
    }
  }

  return base;
}

// ---- Box helpers ----

/** Construct a (possibly rotated) rectangle polygon from box data. */
export function boxDataToGeometry(data: {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}): Polygon {
  const rot = data.rotation ?? 0;
  const cx = data.x + data.width / 2;
  const cy = data.y + data.height / 2;
  const hw = data.width / 2;
  const hh = data.height / 2;

  if (rot === 0) {
    return fromExtent([data.x, data.y, data.x + data.width, data.y + data.height]);
  }

  const rad = (rot * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const corners: [number, number][] = [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ].map(([dx, dy]) => [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos]);

  // Close the ring
  return new Polygon([[...corners, corners[0]]]);
}

/**
 * Convert a (possibly rotated) box polygon back to {x, y, width, height, rotation}.
 * Extracts the axis-aligned bounding-box top-left and size, plus the rotation
 * angle in degrees, canonicalised into (-90, 90] via the rectangle's 180°
 * symmetry (so axis-aligned boxes always read back as rotation 0).
 */
export function polygonFeatureToBox(geometry: Polygon): Box2DDataInput {
  const ring = geometry.getCoordinates()[0];
  // OpenLayers rings are closed (last == first); take the 4 unique corners, then
  // normalise the winding so edge corners[0]→corners[1] is a genuine box edge.
  //
  // WHY: createBox() and fromExtent() both wind the ring starting on a VERTICAL
  // edge ([minX,minY]→[minX,maxY]). Reading rotation off that edge via
  // atan2(dy, 0) yields ±90° for a perfectly axis-aligned box, which then swaps
  // width/height and pushes x/y into a rotated frame (often negative) — the box
  // still renders correctly (boxDataToGeometry re-applies the rotation) but the
  // persisted {x,y,width,height,rotation} is semantically wrong. Normalising to
  // the top edge makes that first edge horizontal for axis-aligned boxes, so
  // rotation comes out 0 and x/y/width/height are the true AABB.
  const corners = normalizeBoxTopEdge(ring.slice(0, 4) as [number, number][]);

  // Center of the 4 corners
  const cx = corners.reduce((s, c) => s + c[0], 0) / 4;
  const cy = corners.reduce((s, c) => s + c[1], 0) / 4;

  // Rotation from the first (now normalised) edge, in (-180, 180].
  const dx = corners[1][0] - corners[0][0];
  const dy = corners[1][1] - corners[0][1];
  let deg = (Math.atan2(dy, dx) * 180) / Math.PI;

  // A rectangle is invariant under a 180° turn (identical footprint AND
  // width/height), so fold the angle into (-90, 90]. This canonicalises the
  // winding-dependent edge choice: 180/−180 → 0, and near-180 values such as
  // −179.53 → 0.47 (the tilt the box actually has), instead of persisting a
  // spurious ~180° rotation. Folding BEFORE the unrotate below keeps x/y/width/
  // height consistent with the stored angle.
  if (deg > 90) deg -= 180;
  else if (deg <= -90) deg += 180;
  const rotation = roundDeg(deg);

  // Unrotate corners to get axis-aligned dimensions (using the canonical angle)
  const rad = (-rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const unrotated = corners.map(([px, py]) => {
    const rx = px - cx;
    const ry = py - cy;
    return [cx + rx * cos - ry * sin, cy + rx * sin + ry * cos] as [number, number];
  });

  const xs = unrotated.map((c) => c[0]);
  const ys = unrotated.map((c) => c[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const w = Math.max(...xs) - minX;
  const h = Math.max(...ys) - minY;

  return {
    x: roundCoord(minX),
    y: roundCoord(minY),
    width: roundCoord(w),
    height: roundCoord(h),
    rotation,
  };
}

/** Round a degree value to 2 decimal places; snap near-zero to 0. */
function roundDeg(d: number): number {
  // Normalize to [-180, 180]
  let n = d % 360;
  if (n > 180) n -= 360;
  if (n < -180) n += 360;
  // Snap near 0 / 90 / -90 / 180 / -180
  for (const snap of [0, 90, -90, 180, -180]) {
    if (Math.abs(n - snap) < 1e-4) return snap;
  }
  return Math.round(n * 100) / 100;
}

function roundCoord(v: number): number {
  return Math.round(v * 100) / 100;
}

// ---- Polygon helpers ----

export function polygonPointsToGeometry(points: number[][]): Polygon {
  // Build the OL Polygon directly from the stored vertices. We deliberately do
  // NOT run any geometry-cleaning pass here: cleaning collinear / near-coincident
  // vertices silently drops user-placed points so they never receive a draggable
  // Modify handle (the "some vertices can't be edited" bug). Every stored vertex
  // must survive the round-trip.
  const ring = points.map((c) => [c[0], c[1]] as [number, number]);
  // Ensure the ring is closed (OL expects first == last).
  if (ring.length > 0) {
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      ring.push([...first]);
    }
  }
  return new Polygon([ring]);
}

export function polygonFeatureToPoints(geometry: Polygon): Polygon2DDataInput {
  // Read the ring straight off the OL geometry and only strip the closing
  // duplicate vertex. No cleanCoords — every edited/inserted vertex is
  // preserved exactly as the user placed it.
  const coords = geometry.getCoordinates()[0] ?? [];
  const points = coords.map((c) => [c[0], c[1]] as [number, number]);
  if (
    points.length > 1 &&
    points[0][0] === points[points.length - 1][0] &&
    points[0][1] === points[points.length - 1][1]
  ) {
    points.pop();
  }
  return { points };
}

// ---- Keypoint helpers ----

/** Build a MultiPoint geometry from an ordered list of keypoint coordinates. */
export function keypointPointsToGeometry(points: number[][]): MultiPoint {
  return new MultiPoint(points.map((p) => [p[0], p[1]]));
}

export function keypointToFeature(points: number[][]): Feature {
  if (points.length === 0) throw new Error("No points for keypoint");
  const feature = new Feature(keypointPointsToGeometry(points));
  feature.set("annotation_type", "keypoint");
  return feature;
}

export function featureToKeypoint(feature: Feature): Keypoint2DDataInput {
  const geom = feature.getGeometry();
  if (geom instanceof MultiPoint) {
    return { points: geom.getCoordinates().map((c) => [c[0], c[1]]) };
  }
  if (geom instanceof Point) {
    const coords = geom.getCoordinates();
    return { points: [[coords[0], coords[1]]] };
  }
  throw new Error("Expected MultiPoint/Point geometry for keypoint");
}
