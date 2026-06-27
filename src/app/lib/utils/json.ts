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
