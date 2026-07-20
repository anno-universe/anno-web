import { describe, expect, it } from "vitest";
import Feature from "ol/Feature";
import { fromExtent } from "ol/geom/Polygon";
import {
  annotationToFeature,
  featureToAnnotationInput,
} from "./annotationCodec";
import type {
  Annotation2DOutput,
  AnnotationData,
} from "@/types/annotation";

const IMAGE_HEIGHT = 1000;

function makeAnnotation(
  annotation_type: Annotation2DOutput["annotation_type"],
  data: AnnotationData,
): Annotation2DOutput {
  return {
    id: 1,
    image_id: 1,
    project_id: 1,
    annotation_type,
    label: 3,
    is_active: true,
    data,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

describe("annotationCodec box round-trip", () => {
  it("preserves an axis-aligned box as rotation 0 with the true AABB", () => {
    // Regression guard for the ±90° corruption: fromExtent/createBox wind the
    // ring on a vertical edge, so without normalisation atan2 reports ±90° and
    // swaps width/height / shifts x/y for a perfectly axis-aligned box.
    const ann = makeAnnotation("box", {
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      rotation: 0,
    });

    const feature = annotationToFeature(ann, IMAGE_HEIGHT);
    const input = featureToAnnotationInput(feature, "box", ann.label, IMAGE_HEIGHT);

    expect(input.box).not.toBeNull();
    expect(input.box).toEqual({
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      rotation: 0,
    });
  });

  it("folds a rotated box into (-90, 90] and is idempotent", () => {
    // A box authored near 180° must not persist a spurious ~180° / -179.x angle:
    // rectangle 180° symmetry means it is the same box as a small tilt. Encoding
    // it should land in (-90, 90], and re-encoding must be stable (no drift).
    const ann = makeAnnotation("box", {
      x: 40,
      y: 60,
      width: 120,
      height: 80,
      rotation: 179,
    });

    const feature = annotationToFeature(ann, IMAGE_HEIGHT);
    const input = featureToAnnotationInput(feature, "box", ann.label, IMAGE_HEIGHT);
    const box = input.box!;
    expect(box.rotation).toBeGreaterThan(-90);
    expect(box.rotation).toBeLessThanOrEqual(90);
    // 179° ≡ -1° after folding.
    expect(box.rotation).toBeCloseTo(-1, 2);

    // Re-encode from the canonical box: same result (stable, no growth).
    const roundTrip = makeAnnotation("box", { ...box, rotation: box.rotation ?? 0 });
    const feature2 = annotationToFeature(roundTrip, IMAGE_HEIGHT);
    const input2 = featureToAnnotationInput(feature2, "box", ann.label, IMAGE_HEIGHT);
    expect(input2.box).toEqual(box);
  });

  it("serialises a freshly drawn box (raw map-space fromExtent) as rotation 0", () => {
    // Simulate the draw path: OL Draw's createBox() yields a map-space rectangle.
    // Map extent [10,930,110,980] with height 1000 → image box (10,20,100,50).
    const feature = new Feature(fromExtent([10, 930, 110, 980]));

    const input = featureToAnnotationInput(feature, "box", 1, IMAGE_HEIGHT);

    expect(input.box).toEqual({
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      rotation: 0,
    });
  });
});

describe("annotationCodec polygon round-trip", () => {
  it("preserves vertex order and count without a duplicated closing point", () => {
    const points = [
      [100, 100],
      [180, 120],
      [160, 220],
    ];
    const ann = makeAnnotation("polygon", { points });

    const feature = annotationToFeature(ann, IMAGE_HEIGHT);
    const input = featureToAnnotationInput(feature, "polygon", ann.label, IMAGE_HEIGHT);

    expect(input.polygon?.points).toEqual(points);
  });
});

describe("annotationCodec keypoint round-trip", () => {
  it("preserves ordered keypoint coordinates", () => {
    const points = [
      [50, 60],
      [70, 80],
    ];
    const ann = makeAnnotation("keypoint", { points });

    const feature = annotationToFeature(ann, IMAGE_HEIGHT);
    const input = featureToAnnotationInput(feature, "keypoint", ann.label, IMAGE_HEIGHT);

    expect(input.keypoint?.points).toEqual(points);
  });
});
