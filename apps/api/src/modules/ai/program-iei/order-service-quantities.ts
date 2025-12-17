import type { ServiceMatch } from '../ai.service';

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

type ChatFn = (messages: ChatMessage[]) => Promise<string>;

type ServiceRef = { row: number; category: string; name: string; unit: string };

export interface OrderServiceQuantitiesResult {
  ok: boolean;
  /** row -> quantity (число проб/точек/га/изм из поручения) */
  byRow: Record<number, number | string>;
  /** для дебага */
  usedLines?: string[];
}

const safeJsonExtract = (s: string): string | null => {
  const m = String(s || '').match(/\{[\s\S]*\}/);
  return m?.[0] || null;
};

const normalizeNumber = (v: string): number | null => {
  const s = String(v || '').trim();
  if (!s || s === '-' || s === '–') return null;
  const n = Number(s.replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  return n;
};

const extractCandidateLines = (orderText: string): string[] => {
  const lines = String(orderText || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/\u00A0/g, ' ').trim())
    .filter(Boolean);

  const out: string[] = [];

  for (const line of lines) {
    // табличные строки обычно имеют табы или много пробелов
    const parts = line.includes('\t')
      ? line.split(/\t+/).map((p) => p.trim()).filter(Boolean)
      : line.split(/\s{2,}/).map((p) => p.trim()).filter(Boolean);

    if (parts.length < 3) continue;

    // пытаемся понять формат: name | unit | a | b
    const name = parts[0];
    const unit = parts[1];

    if (!name || !unit) continue;

    // ищем числовые колонки в конце
    const last1 = parts[parts.length - 1];
    const last2 = parts.length >= 4 ? parts[parts.length - 2] : null;

    const n1 = normalizeNumber(last1);
    const n2 = last2 != null ? normalizeNumber(last2) : null;

    if (n1 == null && n2 == null) continue;

    // слишком длинные строки не берём
    if (name.length > 220) continue;

    const a = last2 ?? '';
    const b = last1;

    out.push(`${name} | ${unit} | ${a} | ${b}`);
    if (out.length >= 160) break;
  }

  return out;
};

export async function extractOrderServiceQuantitiesViaAi(params: {
  chat: ChatFn;
  orderText: string;
  servicesCatalog: ServiceRef[];
  servicesFromOrder: ServiceMatch[];
}): Promise<OrderServiceQuantitiesResult> {
  const { chat, orderText, servicesCatalog, servicesFromOrder } = params;

  const candidates = extractCandidateLines(orderText);

  const catalogText = (servicesCatalog || [])
    .map((s) => `- [row ${s.row}] ${s.category}: ${s.name} (${s.unit})`)
    .join('\n');

  const servicesPicked = (servicesFromOrder || [])
    .map((s) => `- [row ${s.row}] ${s.name}`)
    .join('\n');

  const linesText = candidates.map((l) => `- ${l}`).join('\n');

  const systemPrompt = `Ты эксперт по поручениям на ИЭИ.

Нужно вернуть КОЛИЧЕСТВО (quantity) по каждой услуге из нашего прейскуранта (row).
Источник количества — табличные строки из поручения.

КРИТИЧНО:
- Возвращай именно количество проб/точек/га/измерений из поручения.
- В поручении часто 2 числовых столбца. Если не уверен, то выбирай правый числовой столбец как "кол-во".
- Если стоит "-" — значит количества нет (верни null или не включай строку).
- НЕ выдумывай.

ФОРМАТ ОТВЕТА: строго JSON
{
  "byRow": {
    "16": 0.77,
    "17": 28,
    "20": 14,
    "21": 14,
    "22": 3,
    "23": 3,
    "28": 0,
    "29": 0,
    "31": 2
  }
}`;

  const userPrompt = `Выбранные услуги (уже сопоставлены, это подсказка что искать):\n${servicesPicked || '(пусто)'}\n\nКаталог услуг (прейскурант):\n${catalogText}\n\nТабличные строки поручения (name | unit | colA | colB):\n${linesText || '(не найдено)'}\n\nПолный текст поручения (на всякий случай):\n${String(orderText || '').slice(0, 12000)}`;

  try {
    const resp = await chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    const json = safeJsonExtract(resp);
    if (!json) return { ok: false, byRow: {}, usedLines: candidates };

    const parsed = JSON.parse(json) as { byRow?: Record<string, number | string | null> };
    const byRow: Record<number, number | string> = {};

    for (const [k, v] of Object.entries(parsed.byRow || {})) {
      const row = Number(k);
      if (!Number.isFinite(row)) continue;
      if (v === null) continue;
      if (typeof v === 'number' && Number.isFinite(v)) byRow[row] = v;
      else {
        const s = String(v).trim();
        if (s && s !== '-' && s !== '–') byRow[row] = s;
      }
    }

    return { ok: true, byRow, usedLines: candidates };
  } catch {
    return { ok: false, byRow: {}, usedLines: candidates };
  }
}
