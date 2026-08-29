/** Convert API error payloads into text that is safe to show in the UI.
 *
 * Some upstreams return `{ error: { message, code } }` while our routes usually
 * return a string. Passing the object directly to `Error` coerces it to
 * "[object Object]", which hides the actionable failure from the user.
 */
export function clientErrorMessage(value: unknown, fallback: string): string {
  const seen = new Set<unknown>();

  const read = (candidate: unknown): string | null => {
    if (typeof candidate === 'string') {
      const text = candidate.trim();
      if (!text || text === '[object Object]') return null;
      return text;
    }
    if (candidate instanceof Error) return read(candidate.message);
    if (Array.isArray(candidate)) {
      for (const item of candidate) {
        const text = read(item);
        if (text) return text;
      }
      return null;
    }
    if (!candidate || typeof candidate !== 'object' || seen.has(candidate)) return null;
    seen.add(candidate);
    const record = candidate as Record<string, unknown>;
    for (const key of ['message', 'error', 'detail', 'reason', 'description']) {
      const text = read(record[key]);
      if (text) return text;
    }
    return null;
  };

  return read(value) || fallback;
}
