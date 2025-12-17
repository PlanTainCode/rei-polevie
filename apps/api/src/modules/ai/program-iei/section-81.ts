/**
 * Извлечение данных для пункта 8.1 программы ИЭИ
 * "Краткая природно-хозяйственная характеристика территории"
 *
 * Берётся из ТЗ пункта 24.1 или 25.1: "Сведения о существующих и возможных источниках загрязнения окружающей среды"
 */

export interface ProgramIeiSection81Data {
  /** Полный текст пункта из ТЗ */
  pollutionSourcesText: string;
}

/**
 * Извлекает текст пункта 8.1 из ТЗ (детерминистически)
 */
export function extractSection81FromTz(tzText: string): ProgramIeiSection81Data {
  // Ищем заголовок пункта в ТЗ
  const headerMatch = tzText.match(
    /Сведения о существующих и возможных источниках\s+загрязнения окружающей среды/i,
  );

  if (!headerMatch || headerMatch.index === undefined) {
    return { pollutionSourcesText: '' };
  }

  // Начало контента - сразу после заголовка
  const contentStart = headerMatch.index + headerMatch[0].length;
  const afterHeader = tzText.substring(contentStart);

  // Ищем конец пункта - следующий заголовок раздела ТЗ
  const endPatterns = [
    /Общие технические решения/i,
    /Сведения о возможных аварийных/i,
    /Объемы изъятия природных ресурсов/i,
    /Ситуационный план/i,
    /Географические координаты/i,
  ];

  let endIdx = afterHeader.length;
  for (const pattern of endPatterns) {
    const match = afterHeader.match(pattern);
    if (match && match.index !== undefined && match.index > 10) {
      endIdx = Math.min(endIdx, match.index);
    }
  }

  const content = afterHeader.substring(0, endIdx).trim();

  if (content.length < 10) {
    return { pollutionSourcesText: '' };
  }

  return { pollutionSourcesText: content };
}
