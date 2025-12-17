/**
 * Определение типа объекта для пунктов 8.3 и 8.4 программы ИЭИ
 */

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

type ChatFn = (
  messages: ChatMessage[],
  options?: { response_format?: { type: string }; temperature?: number },
) => Promise<string>;

export interface ObjectTypeFlags {
  isLinearCommunication: boolean; // линейный объект связи (сети связи, ВОЛС, кабель связи) - для п.8.3
  isRoadObject: boolean; // дорога, путепровод, тоннель, эстакада, мост - для п.8.4
}

/**
 * Определяет тип объекта через AI
 */
export async function determineObjectTypeViaAi(
  objectName: string,
  chat: ChatFn,
): Promise<ObjectTypeFlags> {
  // Сначала пробуем детерминистически
  const deterministic = determineObjectTypeDeterministically(objectName);
  if (deterministic) {
    return deterministic;
  }

  const systemPrompt = `Ты анализируешь наименование строительного объекта и определяешь его тип.

Верни JSON с двумя полями:
- isLinearCommunication: true если объект - линейный объект связи (сети связи, ВОЛС, кабель связи, линии связи, оптоволокно, телекоммуникации)
- isRoadObject: true если объект относится к автодорогам (дорога, путепровод, тоннель, эстакада, мост, развязка, переезд)

Примеры:
- "Строительство сетей связи" → {"isLinearCommunication": true, "isRoadObject": false}
- "Реконструкция линий связи ВОЛС" → {"isLinearCommunication": true, "isRoadObject": false}
- "Строительство кабеля связи" → {"isLinearCommunication": true, "isRoadObject": false}
- "Реконструкция автомобильной дороги М-1" → {"isLinearCommunication": false, "isRoadObject": true}
- "Строительство путепровода через ж/д" → {"isLinearCommunication": false, "isRoadObject": true}
- "Строительство ВЛ 10кВ" → {"isLinearCommunication": false, "isRoadObject": false}
- "Жилой дом" → {"isLinearCommunication": false, "isRoadObject": false}

Верни ТОЛЬКО JSON без пояснений.`;

  try {
    const response = await chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Наименование объекта: "${objectName}"` },
      ],
      { response_format: { type: 'json_object' }, temperature: 0 },
    );

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { isLinearCommunication: false, isRoadObject: false };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      isLinearCommunication: Boolean(parsed.isLinearCommunication),
      isRoadObject: Boolean(parsed.isRoadObject),
    };
  } catch {
    return { isLinearCommunication: false, isRoadObject: false };
  }
}

/**
 * Детерминистическое определение типа объекта
 */
function determineObjectTypeDeterministically(objectName: string): ObjectTypeFlags | null {
  const name = objectName.toLowerCase();

  // Линейные объекты связи (сети связи, ВОЛС, кабель связи)
  // Используем [а-яё]* вместо \w* для русских букв
  const communicationPatterns = [
    /сет[а-яё]*\s+связи/i, // сети связи, сетей связи
    /лини[а-яё]*\s+связи/i, // линии связи, линий связи
    /кабел[а-яё]*\s+связи/i, // кабель связи, кабеля связи
    /волс/i,
    /оптоволокн/i,
    /телекоммуникаци/i,
  ];

  const isLinearCommunication = communicationPatterns.some((p) => p.test(name));

  // Дорожные объекты
  const roadPatterns = [
    /дорог/i,
    /путепровод/i,
    /тоннел/i,
    /туннел/i,
    /эстакад/i,
    /мост/i,
    /развязк/i,
    /переезд/i,
    /автомагистрал/i,
  ];

  const isRoadObject = roadPatterns.some((p) => p.test(name));

  // Возвращаем результат - детерминистика достаточно точная
  return { isLinearCommunication, isRoadObject };
}
