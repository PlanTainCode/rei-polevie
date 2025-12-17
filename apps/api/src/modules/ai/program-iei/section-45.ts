interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

type ChatFn = (
  messages: ChatMessage[],
  options?: { response_format?: { type: string }; temperature?: number },
) => Promise<string>;

export interface ProgramIeiSection45Data {
  forecastRequirements: string; // Текст из раздела "Требования к составлению прогноза изменения природных условий"
}

/**
 * Извлекает текст раздела "Требования к составлению прогноза изменения природных условий" из ТЗ
 */
export async function extractProgramIeiSection45ViaAi(
  tzText: string,
  chat: ChatFn,
): Promise<ProgramIeiSection45Data> {
  // Детерминированный фоллбэк: ищем раздел по заголовку
  const deterministic = extractSection45Deterministically(tzText);
  if (deterministic) {
    return { forecastRequirements: deterministic };
  }

  // AI extraction
  try {
    const prompt = `Извлеки из технического задания текст раздела "Требования к составлению прогноза изменения природных условий".

Текст ТЗ:
${tzText}

Верни результат СТРОГО в JSON формате:
{
  "forecastRequirements": "полный текст раздела (может быть 'Не требуется' или подробное описание требований)"
}

Если раздел не найден, верни "Не требуется".`;

    const result = await chat([{ role: 'user', content: prompt }], {
      response_format: { type: 'json_object' },
      temperature: 0,
    });

    const parsed = JSON.parse(result);
    return {
      forecastRequirements: String(parsed.forecastRequirements || 'Не требуется').trim(),
    };
  } catch (error) {
    console.error('[AI] Ошибка извлечения п.4.5:', error);
    return { forecastRequirements: 'Не требуется' };
  }
}

/**
 * Детерминированное извлечение текста раздела про прогноз из ТЗ
 */
function extractSection45Deterministically(tzText: string): string | null {
  // Способ 1: Ищем паттерн когда текст идет сразу после заголовка в одной строке
  // "Требования к составлению прогноза изменения природных условий Не требуется"
  const inlinePattern = /требования\s+к\s+составлению\s+прогноза\s+изменения\s+природных\s+условий\s+(.+?)(?=требования\s+о\s+подготовке|требования\s+по\s+обеспечению|$)/is;
  const inlineMatch = tzText.match(inlinePattern);
  
  if (inlineMatch) {
    const extracted = inlineMatch[1].trim();
    console.log('[section-45 parser] Найден inline текст:', extracted);
    if (extracted) {
      return extracted;
    }
  }

  // Способ 2: Построчный парсинг (для случаев когда текст на следующей строке)
  const lines = tzText.split('\n').map((l) => l.trim());
  const headerPattern = /требования\s+к\s+составлению\s+прогноза/i;
  let startIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    if (headerPattern.test(lines[i])) {
      // Проверяем есть ли текст после заголовка в той же строке
      const afterHeader = lines[i].replace(headerPattern, '').trim();
      if (afterHeader && !/^изменения\s+природных\s+условий$/i.test(afterHeader)) {
        // Убираем "изменения природных условий" если есть
        const cleaned = afterHeader.replace(/^изменения\s+природных\s+условий\s*/i, '').trim();
        if (cleaned) {
          console.log('[section-45 parser] Найден текст в строке заголовка:', cleaned);
          return cleaned;
        }
      }
      startIdx = i;
      break;
    }
  }

  if (startIdx < 0) return null;

  // Собираем текст после заголовка до следующего большого раздела
  const content: string[] = [];
  const stopPatterns = [
    /^требования\s+о\s+подготовке\s+предложений/i,
    /^требования\s+по\s+обеспечению\s+контроля/i,
    /^состав\s+и\s+содержание/i,
    /^перечень/i,
  ];

  for (let i = startIdx + 1; i < Math.min(startIdx + 20, lines.length); i++) {
    const line = lines[i];

    // Останавливаемся на следующем разделе
    if (stopPatterns.some((p) => p.test(line))) {
      break;
    }

    // Пропускаем пустые строки в начале
    if (!line && content.length === 0) continue;

    // Добавляем непустые строки
    if (line) {
      content.push(line);
    }
  }

  if (content.length === 0) return null;

  return content.join('\n').trim();
}
