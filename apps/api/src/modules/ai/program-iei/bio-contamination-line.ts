type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

type ChatFn = (messages: ChatMessage[]) => Promise<string>;

export interface BioContaminationLineResult {
  ok: boolean;
  hasCysts: boolean;
  finalText: string;
}

const safeJsonExtract = (s: string): string | null => {
  const m = String(s || '').match(/\{[\s\S]*\}/);
  return m?.[0] || null;
};

export function detectCystsDeterministically(orderText: string): boolean {
  const t = String(orderText || '').toLowerCase();
  // считаем, что "цисты кишечных патогенных простейших" и "цисты простейших" — это наличие цист
  if (/цист\w*\s+(?:кишечн\w*\s+патоген\w*\s+)?просте(йш|и)\w*/i.test(t)) return true;
  // иногда пишут просто "простейшие" рядом с "цисты"
  if (/цист\w*/i.test(t) && /просте(йш|и)\w*/i.test(t)) return true;
  return false;
}

export function removeCystsFromLine(text: string): string {
  let s = String(text || '');
  s = s.replace(/,\s*цист\w*\s+просте(йш|и)\w*/gi, '');
  s = s.replace(/\s+,\s+,/g, ', ');
  s = s.replace(/\s{2,}/g, ' ').trim();
  return s;
}

export async function buildBioContaminationLineViaAi(params: {
  chat: ChatFn;
  orderText: string;
  templateLineText: string;
}): Promise<BioContaminationLineResult> {
  const { chat, orderText, templateLineText } = params;

  const systemPrompt = `Ты эксперт по поручениям на инженерно-экологические изыскания.

Нужно подготовить ФИНАЛЬНЫЙ текст одной строки таблицы 4.2 программы ИЭИ:
"Оценка биологического загрязнения: ..."

Правило:
- Если в поручении (orderText) есть "цисты простейших" или "цисты кишечных патогенных простейших" — оставь упоминание цист.
- Если в поручении цисты НЕ упоминаются — убери из строки фразу про цисты (оставив остальной список показателей без изменений).

ВАЖНО:
- Не выдумывай показатели.
- Возвращай одним предложением, без переносов строк.

ФОРМАТ ОТВЕТА: строго JSON
{
  "hasCysts": false,
  "finalText": "..."
}`;

  const userPrompt = `Шаблон строки (как сейчас в программе):\n${String(templateLineText || '').trim()}\n\nПоручение (orderText):\n${String(orderText || '').trim()}`;

  try {
    const resp = await chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    const json = safeJsonExtract(resp);
    if (!json) {
      const hasCysts = detectCystsDeterministically(orderText);
      return {
        ok: false,
        hasCysts,
        finalText: hasCysts ? String(templateLineText || '').trim() : removeCystsFromLine(templateLineText),
      };
    }

    const parsed = JSON.parse(json) as { hasCysts?: unknown; finalText?: unknown };
    const hasCysts = Boolean(parsed.hasCysts);
    const finalText = String(parsed.finalText || '').trim();

    if (!finalText) {
      const det = detectCystsDeterministically(orderText);
      return {
        ok: false,
        hasCysts: det,
        finalText: det ? String(templateLineText || '').trim() : removeCystsFromLine(templateLineText),
      };
    }

    return { ok: true, hasCysts, finalText };
  } catch {
    const hasCysts = detectCystsDeterministically(orderText);
    return {
      ok: false,
      hasCysts,
      finalText: hasCysts ? String(templateLineText || '').trim() : removeCystsFromLine(templateLineText),
    };
  }
}

