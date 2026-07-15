/** Известные варианты вида градостроительной деятельности в шаблоне программы. */
export const URBAN_PLANNING_ACTIVITY_OPTIONS = [
  'Архитектурно-строительное проектирование',
  'Капитальный ремонт',
  'Реконструкция',
  'Строительство',
  'Территориальное планирование',
  'Градостроительное зонирование',
  'Планировка территории',
  'Снос объектов капитального строительства',
  'Эксплуатация зданий, сооружений',
  'Комплексное развитие территории и их благоустройство',
] as const;

/**
 * Берёт вид градостроительной деятельности из ТЗ 1:1
 * (п.4 / п.1.7 — в ТЗ нумерация бывает разной).
 */
export function extractUrbanPlanningActivityFromTz(tzText: string): string | null {
  const text = String(tzText || '');
  if (!text.trim()) return null;

  // Ищем заголовок пункта и берём значение из следующих строк
  const headerRe =
    /(?:^|\n)\s*(?:п\.?\s*)?(?:4|1\.7)\.?\s*Вид градостроительной деятельности[^\n]*\n([\s\S]{0,200}?)(?=\n\s*(?:п\.?\s*)?\d|$)/i;
  const headerMatch = text.match(headerRe);
  const vicinity = headerMatch?.[1] || '';

  const searchIn = vicinity || text;
  for (const option of URBAN_PLANNING_ACTIVITY_OPTIONS) {
    if (new RegExp(option.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(searchIn)) {
      return option;
    }
  }

  // Fallback: любая строка сразу после заголовка
  const loose = text.match(
    /Вид градостроительной деятельности[^\n]*\n\s*([А-ЯЁа-яё][^\n]{2,80})/i,
  );
  if (loose?.[1]) {
    const value = loose[1].trim().replace(/[.;]+$/u, '').trim();
    if (value && !/вид градостроительной/i.test(value)) return value;
  }

  return null;
}
