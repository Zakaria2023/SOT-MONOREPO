/** Parse a JSON request body, returning null instead of throwing on bad JSON. */
export const readBody = async (request: Request): Promise<unknown> =>
  request.json().catch(() => null);

/** Read a non-empty string field from an unknown parsed body, or null. */
export const getStringField = (body: unknown, key: string): string | null => {
  if (typeof body !== "object" || body === null || !(key in body)) {
    return null;
  }
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "string" && value.length > 0 ? value : null;
};

/** Read a finite number field from an unknown parsed body, or null. */
export const getNumberField = (body: unknown, key: string): number | null => {
  if (typeof body !== "object" || body === null || !(key in body)) {
    return null;
  }
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};
