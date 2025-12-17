interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

type ChatFn = (
  messages: ChatMessage[],
  options?: { response_format?: { type: string }; temperature?: number },
) => Promise<string>;

export interface SoilLayer {
  from: number; // начало слоя в метрах (например 0.2)
  to: number; // конец слоя в метрах (например 1.0)
  count: number; // количество проб
  platformNumbers?: number[]; // номера площадок, у которых есть этот слой (например [1,4,5] если в скобках "(1,4,5)")
}

export interface Section47LayersData {
  layers: SoilLayer[]; // слои с количествами проб
  maxDepth: number; // максимальная глубина (верхняя граница самого глубокого слоя)
  surfacePlatformCount: number; // количество пробных площадок в поверхностном слое
  totalBoreholeCount: number; // общее количество геоэкологических скважин
}

/**
 * Извлекает информацию о слоях грунта из поручения для п.4.7
 */
export async function extractSection47LayersViaAi(
  orderText: string,
  chat: ChatFn,
): Promise<Section47LayersData> {
  // Сначала пробуем детерминированный парсинг
  const deterministic = extractLayersDeterministically(orderText);
  if (deterministic) {
    return deterministic;
  }

  // Если не получилось - используем AI
  try {
    const prompt = `Извлеки из поручения информацию о слоях грунта для отбора проб.

Текст поручения:
${orderText}

Найди:
1. Слои грунта с глубинами и количеством проб (например: "в слое 0,2-1,0 м – 15 шт.")
2. Количество пробных площадок в поверхностном слое
3. Количество геоэкологических скважин

ФОРМАТ ОТВЕТА - СТРОГО JSON:
{
  "layers": [
    {"from": 0.2, "to": 1.0, "count": 15},
    {"from": 1.0, "to": 2.0, "count": 15}
  ],
  "surfacePlatformCount": 15,
  "totalBoreholeCount": 15
}

Если информация не найдена, верни пустой массив layers и нули.`;

    const result = await chat([{ role: 'user', content: prompt }], {
      response_format: { type: 'json_object' },
      temperature: 0,
    });

    const parsed = JSON.parse(result);
    const layers: SoilLayer[] = Array.isArray(parsed.layers)
      ? parsed.layers.map((l: { from?: number; to?: number; count?: number }) => ({
          from: Number(l.from) || 0,
          to: Number(l.to) || 0,
          count: Number(l.count) || 0,
        }))
      : [];

    const maxDepth = layers.length > 0 ? Math.max(...layers.map((l) => l.to)) : 0;

    return {
      layers,
      maxDepth,
      surfacePlatformCount: Number(parsed.surfacePlatformCount) || 0,
      totalBoreholeCount: Number(parsed.totalBoreholeCount) || 0,
    };
  } catch (error) {
    console.error('[AI] Ошибка извлечения слоёв п.4.7:', error);
    return {
      layers: [],
      maxDepth: 0,
      surfacePlatformCount: 0,
      totalBoreholeCount: 0,
    };
  }
}

/**
 * Детерминированное извлечение слоёв из текста поручения
 */
function extractLayersDeterministically(orderText: string): Section47LayersData | null {
  const text = orderText || '';

  // Сначала пробуем формат с номерами площадок в скобках:
  // "В слое 0,0-0,2 (1,2,3,4,5)" или "В слое 0,5-1,0 (1,4,5)"
  const layerWithPlatformsPattern =
    /[Вв]\s*слое\s*(\d+[.,]\d+)\s*[-–]\s*(\d+[.,]\d+)\s*\(([0-9,\s]+)\)/gi;

  const layers: SoilLayer[] = [];
  let match;

  while ((match = layerWithPlatformsPattern.exec(text)) !== null) {
    const from = parseFloat(match[1].replace(',', '.'));
    const to = parseFloat(match[2].replace(',', '.'));
    const platformNumbers = match[3]
      .split(/[,\s]+/)
      .map((s: string) => parseInt(s.trim(), 10))
      .filter((n: number) => !isNaN(n) && n > 0);

    if (!isNaN(from) && !isNaN(to) && from < to && platformNumbers.length > 0) {
      layers.push({ from, to, count: platformNumbers.length, platformNumbers });
    }
  }

  // Если формат со скобками не сработал, пробуем старый формат:
  // "в слое X,X-Y,Y м – N шт" или "X,X-Y,Y м - N"
  if (layers.length === 0) {
    const layerPattern =
      /(?:в\s+слое\s+)?(\d+[.,]\d+)\s*[-–]\s*(\d+[.,]\d+)\s*м?\s*[-–—]\s*(\d+)\s*(?:шт|проб)?/gi;

    while ((match = layerPattern.exec(text)) !== null) {
      const from = parseFloat(match[1].replace(',', '.'));
      const to = parseFloat(match[2].replace(',', '.'));
      const count = parseInt(match[3], 10);

      if (!isNaN(from) && !isNaN(to) && !isNaN(count) && from < to) {
        layers.push({ from, to, count });
      }
    }
  }

  if (layers.length === 0) {
    return null;
  }

  // Сортируем по глубине
  layers.sort((a, b) => a.from - b.from);

  // Максимальная глубина - нижняя граница самого глубокого слоя
  const maxDepth = Math.max(...layers.map((l) => l.to));

  // Ищем количество площадок в поверхностном слое
  // "с 15 пробных площадок" или "15 пробных площадок"
  const platformMatch = text.match(/(?:с\s+)?(\d+)\s+пробн\w*\s+площад/i);
  const surfacePlatformCount = platformMatch ? parseInt(platformMatch[1], 10) : 0;

  // Ищем количество скважин
  // "из 15 геоэкологических скважин" или "15 скважин"
  const boreholeMatch = text.match(/(?:из\s+)?(\d+)\s+(?:геоэкологическ\w*\s+)?скважин/i);
  const totalBoreholeCount = boreholeMatch ? parseInt(boreholeMatch[1], 10) : 0;

  return {
    layers,
    maxDepth,
    surfacePlatformCount: surfacePlatformCount || layers[0]?.count || 0,
    totalBoreholeCount: totalBoreholeCount || surfacePlatformCount || layers[0]?.count || 0,
  };
}
