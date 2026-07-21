export function safeJsonParse(str: string): {
  value: unknown;
  error?: string;
} {
  if (!str.trim()) return { value: undefined };
  try {
    return { value: JSON.parse(str) };
  } catch (e) {
    return { value: undefined, error: (e as Error).message };
  }
}

export function prettyJson(obj: unknown): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

/**
 * Deterministic JSON.stringify with recursively sorted object keys, so two
 * structurally-equal values serialize identically regardless of key order
 * (e.g. after a JSONB round-trip). Use for change detection, not for payloads.
 */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    return Object.keys(source)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortKeysDeep(source[key]);
        return acc;
      }, {});
  }
  return value;
}
