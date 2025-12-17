import type { ServiceMatch } from '../ai.service';

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

type ChatFn = (messages: ChatMessage[]) => Promise<string>;

export interface ProgramIeiSection42TableMatchResult {
  /** true если AI вернул валидный JSON и мы смогли распарсить результат */
  ok: boolean;
  /** Индексы строк workRows (0..N-1), которые нужно оставить */
  keepWorkRowIndexes: number[];
}

const safeJsonExtract = (s: string): string | null => {
  const m = String(s || '').match(/\{[\s\S]*\}/);
  return m?.[0] || null;
};

const uniqInts = (arr: unknown[]): number[] => {
  const out: number[] = [];
  const seen = new Set<number>();
  for (const v of arr) {
    const n = typeof v === 'number' ? v : Number(String(v));
    if (!Number.isFinite(n)) continue;
    const i = Math.trunc(n);
    if (i < 0) continue;
    if (seen.has(i)) continue;
    seen.add(i);
    out.push(i);
  }
  return out;
};

export async function matchProgramIeiSection42TableRowsViaAi(params: {
  chat: ChatFn;
  orderText: string;
  workRows: string[];
  servicesFromOrder: ServiceMatch[];
  tzContextText?: string;
}): Promise<ProgramIeiSection42TableMatchResult> {
  const { chat, orderText, workRows, servicesFromOrder } = params;

  // Если строк мало — нет смысла вызывать AI
  if (!Array.isArray(workRows) || workRows.length === 0) {
    return { ok: true, keepWorkRowIndexes: [] };
  }

  const servicesList = (servicesFromOrder || [])
    .map((s) => {
      const qty = s.quantity === undefined ? '' : `, кол-во: ${String(s.quantity)}`;
      return `- [строка ${s.row}] ${s.name}${qty}`;
    })
    .join('\n');

  const rowsList = workRows.map((t, i) => `${i}. ${String(t || '').trim()}`).join('\n');

  const systemPrompt = `Ты эксперт по инженерно-экологическим изысканиям.

Нужно выбрать, какие строки таблицы (раздел 4.2 программы ИЭИ) оставить по поручению.

ДАНО:
- servicesFromOrder: сопоставленные услуги/работы по поручению (наш прейскурант/шаблон)
- workRows: список строк таблицы 4.2 (каждая строка — формулировка работы)
- orderText: полный текст поручения

ЗАДАЧА:
- Верни индексы тех элементов workRows, которые соответствуют работам, реально требуемым по поручению.
- Будь консервативен: если нет уверенного совпадения — НЕ включай строку.
- Если услуга из servicesFromOrder явно относится к воде/донным/воздуху/почве — оставляй строки таблицы с тем же смыслом, даже если формулировки отличаются.

ФОРМАТ ОТВЕТА: строго JSON
{
  "keepWorkRowIndexes": [0, 5, 9]
}`;

  const userPrompt = `servicesFromOrder:\n${servicesList || '(пусто)'}\n\nworkRows:\n${rowsList}\n\nКонтекст из ТЗ (границы/площадь):\n${String(params.tzContextText || '').trim() || '(нет)'}\n\nПоручение (orderText):\n${String(orderText || '').trim()}`;

  try {
    const resp = await chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    const json = safeJsonExtract(resp);
    if (!json) return { ok: false, keepWorkRowIndexes: [] };

    const parsed = JSON.parse(json) as Partial<ProgramIeiSection42TableMatchResult>;
    const keep = Array.isArray((parsed as any).keepWorkRowIndexes)
      ? uniqInts((parsed as any).keepWorkRowIndexes)
      : [];

    // Фильтруем за пределами массива
    const bounded = keep.filter((i) => i >= 0 && i < workRows.length);

    return { ok: true, keepWorkRowIndexes: bounded };
  } catch {
    return { ok: false, keepWorkRowIndexes: [] };
  }
}
