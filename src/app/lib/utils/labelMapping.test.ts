import { describe, expect, it } from "vitest";
import { upgradeLabelMappingConfig } from "@/lib/project/configVersion";
import { keypointSchemasFromConfig } from "./labelMapping";

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
});
