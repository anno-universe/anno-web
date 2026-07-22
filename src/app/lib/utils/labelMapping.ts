/**
 * Label mapping utilities.
 *
 * Label map format used by normalized project config:
 * { name: { id, color } }
 *
 * Project-level config v2 wraps this as:
 * { version: 3, labels: { name: { id, color, keypoints? } } }
 */

export interface LabelMappingEntry {
  id: number;
  color: string;
  /** Ordered keypoint names for this category. Frontend-only soft schema. */
  keypoints?: string[];
  /** Optional parent category whose keypoint template is inherited. */
  supercategory?: string;
}

export interface SupercategoryEntry {
  keypoints?: string[];
}

export type LabelMappingValue = number | string | LabelMappingEntry;
export type LabelMapping = Record<string, LabelMappingValue>;

const FALLBACK_COLORS = [
  "#2563EB",
  "#DC2626",
  "#16A34A",
  "#D97706",
  "#7C3AED",
  "#0891B2",
  "#DB2777",
  "#4F46E5",
];

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

export function stableColor(seed: string | number): string {
  const s = String(seed);
  let hash = 0;
  for (let i = 0; i < s.length; i += 1) {
    hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  }
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
}

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX_COLOR_RE.test(value);
}

export function randomLabelColor(): string {
  const n = Math.floor(Math.random() * 0xffffff);
  return `#${n.toString(16).padStart(6, "0").toUpperCase()}`;
}

export function getLabelEntry(
  value: unknown,
  name: string
): LabelMappingEntry | null {
  if (value == null) return null;
  if (typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    const rawId = obj.id ?? obj.value;
    if (rawId == null || Number.isNaN(Number(rawId))) return null;
    const id = Number(rawId);
    const color = isHexColor(obj.color) ? obj.color.toUpperCase() : stableColor(id);
    const keypoints = Array.isArray(obj.keypoints)
      ? obj.keypoints.filter(
          (name): name is string => typeof name === "string" && name.trim().length > 0
        ).map((name) => name.trim())
      : undefined;
    const supercategory =
      typeof obj.supercategory === "string" && obj.supercategory.trim()
        ? obj.supercategory.trim()
        : undefined;
    return {
      id,
      color,
      ...(keypoints?.length ? { keypoints } : {}),
      ...(supercategory ? { supercategory } : {}),
    };
  }
  if (!Number.isNaN(Number(value))) {
    const id = Number(value);
    return { id, color: stableColor(name || id) };
  }
  return null;
}

export function normalizeLabelMapping(
  mapping: Record<string, unknown>
): Record<string, LabelMappingEntry> {
  if (typeof mapping.labels === "object" && mapping.labels) {
    return normalizeLabelMapping(mapping.labels as Record<string, unknown>);
  }

  const result: Record<string, LabelMappingEntry> = {};
  for (const [key, val] of Object.entries(mapping)) {
    if (key === "version") continue;

    // Preferred shapes: { name: id } or { name: { id, color } }.
    const entry = getLabelEntry(val, key);
    if (entry) {
      result[key] = entry;
      continue;
    }

    // Compatibility shape sometimes used in JSON editors: { id: name }.
    if (!Number.isNaN(Number(key)) && typeof val === "string" && val.trim()) {
      const id = Number(key);
      result[val.trim()] = { id, color: stableColor(val.trim() || id) };
    }
  }
  return result;
}

/**
 * Given a numeric label, return a human-readable display string.
 * Looks up the key whose value matches the label.
 */
export function getLabelName(
  label: number | null,
  mapping: Record<string, unknown>
): string {
  if (label == null) return "unset";
  const labels = normalizeLabelMapping(mapping);
  for (const [name, entry] of Object.entries(labels)) {
    if (entry?.id === label) {
      return `${label} - ${name}`;
    }
  }
  return String(label);
}

export function getLabelColor(
  label: number | null,
  mapping: Record<string, unknown>
): string {
  if (label == null) return "#6B7280";
  const labels = normalizeLabelMapping(mapping);
  for (const [, entry] of Object.entries(labels)) {
    if (entry?.id === label) return entry.color;
  }
  return stableColor(label);
}

/**
 * Build dropdown options from the mapping.
 * Returns { value: number, label: display string } sorted by value.
 */
export function labelOptionsFromMapping(
  mapping: Record<string, unknown>
): Array<{ value: number; label: string; color: string }> {
  return Object.entries(normalizeLabelMapping(mapping))
    .map(([name, entry]) => {
      return {
        value: entry.id,
        label: `${entry.id} - ${name}`,
        color: entry.color,
      };
    })
    .sort((a, b) => a.value - b.value);
}

export interface ResolvedKeypointSchema {
  label: number;
  name: string;
  keypoints: string[];
  schemaKey: string;
  supercategory?: string;
}

/** Resolve category-specific templates first, then inherited supercategory templates. */
export function keypointSchemasFromConfig(config: {
  labels: Record<string, LabelMappingEntry>;
  supercategories?: Record<string, SupercategoryEntry>;
}): ResolvedKeypointSchema[] {
  const supercategories = config.supercategories ?? {};
  return Object.entries(config.labels)
    .map(([name, entry]) => {
      const own = entry.keypoints?.filter(Boolean) ?? [];
      const inherited = entry.supercategory
        ? supercategories[entry.supercategory]?.keypoints?.filter(Boolean) ?? []
        : [];
      const keypoints = own.length > 0 ? own : inherited;
      if (keypoints.length === 0) return null;
      return {
        label: entry.id,
        name,
        keypoints,
        schemaKey:
          own.length > 0
            ? `label:${entry.id}`
            : `supercategory:${entry.supercategory}`,
        ...(entry.supercategory ? { supercategory: entry.supercategory } : {}),
      };
    })
    .filter((schema): schema is ResolvedKeypointSchema => schema !== null)
    .sort((a, b) => a.label - b.label);
}
