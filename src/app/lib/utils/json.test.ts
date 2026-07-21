import { describe, expect, it } from "vitest";
import { stableStringify } from "./json";
import {
  upgradeMetaInfoConfig,
  upgradeLabelMappingConfig,
} from "@/lib/project/configVersion";

describe("stableStringify", () => {
  it("is insensitive to object key order", () => {
    expect(stableStringify({ a: 1, b: 2 })).toBe(
      stableStringify({ b: 2, a: 1 })
    );
  });

  it("sorts keys deeply", () => {
    expect(stableStringify({ x: { c: 3, a: 1 } })).toBe('{"x":{"a":1,"c":3}}');
  });

  it("preserves array order", () => {
    expect(stableStringify([3, 1, 2])).toBe("[3,1,2]");
  });

  it("handles primitives and null", () => {
    expect(stableStringify(null)).toBe("null");
    expect(stableStringify(42)).toBe("42");
    expect(stableStringify("s")).toBe('"s"');
  });
});

describe("settings change detection", () => {
  // Regression: upgradeMetaInfoConfig normalizes the stored value (adds
  // `version`, reorders keys), so an unedited project must still compare equal
  // to its normalized baseline — otherwise the settings page reads as dirty
  // with zero edits and spuriously warns about unsaved changes.
  it("an unedited empty meta_info is not dirty", () => {
    const stored = {};
    const current = upgradeMetaInfoConfig(stored); // what the form initializes to
    const baseline = stableStringify(upgradeMetaInfoConfig(stored));
    expect(stableStringify(current)).toBe(baseline);
  });

  it("an unedited legacy label_mapping is not dirty", () => {
    const stored = { "1": "chromosome" }; // legacy v1 shape
    const current = upgradeLabelMappingConfig(stored);
    const baseline = stableStringify(upgradeLabelMappingConfig(stored));
    expect(stableStringify(current)).toBe(baseline);
  });

  it("a real meta_info edit is detected", () => {
    const stored = {};
    const baseline = stableStringify(upgradeMetaInfoConfig(stored));
    const edited = {
      ...upgradeMetaInfoConfig(stored),
      box_rotation_enabled: true,
    };
    expect(stableStringify(edited)).not.toBe(baseline);
  });
});
