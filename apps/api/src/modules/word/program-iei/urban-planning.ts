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

function normalizeUrbanPhrase(raw: string): string | null {
  let value = String(raw || '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.;]+$/u, '')
    .trim();
  if (!value) return null;
  value = value
    .replace(/\s+(?:п\.?\s*)?\d+(?:\.\d+)*\.?\s+[А-ЯЁA-Z].*$/u, '')
    .trim()
    .replace(/[.;]+$/u, '')
    .trim();
  if (!value || /вид градостроительной/i.test(value)) return null;
  return value;
}

function hasKnownUrbanOption(value: string): boolean {
  const lower = value.toLowerCase();
  return URBAN_PLANNING_ACTIVITY_OPTIONS.some((option) =>
    lower.includes(option.toLowerCase()),
  );
}

function phraseFromCandidate(raw: string): string | null {
  const value = normalizeUrbanPhrase(raw);
  if (!value || !hasKnownUrbanOption(value)) return null;
  return value;
}

function firstUrbanPhraseAfter(text: string): string | null {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  for (let i = 0; i < Math.min(lines.length, 4); i++) {
    const line = lines[i];
    if (i > 0 && /^(?:п\.?\s*)?\d+(?:\.\d+)*\.?\s/.test(line)) break;
    let raw = line;
    if (/,\s*$/.test(raw) && lines[i + 1]) {
      raw = `${raw} ${lines[i + 1]}`;
    }
    const phrase = phraseFromCandidate(raw);
    if (phrase) return phrase;
  }
  return null;
}

/**
 * Берёт вид градостроительной деятельности из ТЗ 1:1
 * (п.4 / п.1.7 — в ТЗ нумерация бывает разной).
 * Несколько видов в одной формулировке (через запятую) сохраняются как в ТЗ.
 */
export function extractUrbanPlanningActivityFromTz(tzText: string): string | null {
  const text = String(tzText || '');
  if (!text.trim()) return null;

  const headerRe =
    /(?:^|\n)\s*(?:п\.?\s*)?(?:4|1\.7)\.?\s*Вид градостроительной деятельности\s*[:–—.]?\s*/i;
  const headerMatch = text.match(headerRe);
  if (headerMatch && headerMatch.index != null) {
    const afterHeader = text.slice(headerMatch.index + headerMatch[0].length);
    const fromHeader = firstUrbanPhraseAfter(afterHeader);
    if (fromHeader) return fromHeader;
  }

  const loose = text.match(
    /Вид градостроительной деятельности[^\n]*\n\s*([А-ЯЁа-яё][^\n]{2,120})/i,
  );
  const fromLoose = phraseFromCandidate(loose?.[1] || '');
  if (fromLoose) return fromLoose;

  const looseSame = text.match(
    /Вид градостроительной деятельности\s*[:–—-]?\s*([А-ЯЁа-яё][^\n]{2,120})/i,
  );
  return phraseFromCandidate(looseSame?.[1] || '');
}
