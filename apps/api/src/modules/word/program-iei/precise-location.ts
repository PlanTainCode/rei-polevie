/**
 * Извлекает более точный адрес из наименования объекта (п.1.1 → п.1.2).
 * В БД по-прежнему хранится краткое «Москва / не Москва».
 */
export function extractPreciseLocationFromObjectName(objectName: string): string | null {
  const name = String(objectName || '').replace(/\s+/g, ' ').trim();
  if (!name) return null;

  // Частый шаблон: «... по адресу: г. Москва, ...»
  // Берём ПОСЛЕДНЕЕ «по адресу» — внутри кавычек/скобок часто бывает вложенный адрес сноса.
  const byAddressMatches = [...name.matchAll(/по\s+адресу\s*[:\-]?\s*/gi)];
  if (byAddressMatches.length > 0) {
    const last = byAddressMatches[byAddressMatches.length - 1];
    const cleanAddr = (raw: string) =>
      raw
        .trim()
        .replace(/[»"“”]+$/u, '')
        .replace(/[.;\s]+$/u, '')
        .trim();

    const addr = cleanAddr(name.slice((last.index || 0) + last[0].length));
    // Отсекаем обрубки вида «г. Москва, … д. 10)» (начало внутри скобок)
    if (addr.length >= 8 && !/^[^\n(]*\)/.test(addr)) {
      return addr;
    }
    // Если последний всё же обрубок — пробуем предыдущие с конца
    for (let i = byAddressMatches.length - 2; i >= 0; i--) {
      const m = byAddressMatches[i];
      const candidate = cleanAddr(name.slice((m.index || 0) + m[0].length));
      if (candidate.length >= 8 && !/^[^\n(]*\)/.test(candidate)) {
        return candidate;
      }
    }
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
