import {
  normalizeLabelMapping,
  type LabelMappingEntry,
} from "@/lib/utils/labelMapping";

export const PROJECT_CONFIG_VERSION = 2;

export interface LabelMappingConfigV2 {
  version: 2;
  labels: Record<string, LabelMappingEntry>;
  [key: string]: unknown;
}

export interface MetaInfoConfigV2 {
  version: 2;
  box_rotation_enabled?: boolean;
  keypoint_enabled?: boolean;
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
): LabelMappingConfigV2 {
  const source = raw ?? {};
  if (
    projectConfigVersionOf(source) >= 2 &&
    typeof source.labels === "object" &&
    source.labels
  ) {
    return {
      version: PROJECT_CONFIG_VERSION,
      labels: normalizeLabelMapping(source.labels as Record<string, unknown>),
    };
  }

  const { version: _version, labels: _labels, ...legacyLabels } = source;
  return {
    version: PROJECT_CONFIG_VERSION,
    labels: normalizeLabelMapping(legacyLabels),
  };
}

export function upgradeMetaInfoConfig(
  raw: Record<string, unknown> | null | undefined
): MetaInfoConfigV2 {
  const { version: _version, ...rest } = raw ?? {};
  return {
    ...rest,
    version: PROJECT_CONFIG_VERSION,
  } as MetaInfoConfigV2;
}

export function labelMappingLabels(
  raw: Record<string, unknown> | null | undefined
): Record<string, LabelMappingEntry> {
  return upgradeLabelMappingConfig(raw).labels;
}
