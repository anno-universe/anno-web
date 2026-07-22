import { describe, expect, it } from "vitest";
import { upgradeLabelMappingConfig } from "@/lib/project/configVersion";
import {
  duplicateIds,
  duplicateNames,
  isIntegerIdString,
  keypointSchemasFromConfig,
} from "./labelMapping";

describe("keypointSchemasFromConfig", () => {
  it("inherits a shared supercategory schema for concrete categories", () => {
    const schemas = keypointSchemasFromConfig({
      supercategories: { dog: { keypoints: ["nose", "left_eye", "right_eye"] } },
      labels: {
        husky: { id: 1, color: "#112233", supercategory: "dog" },
        beagle: { id: 2, color: "#445566", supercategory: "dog" },
      },
    });

    expect(schemas).toEqual([
      {
        label: 1,
        name: "husky",
        keypoints: ["nose", "left_eye", "right_eye"],
        schemaKey: "supercategory:dog",
        supercategory: "dog",
      },
      {
        label: 2,
        name: "beagle",
        keypoints: ["nose", "left_eye", "right_eye"],
        schemaKey: "supercategory:dog",
        supercategory: "dog",
      },
    ]);
  });

  it("prefers a category override when one is present", () => {
    const [schema] = keypointSchemasFromConfig({
      supercategories: { dog: { keypoints: ["nose"] } },
      labels: {
        husky: {
          id: 1,
          color: "#112233",
          supercategory: "dog",
          keypoints: ["muzzle", "tail"],
        },
      },
    });

    expect(schema.schemaKey).toBe("label:1");
    expect(schema.keypoints).toEqual(["muzzle", "tail"]);
  });
});

describe("upgradeLabelMappingConfig", () => {
  it("upgrades legacy mappings while preserving numeric labels", () => {
    expect(upgradeLabelMappingConfig({ person: 0 })).toMatchObject({
      version: 3,
      labels: { person: { id: 0 } },
      supercategories: {},
    });
  });

  it("keeps sibling categories when one is literally named 'labels'", () => {
    // Regression: normalizeLabelMapping used to recurse into any `labels` key,
    // so a category named "labels" swallowed every sibling on reload.
    const result = upgradeLabelMappingConfig({
      version: 3,
      labels: {
        labels: { id: 1, color: "#111111" },
        arm: { id: 2, color: "#222222" },
      },
      supercategories: {},
    });
    expect(Object.keys(result.labels).sort()).toEqual(["arm", "labels"]);
    expect(result.labels.arm.id).toBe(2);
    expect(result.labels.labels.id).toBe(1);
  });
});

describe("label mapping validation helpers", () => {
  it("detects duplicate names, ignoring blanks and surrounding whitespace", () => {
    expect([...duplicateNames(["cat", " cat ", "dog", ""])]).toEqual(["cat"]);
  });

  it("detects duplicate ids across equivalent numeric forms", () => {
    expect([...duplicateIds(["7", "07", "3", ""])]).toEqual(["7"]);
  });

  it("allows a blank id but rejects non-integers", () => {
    expect(isIntegerIdString("")).toBe(true);
    expect(isIntegerIdString("5")).toBe(true);
    expect(isIntegerIdString("1.5")).toBe(false);
  });
});
