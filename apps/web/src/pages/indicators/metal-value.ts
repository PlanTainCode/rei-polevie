export const METAL_VALUE_ERROR = 'Ошибка';

// «Менее X» уже поддерживается расчётами как отсутствие превышения.
// Остальные текстовые значения нельзя молча считать нулём.
export function parseMetalValue(value: string | number | null | undefined): number | null | typeof METAL_VALUE_ERROR {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : METAL_VALUE_ERROR;

  const cleaned = value.trim().replace(',', '.');
  const numeric = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/;
  if (/^менее\s+/i.test(cleaned)) {
    const limit = cleaned.replace(/^менее\s+/i, '');
    return numeric.test(limit) && Number.isFinite(Number(limit)) ? null : METAL_VALUE_ERROR;
  }
  return numeric.test(cleaned) && Number.isFinite(Number(cleaned))
    ? Number(cleaned)
    : METAL_VALUE_ERROR;
}

export function metalBackgroundRatio(value: string | number | null, background: number) {
  if (value === null) return '—';
  const concentration = parseMetalValue(value);
  if (concentration === METAL_VALUE_ERROR) return METAL_VALUE_ERROR;
  // Для записи «менее X» в таблице K также используем минимальное значение.
  return Math.max(0.1, (concentration ?? 0) / background);
}
