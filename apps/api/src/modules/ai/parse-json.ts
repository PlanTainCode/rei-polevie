/** Достаёт JSON-объект из ответа модели: fence ```json, пустой ответ, хвост после }. */
export function parseJsonObjectFromAi(response: string): unknown | null {
  const raw = String(response || '').trim();
  if (!raw) return null;

  const unfenced = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '');

  const start = unfenced.indexOf('{');
  const end = unfenced.lastIndexOf('}');
  if (start < 0 || end <= start) return null;

  try {
    return JSON.parse(unfenced.slice(start, end + 1));
  } catch {
    return null;
  }
}
