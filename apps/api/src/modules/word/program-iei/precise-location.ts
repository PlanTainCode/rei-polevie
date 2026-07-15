/**
 * Извлекает более точный адрес из наименования объекта (п.1.1 → п.1.2).
 * В БД по-прежнему хранится краткое «Москва / не Москва».
 */
export function extractPreciseLocationFromObjectName(objectName: string): string | null {
  const name = String(objectName || '').replace(/\s+/g, ' ').trim();
  if (!name) return null;

  // Частый шаблон: «... по адресу: г. Москва, ...»
  const byAddress = name.match(/по\s+адресу\s*[:\-]?\s*(.+)$/i);
  if (byAddress?.[1]) {
    const addr = byAddress[1].trim().replace(/[.;\s]+$/u, '').trim();
    if (addr.length >= 8) return addr;
  }

  // Адрес внутри наименования без явного «по адресу»
  const embedded = name.match(
    /((?:г\.?\s*)?Москва(?:вская\s+область)?[\s,][\s\S]{8,})$/i,
  );
  if (embedded?.[1]) {
    const addr = embedded[1].trim().replace(/[.;\s]+$/u, '').trim();
    // Не берём слишком короткое «г. Москва» без деталей
    if (addr.length >= 20) return addr;
  }

  return null;
}

/** Адрес для п.1.2: точный из наименования, иначе краткий из ТЗ/проекта. */
export function resolveProgramIeiLocation12(params: {
  objectName?: string | null;
  objectLocation?: string | null;
  projectAddress?: string | null;
}): string {
  const precise = extractPreciseLocationFromObjectName(params.objectName || '');
  if (precise) return precise;
  return String(params.objectLocation || params.projectAddress || '').trim();
}
