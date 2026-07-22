import { describe, expect, it } from "vitest";
import {
  dropKeypointEdgeKey,
  pruneKeypointEdges,
  renameKeypointEdgeKey,
  upgradeMetaInfoConfig,
  type KeypointEdge,
} from "./configVersion";

const edges = (): Record<string, KeypointEdge[]> => ({
  "label:3": [["nose", "tail"]],
  "supercategory:dog": [["a", "b"]],
});

describe("renameKeypointEdgeKey", () => {
  it("moves an edge-set to the new schema key (Label ID / parent rename)", () => {
    const next = renameKeypointEdgeKey(edges(), "label:3", "label:7");
    expect(next["label:7"]).toEqual([["nose", "tail"]]);
    expect("label:3" in next).toBe(false);
    expect(next["supercategory:dog"]).toEqual([["a", "b"]]);
  });

  it("is a no-op when the source key is absent", () => {
    const input = edges();
    expect(renameKeypointEdgeKey(input, "label:99", "label:1")).toBe(input);
  });

  it("does not clobber an existing destination set", () => {
    const input = { "label:3": [["a", "b"]], "label:7": [["c", "d"]] } as Record<
      string,
      KeypointEdge[]
    >;
    const next = renameKeypointEdgeKey(input, "label:3", "label:7");
    expect(next["label:7"]).toEqual([["c", "d"]]);
    expect("label:3" in next).toBe(false);
  });
});

describe("dropKeypointEdgeKey", () => {
  it("removes the edge-set for a deleted parent category", () => {
    const next = dropKeypointEdgeKey(edges(), "supercategory:dog");
    expect("supercategory:dog" in next).toBe(false);
    expect(next["label:3"]).toBeDefined();
  });
});

describe("pruneKeypointEdges", () => {
  it("keeps only live schema keys and reports the removed ones", () => {
    const { edges: kept, removed } = pruneKeypointEdges(edges(), ["label:3"]);
    expect(Object.keys(kept)).toEqual(["label:3"]);
    expect(removed).toEqual(["supercategory:dog"]);
  });
});

describe("upgradeMetaInfoConfig", () => {
  it("preserves keypoint_edges and other keys across the version bump", () => {
    const upgraded = upgradeMetaInfoConfig({
      version: 1,
      box_rotation_enabled: true,
      keypoint_enabled: true,
      keypoint_edges: { "label:3": [["nose", "tail"]] },
    });
    expect(upgraded.version).toBe(3);
    expect(upgraded.box_rotation_enabled).toBe(true);
    expect(upgraded.keypoint_edges).toEqual({ "label:3": [["nose", "tail"]] });
  });
});
