import Feature from "ol/Feature";
import type { FeatureLike } from "ol/Feature";
import type { Style } from "ol/style";
import Style_ from "ol/style/Style";
import Fill from "ol/style/Fill";
import Stroke from "ol/style/Stroke";
import Circle from "ol/style/Circle";
import Text from "ol/style/Text";
import Point from "ol/geom/Point";
import MultiPoint from "ol/geom/MultiPoint";
import LineString from "ol/geom/LineString";
import Polygon from "ol/geom/Polygon";
import { getLabelColor } from "@/lib/utils/labelMapping";
import { rotateHandleAnchor } from "./mapInteractions";

/** Rotation handle colour — distinct from any label colour. */
const ROTATE_HANDLE_COLOR = "#0EA5E9"; // sky-500

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function rgbString(hex: string, alpha = 1): string {
  const [r, g, b] = hexToRgb(hex);
  return alpha === 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function darkenHex(hex: string, amount = 0.25): string {
  const [r, g, b] = hexToRgb(hex);
  const darken = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v * (1 - amount))));
  return `#${[darken(r), darken(g), darken(b)]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}

/**
 * Style presets for each annotation view state.
 * Used by `annotationStyle()` and exposed for external reference
 * (e.g. AnnotationInfoCard can match its border color to the map).
 */
export const VIEW_STYLE_PRESET = {
  strokeWidth: 2.5,
  fillAlpha: 0.18,
  circleRadius: 6,
} as const;

export const EDIT_STYLE_PRESET = {
  strokeWidth: 3,
  fillAlpha: 0.22,
  circleRadius: 7,
  darkenAmount: 0.28,
} as const;

export const NORMAL_STYLE_PRESET = {
  strokeWidth: 1.5,
  fillAlpha: 0.08,
  circleRadius: 5,
} as const;

interface StyleOpts {
  isSelected: boolean;
  isEditing: boolean;
  isDraft: boolean;
  color: string;
}

const annotationStyleCache = new Map<string, Style>();
const keypointDraftStyleCache = new Map<string, Style>();
const vertexHandleStyleCache = new Map<string, Style>();

/**
 * Persistent vertex handles for polygon editing.
 *
 * A white-filled, color-stroked circle is drawn at EVERY ring vertex via a
 * `geometry` function that returns a `MultiPoint` of the polygon's coordinates.
 * Returned alongside the polygon outline while editing so all key points are
 * visible and grabbable — mirrors openlayers-editor's "all nodes shown"
 * behavior. The MultiPoint is recomputed on each render, so vertices inserted
 * during a drag get a handle immediately.
 *
 * The style is independent of any specific feature, so one instance per stroke
 * color is cached and shared across all editing polygons.
 */
function vertexHandlesStyleFor(color: string): Style {
  const cached = vertexHandleStyleCache.get(color);
  if (cached) return cached;
  const style = new Style_({
    image: new Circle({
      radius: 6,
      fill: new Fill({ color: "white" }),
      stroke: new Stroke({ color, width: 2 }),
    }),
    geometry: (f: FeatureLike) => {
      const g = f.getGeometry();
      return g instanceof Polygon ? new MultiPoint(g.getCoordinates()[0]) : undefined;
    },
  });
  vertexHandleStyleCache.set(color, style);
  return style;
}

/**
 * Rotation handle for a box: a short connector line from the top-edge midpoint
 * out to a filled circle.  The position is computed by `rotateHandleAnchor`
 * (the SAME function the interaction hit-tests against), so the drawn handle and
 * the grabbable handle always coincide.  `resolution` keeps the pixel gap
 * constant across zoom — that is why these styles are built fresh per render
 * (only ever for the single box being edited/drafted, so the cost is trivial).
 */
function rotateHandleStyles(
  corners: [number, number][],
  resolution: number
): Style[] {
  const { handle, edgeMid } = rotateHandleAnchor(corners, resolution);
  return [
    new Style_({
      geometry: new LineString([edgeMid, handle]),
      stroke: new Stroke({ color: ROTATE_HANDLE_COLOR, width: 1.5 }),
    }),
    new Style_({
      geometry: new Point(handle),
      image: new Circle({
        radius: 6,
        fill: new Fill({ color: ROTATE_HANDLE_COLOR }),
        stroke: new Stroke({ color: "white", width: 2 }),
      }),
    }),
  ];
}

/**
 * Build a deterministic cache key for the style cache.
 * MUST include `color` — if labelMapping changes (different color for the same
 * label number), the color segment changes → cache miss → new Style created
 * with the correct color. Without color in the key, a stale cached Style
 * with the old color would be returned after a label mapping update.
 */
function stateKey({
  isSelected,
  isEditing,
  isDraft,
  color,
}: StyleOpts): string {
  return [
    color,
    isSelected ? "sel" : "norm",
    isEditing ? "edit" : "view",
    isDraft ? "draft" : "saved",
  ].join("|");
}

export function annotationStyle({
  isSelected,
  isEditing,
  isDraft,
  color,
}: StyleOpts): Style {
  const key = stateKey({ isSelected, isEditing, isDraft, color });
  const cached = annotationStyleCache.get(key);
  if (cached) return cached;

  const baseColor = isEditing ? darkenHex(color, 0.28) : color;
  const strokeColor = isDraft ? rgbString(baseColor, 0.65) : baseColor;
  const strokeW = isEditing ? 3 : isSelected ? 2.5 : 1.5;
  const fillAlpha = isEditing ? 0.22 : isSelected ? 0.18 : 0.08;

  const style = new Style_({
    stroke: new Stroke({
      color: strokeColor,
      width: strokeW,
      lineDash: isDraft ? [6, 4] : undefined,
    }),
    fill: new Fill({
      color: rgbString(baseColor, fillAlpha),
    }),
    image: new Circle({
      radius: isEditing ? 7 : isSelected ? 6 : 5,
      stroke: new Stroke({
        color: strokeColor,
        width: isEditing ? 3 : isSelected ? 2.5 : 2,
      }),
      fill: new Fill({ color: "white" }),
    }),
  });
  annotationStyleCache.set(key, style);
  return style;
}

/**
 * Keypoint rendering: one dot per point, numbered in click order, all sharing
 * the feature's label color. Numbers sit above each dot for legibility.
 */
function keypointStyles(
  feature: Feature,
  isSelected: boolean,
  isEditing: boolean,
  color: string,
  isDraft = false
): Style[] {
  const geom = feature.getGeometry();
  const coords =
    geom instanceof MultiPoint
      ? geom.getCoordinates()
      : geom instanceof Point
        ? [geom.getCoordinates()]
        : [];

  const pointColor = isDraft
    ? "#D97706"
    : isEditing
      ? darkenHex(color, 0.28)
      : color;
  const radius = isEditing ? 7 : isSelected ? 6 : 5;

  const sourceIndices = (feature.get("_keypointIndices") as number[] | undefined) ??
    coords.map((_, index) => index);
  const names = (feature.get("_keypointNames") as string[] | undefined) ?? [];
  const edges = (feature.get("_keypointEdges") as Array<[string, string]> | undefined) ?? [];
  const data = (feature.get("_keypointData") as number[][] | undefined) ?? [];
  const coordinateBySourceIndex = new Map(
    sourceIndices.map((sourceIndex, coordinateIndex) => [sourceIndex, coords[coordinateIndex]])
  );
  const nameToIndex = new Map(names.map((name, index) => [name, index]));
  const edgeStyles = edges.flatMap(([from, to]) => {
    const fromIndex = nameToIndex.get(from);
    const toIndex = nameToIndex.get(to);
    const a = fromIndex == null ? undefined : coordinateBySourceIndex.get(fromIndex);
    const b = toIndex == null ? undefined : coordinateBySourceIndex.get(toIndex);
    if (!a || !b) return [];
    return [
      new Style_({
        geometry: new LineString([a, b]),
        stroke: new Stroke({ color: pointColor, width: isSelected ? 2.5 : 2 }),
      }),
    ];
  });

  const pointStyles = coords.map(
    (c, i) =>
      new Style_({
        geometry: new Point(c),
        image: new Circle({
          radius,
          fill: new Fill({
            color: data[sourceIndices[i]]?.[2] === 1 ? "white" : pointColor,
          }),
          stroke: new Stroke({
            color: data[sourceIndices[i]]?.[2] === 1 ? pointColor : "white",
            width: isEditing ? 2 : 1.5,
            lineDash: data[sourceIndices[i]]?.[2] === 1 ? [3, 2] : undefined,
          }),
        }),
        text: new Text({
          text: names[sourceIndices[i]]
            ? `${sourceIndices[i]}. ${names[sourceIndices[i]]}`
            : String(sourceIndices[i]),
          font: "bold 11px 'Noto Sans SC', system-ui, sans-serif",
          offsetY: -13,
          fill: new Fill({ color: pointColor }),
          stroke: new Stroke({ color: "white", width: 3 }),
        }),
      })
  );
  return [...edgeStyles, ...pointStyles];
}

export function featureStyleFunction(
  feature: Feature,
  selectedId: number | null,
  editingId: number | null,
  labelMapping: Record<string, unknown>,
  boxRotationEnabled = false,
  resolution = 1
): Style | Style[] {
  const id = feature.getId() as number | undefined;
  const label = feature.get("label") as number | null;
  const annType = feature.get("annotation_type") as string | undefined;
  const isSelected = id != null && id === selectedId;
  const isEditing = id != null && id === editingId;
  // Negative ids mark an uncommitted draft (drawn, awaiting a label).
  const isDraft = typeof id === "number" && id < 0;
  const color = isDraft ? "#D97706" : getLabelColor(label, labelMapping);

  if (annType === "keypoint") {
    return keypointStyles(feature, isSelected, isEditing, color, isDraft);
  }

  const base = annotationStyle({ isSelected, isEditing, isDraft, color });

  // A box draft is an editable preview (resize + rotate before labelling), so
  // it shows the same handles as an explicit edit session.
  const isBoxDraftPreview = isDraft && annType === "box" && boxRotationEnabled;
  const showHandles = isEditing || isBoxDraftPreview;

  // While editing a polygon or box, overlay a persistent handle on every ring
  // vertex so all corners/key points are visible and draggable. Box editing
  // uses the native BoxEditInteraction (no built-in handles of its own), so it
  // needs these dots too.
  if (showHandles && (annType === "polygon" || annType === "box")) {
    const styles = [base, vertexHandlesStyleFor(darkenHex(color, 0.28))];
    // Rotation handle, only for boxes when the project enables it.
    if (annType === "box" && boxRotationEnabled) {
      const g = feature.getGeometry();
      if (g instanceof Polygon) {
        const corners = g.getCoordinates()[0].slice(0, 4) as [number, number][];
        if (corners.length === 4) {
          styles.push(...rotateHandleStyles(corners, resolution));
        }
      }
    }
    return styles;
  }

  return base;
}

/**
 * Draft keypoint style — points being placed during a draw session, in an
 * amber "in-progress" color, numbered by their `index` property.
 */
export function keypointDraftStyleFn(feature: Feature): Style {
  if (feature.getGeometry() instanceof LineString || feature.get("_edge")) {
    return new Style_({
      stroke: new Stroke({ color: "#D97706", width: 2 }),
    });
  }
  const index = (feature.get("index") as number | undefined) ?? 0;
  const cacheKey = `${index}:${String(feature.get("name") ?? "")}:${String(feature.get("visibility") ?? 2)}`;
  const cached = keypointDraftStyleCache.get(cacheKey);
  if (cached) return cached;

  const color = "hsl(28, 92%, 48%)";
  const style = new Style_({
    image: new Circle({
      radius: 5,
      fill: new Fill({ color }),
      stroke: new Stroke({ color: "white", width: 1.5 }),
    }),
    text: new Text({
      text: feature.get("name")
        ? `${index}. ${String(feature.get("name"))}`
        : String(index),
      font: "bold 11px 'Noto Sans SC', system-ui, sans-serif",
      offsetY: -13,
      fill: new Fill({ color }),
      stroke: new Stroke({ color: "white", width: 3 }),
    }),
  });
  keypointDraftStyleCache.set(cacheKey, style);
  return style;
}

/**
 * Factory that bundles all annotation style creation.
 * Use with `useMemo` in the page so the style function reference is stable
 * across renders when `labelMapping` hasn't changed, preventing unnecessary
 * OL re-renders.
 *
 * @example
 * const styles = useMemo(() => createAnnotationStyles(labelMapping), [labelMapping])
 * // Pass `styles.getFeatureStyle` as the vector layer's `style` function.
 */
export function createAnnotationStyles(labelMapping: Record<string, unknown>) {
  return {
    getFeatureStyle: (
      feature: Feature,
      selectedId: number | null,
      editingId: number | null
    ) => featureStyleFunction(feature, selectedId, editingId, labelMapping),
  };
}

// Re-export darkenHex so AnnotationInfoCard can match its edit-mode border
// color to the darkened map feature.
export { darkenHex, hexToRgb, rgbString };
