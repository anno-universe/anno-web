import {
  normalizeLabelMapping,
  type LabelMappingEntry,
  type SupercategoryEntry,
} from "@/lib/utils/labelMapping";

export const PROJECT_CONFIG_VERSION = 3;

export type KeypointEdge = [from: string, to: string];

export interface LabelMappingConfigV3 {
  version: 3;
  labels: Record<string, LabelMappingEntry>;
  supercategories: Record<string, SupercategoryEntry>;
  [key: string]: unknown;
}

export interface MetaInfoConfigV3 {
  version: 3;
  box_rotation_enabled?: boolean;
  keypoint_enabled?: boolean;
  /** Frontend-only edges keyed by `supercategory:name` or `label:id`. */
  keypoint_edges?: Record<string, KeypointEdge[]>;
  [key: string]: unknown;
}

export function projectConfigVersionOf(
  value: Record<string, unknown> | null | undefined
): number {
  const raw = value?.version;
  return typeof raw === "number" && Number.isFinite(raw) ? raw : 1;
}

export function needsProjectConfigUpgrade(
  value: Record<string, unknown> | null | undefined
): boolean {
  return projectConfigVersionOf(value) < PROJECT_CONFIG_VERSION;
}

export function upgradeLabelMappingConfig(
  raw: Record<string, unknown> | null | undefined
): LabelMappingConfigV3 {
  const source = raw ?? {};
  if (
    projectConfigVersionOf(source) >= 2 &&
    typeof source.labels === "object" &&
    source.labels
  ) {
    return {
      version: PROJECT_CONFIG_VERSION,
      labels: normalizeLabelMapping(source.labels as Record<string, unknown>),
      supercategories: normalizeSupercategories(source.supercategories),
    };
  }

  const { version: _version, labels: _labels, ...legacyLabels } = source;
  return {
    version: PROJECT_CONFIG_VERSION,
    labels: normalizeLabelMapping(legacyLabels),
    supercategories: {},
  };
}

function normalizeSupercategories(value: unknown): Record<string, SupercategoryEntry> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Record<string, SupercategoryEntry> = {};
  for (const [name, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const keypoints = (raw as Record<string, unknown>).keypoints;
    const normalized = Array.isArray(keypoints)
      ? keypoints.filter(
          (point): point is string => typeof point === "string" && point.trim().length > 0
        ).map((point) => point.trim())
      : [];
    result[name] = normalized.length > 0 ? { keypoints: normalized } : {};
  }
  return result;
}

export function upgradeMetaInfoConfig(
  raw: Record<string, unknown> | null | undefined
): MetaInfoConfigV3 {
  const { version: _version, ...rest } = raw ?? {};
  return {
    ...rest,
    version: PROJECT_CONFIG_VERSION,
  } as MetaInfoConfigV3;
}

/** Backward-compatible aliases for callers while config storage moves to v3. */
export type LabelMappingConfigV2 = LabelMappingConfigV3;
export type MetaInfoConfigV2 = MetaInfoConfigV3;

export function labelMappingLabels(
  raw: Record<string, unknown> | null | undefined
): Record<string, LabelMappingEntry> {
  return upgradeLabelMappingConfig(raw).labels;
}
