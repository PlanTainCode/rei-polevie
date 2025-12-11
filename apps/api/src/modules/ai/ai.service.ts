import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | MessageContent[];
}

interface MessageContent {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
  };
}

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export interface ExtractedCoordinates {
  latitude: string;
  longitude: string;
  format: 'deg_min' | 'decimal' | 'dms';
}

// Константы для шаблона
export const OBJECT_PURPOSES = [
  'Территория участков под строительство',
  'Территория жилой застройки',
  'Территория промышленной зоны',
  'Жилые и общественные здания и помещения',
  'Производственные здания и помещения',
] as const;

export const TEMPLATE_SERVICES = [
  {
    row: 16,
    num: 1,
    category: 'Радиология (территория)',
    name: 'Радиометрическое обследование территории',
    unit: '1 га',
    keywords: ['радиометрическое', 'мэд', 'гамма', 'территория', 'га'],
  },
  {
    row: 17,
    num: 3,
    category: 'Радиология (территория)',
    name: 'Определение плотности потоков радона (ППР) абсорбционным методом',
    unit: 'датчик (замер)',
    keywords: ['ппр', 'радон', 'плотность потоков', 'абсорбционн', 'датчик'],
  },
  {
    row: 18,
    num: 4,
    category: 'Радиология (здание)',
    name: 'Радиометрическое обследование здания/помещений',
    unit: '1000 кв.м',
    keywords: ['радиометрическое', 'здание', 'помещение', 'мэд'],
  },
  {
    row: 19,
    num: 5,
    category: 'Радиология (здание)',
    name: 'Определение объемной активности (ОА) / ЭРОА радона',
    unit: 'точка (замер)',
    keywords: ['эроа', 'объемная активность', 'радон', 'инспекционн'],
  },
  {
    row: 20,
    num: 6,
    category: 'Почва (стандартный перечень)',
    name: 'Санитарно-гигиеническое обследование почв - СанПиН',
    fullName: 'Санитарно-гигиеническое обследование почв (грунтов) в соответствии с СанПиН 2.1.3684-21, СП 502.1325800.2021',
    unit: 'Проба',
    keywords: ['санпин', 'тяжелые металлы', 'свинец', 'кадмий', 'цинк', 'медь', 'никель', 'мышьяк', 'ртуть', 'бенз(а)пирен', 'нефтепродукты', 'ерн', 'радионуклид', 'цезий', 'калий-40', 'радий', 'торий'],
  },
  {
    row: 21,
    num: 7,
    category: 'Почва (стандартный перечень)',
    name: 'Определение острой токсичности',
    fullName: 'Определение острой токсичности грунтов с применением Chlorella vulgaris и Daphnia magna',
    unit: 'Проба',
    keywords: ['токсичность', 'биотест', 'chlorella', 'daphnia', 'класс опасности'],
  },
  {
    row: 22,
    num: 8,
    category: 'Микробиология',
    name: 'Микробиологические исследования почвы',
    unit: 'Проба',
    keywords: ['окб', 'колиформ', 'e.coli', 'энтерококк', 'сальмонелл', 'гельминт', 'патоген', 'бактери'],
  },
  {
    row: 23,
    num: 8,
    category: 'Мухи',
    name: 'Преимагинальные формы синантропных мух',
    unit: 'Проба',
    keywords: ['мух', 'личинки', 'куколки', 'синантропн', 'преимагинальн'],
  },
  {
    row: 24,
    num: 9,
    category: 'Агрохимия МГСН и 514',
    name: 'Оценка качества почв по МГСН 1.02-02',
    fullName: 'Оценка качества почв при комплексном благоустройстве территории в соответствии с МГСН 1.02-02',
    unit: 'Проба',
    keywords: ['мгсн', 'благоустройств', 'гумус', 'азот', 'нитрат', 'нитрит', 'аммоний', 'фосфор', 'калий', 'глина', 'плотность'],
  },
  {
    row: 25,
    num: 10,
    category: 'Агрохимия МГСН и 514',
    name: 'Хлориды (водорастворимая форма)',
    unit: 'Проба',
    keywords: ['хлорид', 'водорастворим'],
  },
  {
    row: 26,
    num: 11,
    category: 'Агрохимия МГСН и 514',
    name: 'Удельная электрическая проводимость (УЭП)',
    unit: 'Проба',
    keywords: ['уэп', 'электрическая проводимость', 'удельн'],
  },
  {
    row: 27,
    num: 12,
    category: 'Агрохимия ГОСТ',
    name: 'Исследование свойств вскрышных пород по ГОСТ',
    fullName: 'Исследование свойств вскрышных и вмещающих пород при проектировании рекультивационных работ в соответствии с ГОСТ 17.5.1.03-86',
    unit: 'Проба',
    keywords: ['гост', 'рекультивац', 'вскрышн', 'вмещающ'],
  },
  {
    row: 28,
    num: 13,
    category: 'Поверхностная вода',
    name: 'Исследование поверхностных вод',
    unit: 'Проба',
    keywords: ['поверхностн', 'вода', 'водоем', 'река', 'пруд', 'озеро', 'ручей'],
  },
  {
    row: 29,
    num: 14,
    category: 'Донные отложения',
    name: 'Исследование донных отложений',
    unit: 'Проба',
    keywords: ['донн', 'отложен', 'осадок', 'ил'],
  },
  {
    row: 30,
    num: 15,
    category: 'Подземная вода',
    name: 'Исследование подземных вод',
    unit: 'Проба',
    keywords: ['подземн', 'грунтов', 'скважин', 'водоносн'],
  },
  {
    row: 31,
    num: 16,
    category: 'Физ.факторы',
    name: 'Инструментальные исследования шума',
    unit: 'точка (замер)',
    keywords: ['шум', 'акустич'],
  },
  {
    row: 32,
    num: 17,
    category: 'Физ.факторы',
    name: 'Инструментальные исследования ЭМП',
    unit: 'точка (замер)',
    keywords: ['эмп', 'электромагнитн', '50 гц', 'магнитн'],
  },
  {
    row: 33,
    num: 18,
    category: 'Физ.факторы',
    name: 'Инструментальные исследования вибрации',
    unit: 'точка (замер)',
    keywords: ['вибрац'],
  },
  {
    row: 34,
    num: 19,
    category: 'Физ.факторы',
    name: 'Оформление комплекта протоколов',
    unit: 'Комплект',
    keywords: [] as string[],
    alwaysOne: true,
  },
];

export interface ServiceMatch {
  row: number;
  num: number;
  category: string;
  name: string;
  unit: string;
  quantity: number | string;
  confidence: number;
  matchedText?: string;
}

@Injectable()
export class AiService {
  private readonly apiKey: string;
  private readonly model = 'anthropic/claude-3.5-sonnet';

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('OPENROUTER_API_KEY') || '';
  }

  /**
   * Расшифровывает аудиофайл через Deepgram API (бесплатно 200 мин/мес)
   */
  async transcribeAudio(audioBuffer: Buffer): Promise<string> {
    const deepgramApiKey = this.configService.get<string>('DEEPGRAM_API_KEY');
    
    if (!deepgramApiKey) {
      console.error('[AiService] DEEPGRAM_API_KEY не настроен');
      return '';
    }

    try {
      const response = await fetch(
        'https://api.deepgram.com/v1/listen?model=nova-2&language=ru&smart_format=true',
        {
          method: 'POST',
          headers: {
            'Authorization': `Token ${deepgramApiKey}`,
            'Content-Type': 'audio/ogg',
          },
          body: audioBuffer,
        },
      );

      if (!response.ok) {
        const error = await response.text();
        console.error('[AiService] Deepgram API error:', error);
        return '';
      }

      const result = await response.json() as {
        results?: {
          channels?: Array<{
            alternatives?: Array<{ transcript?: string }>;
          }>;
        };
      };
      
      const text = result.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
      console.log('[AiService] Transcribed audio:', text);
      return text.trim();
    } catch (error) {
      console.error('[AiService] Transcription error:', error);
      return '';
    }
  }

  private async chat(messages: ChatMessage[]): Promise<string> {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'HTTP-Referer': 'https://polevie.app',
        'X-Title': 'Polevie',
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: 0.1,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = (await response.json()) as OpenRouterResponse;
    return data.choices[0]?.message?.content || '';
  }

  /**
   * Извлекает адрес объекта из текста (улицу, район, город)
   */
  async extractObjectAddress(objectName: string, documentText: string): Promise<string> {
    const systemPrompt = `Ты эксперт по извлечению адресов из текста.
Твоя задача - найти и извлечь адрес объекта из названия объекта и/или текста документа.

ВАЖНО:
- Ищи упоминания улиц, переулков, проездов, шоссе, проспектов, районов, городов
- Если адрес есть в названии объекта - извлеки его оттуда
- Если адрес в названии неполный, дополни его из текста документа
- Возвращай краткий адрес, достаточный для идентификации места (улица, район или город)
- Если адрес найти не удалось, верни пустую строку

Примеры:
- "ЖК Солнечный по адресу: г.Москва, ул.Ленина, д.10" -> "ул. Ленина, г. Москва"
- "Строительство жилого дома, Московская область, Балашиха" -> "г. Балашиха, Московская обл."
- "Объект: ЖК на Сходненской улице" -> "Сходненская ул."

Отвечай ТОЛЬКО адресом, без пояснений. Если адрес не найден - верни пустую строку.`;

    const userPrompt = `Название объекта: ${objectName}

Текст документа (фрагмент):
${documentText.substring(0, 3000)}

Извлеки адрес объекта:`;

    try {
      const response = await this.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ]);

      const address = response.trim();
      // Проверяем, что это не "не найден" или пустой ответ
      if (address.toLowerCase().includes('не найден') || address.length < 3) {
        return '';
      }
      return address;
    } catch (error) {
      console.error('AI error extracting address:', error);
      return '';
    }
  }

  /**
   * Извлекает адрес заказчика из текста документа
   * Ищет строку вида "5.1 Наименование и местонахождение заказчика..."
   */
  async extractClientAddress(documentText: string): Promise<string> {
    const systemPrompt = `Ты эксперт по извлечению данных из документов.
Твоя задача - найти и извлечь адрес заказчика из текста документа.

ВАЖНО:
- Ищи секцию с местонахождением заказчика (обычно пункт 5.1 или похожий)
- Адрес обычно содержит: индекс, город, улицу, дом
- НЕ включай ОГРН, ИНН, КПП и другие реквизиты
- Возвращай только адрес, без названия компании

Пример текста:
"5.1 Наименование и местонахождение заказчика ООО «ГОРСВЯЗЬСТРОЙ», ОГРН 1097746501269
121059, Город Москва, вн.тер. г. Муниципальный округ Дорогомилово, наб Бережковская, дом 20, строение 19"

Результат: "121059, г. Москва, наб. Бережковская, д. 20, стр. 19"

Отвечай ТОЛЬКО адресом, без пояснений. Если адрес не найден - верни пустую строку.`;

    try {
      const response = await this.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Найди адрес заказчика в тексте:\n\n${documentText.substring(0, 5000)}\n\nАдрес заказчика:` },
      ]);

      const address = response.trim();
      if (address.toLowerCase().includes('не найден') || address.length < 5) {
        return '';
      }
      return address;
    } catch (error) {
      console.error('AI error extracting client address:', error);
      return '';
    }
  }

  /**
   * Определяет назначение объекта по адресу и названию
   */
  async determineObjectPurpose(objectName: string, address: string): Promise<string> {
    const systemPrompt = `Ты эксперт по классификации объектов недвижимости и территорий.
Твоя задача - определить назначение объекта на основе его названия и адреса.

Возможные варианты назначения:
1. Территория участков под строительство - для новых строительных площадок, земельных участков под застройку
2. Территория жилой застройки - для жилых кварталов, микрорайонов, ЖК, многоквартирных домов
3. Территория промышленной зоны - для заводов, фабрик, складов, промзон
4. Жилые и общественные здания и помещения - для конкретных зданий жилого или общественного назначения
5. Производственные здания и помещения - для конкретных производственных зданий

Отвечай ТОЛЬКО одним из этих пяти вариантов, без пояснений.`;

    const userPrompt = `Название объекта: ${objectName}
Адрес: ${address}

Какое назначение объекта?`;

    try {
      const response = await this.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ]);

      // Ищем наиболее похожий вариант из списка
      const normalized = response.toLowerCase().trim();
      for (const purpose of OBJECT_PURPOSES) {
        if (normalized.includes(purpose.toLowerCase().substring(0, 20))) {
          return purpose;
        }
      }

      // По умолчанию
      return OBJECT_PURPOSES[0];
    } catch (error) {
      console.error('AI error determining purpose:', error);
      return OBJECT_PURPOSES[0];
    }
  }

  /**
   * Сопоставляет услуги из поручения с услугами шаблона
   */
  async matchServicesFromOrder(orderText: string): Promise<ServiceMatch[]> {
    const systemPrompt = `Ты эксперт по лабораторным исследованиям почв, воды и экологическому мониторингу.
Твоя задача - проанализировать текст поручения/ТЗ и найти упоминания лабораторных исследований.

Вот список услуг из нашего шаблона заявки в ИЛЦ (лабораторию):

${TEMPLATE_SERVICES.map((s, i) => `${i + 1}. [Строка ${s.row}, №${s.num}] ${s.category}: ${s.name} (${s.unit})`).join('\n')}

ВАЖНО:
- Отдельные показатели (свинец, кадмий, рН, нефтепродукты и т.д.) должны объединяться в соответствующие комплексы
- Если в тексте упоминаются тяжелые металлы, бенз(а)пирен, нефтепродукты, радионуклиды для почвы - это строка 20
- Если упоминается токсичность, биотестирование - это строка 21
- Если упоминаются агрохимические показатели, МГСН, благоустройство - это строка 24
- Если упоминается рекультивация, ГОСТ 17.5 - это строка 27
- ОСОБОЕ ВНИМАНИЕ: Если в тексте упоминаются "цисты кишечных патогенных простейших", "цисты простейших", "простейшие" в контексте паразитологии - это означает, что в заявке ФМБА должны быть цисты. Отметь это в matchedText для услуги микробиологии (строка 22)

Найди ВСЕ упоминания услуг и укажи количество проб/точек/га для каждой.

Отвечай в формате JSON (массив объектов):
[
  {
    "row": 20,
    "quantity": 15,
    "matchedText": "текст из документа который соответствует этой услуге"
  }
]

Если количество не указано явно, укажи "уточняется".
Если услуга не упоминается в тексте - НЕ включай её в ответ.`;

    try {
      const response = await this.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Проанализируй текст поручения:\n\n${orderText}` },
      ]);

      // Парсим JSON из ответа
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return this.fallbackServiceMatching(orderText);
      }

      const parsed = JSON.parse(jsonMatch[0]) as Array<{
        row: number;
        quantity: number | string;
        matchedText?: string;
      }>;

      // Собираем результат
      const matches: ServiceMatch[] = [];

      for (const item of parsed) {
        const service = TEMPLATE_SERVICES.find((s) => s.row === item.row);
        if (service) {
          matches.push({
            row: service.row,
            num: service.num,
            category: service.category,
            name: service.name,
            unit: service.unit,
            quantity: item.quantity,
            confidence: 0.9,
            matchedText: item.matchedText,
          });
        }
      }

      // Всегда добавляем "Оформление комплекта протоколов"
      if (!matches.find((m) => m.row === 34)) {
        const protocolService = TEMPLATE_SERVICES.find((s) => s.row === 34)!;
        matches.push({
          row: 34,
          num: 19,
          category: protocolService.category,
          name: protocolService.name,
          unit: protocolService.unit,
          quantity: 1,
          confidence: 1,
        });
      }

      return matches;
    } catch (error) {
      console.error('AI error matching services:', error);
      return this.fallbackServiceMatching(orderText);
    }
  }

  /**
   * Проверяет, содержит ли название объекта адрес
   * Возвращает true если адрес уже есть в названии
   */
  async checkAddressInName(objectName: string, objectAddress: string): Promise<boolean> {
    if (!objectName || !objectAddress) return false;

    const systemPrompt = `Ты эксперт по анализу адресов в текстах.
Твоя задача - определить, содержит ли название объекта адрес или его часть.

ВАЖНО:
- Если в названии объекта уже упоминается улица, район, город, адрес - ответь "ДА"
- Если в названии только описание объекта без адреса - ответь "НЕТ"

Примеры:
- "Уширение дорог по адресу: район Щукино, ул. Авиационная" - ДА (есть адрес)
- "ЖК Солнечный, ул. Ленина, д. 10" - ДА (есть адрес)
- "Строительство жилого дома" - НЕТ (нет адреса)
- "Реконструкция здания школы №5" - НЕТ (нет адреса)

Отвечай ТОЛЬКО "ДА" или "НЕТ".`;

    try {
      const response = await this.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Название объекта: ${objectName}\nАдрес для сравнения: ${objectAddress}\n\nСодержит ли название адрес?` },
      ]);

      const answer = response.trim().toUpperCase();
      return answer.includes('ДА');
    } catch (error) {
      console.error('AI error checking address in name:', error);
      // Простая проверка по ключевым словам как fallback
      const lowerName = objectName.toLowerCase();
      const addressKeywords = ['ул.', 'улица', 'пер.', 'переулок', 'пр.', 'проспект', 'ш.', 'шоссе', 'адрес', 'район', 'мкр', 'микрорайон', 'д.', 'дом', 'корп', 'стр.'];
      return addressKeywords.some(kw => lowerName.includes(kw));
    }
  }

  /**
   * Резервный метод сопоставления по ключевым словам
   */
  private fallbackServiceMatching(text: string): ServiceMatch[] {
    const matches: ServiceMatch[] = [];
    const lowerText = text.toLowerCase();

    for (const service of TEMPLATE_SERVICES) {
      if (service.alwaysOne) {
        matches.push({
          row: service.row,
          num: service.num,
          category: service.category,
          name: service.name,
          unit: service.unit,
          quantity: 1,
          confidence: 1,
        });
        continue;
      }

      const keywordMatches = service.keywords.filter((kw) =>
        lowerText.includes(kw.toLowerCase()),
      );

      if (keywordMatches.length >= 2 || (keywordMatches.length === 1 && service.keywords.length <= 2)) {
        // Пытаемся найти количество рядом с ключевыми словами
        let quantity: number | string = 'уточняется';

        const numberPattern = /(\d+)\s*(?:проб|точк|шт|замер|га)/gi;
        const numberMatches = text.match(numberPattern);
        if (numberMatches) {
          const num = parseInt(numberMatches[0]);
          if (!isNaN(num) && num > 0 && num < 1000) {
            quantity = num;
          }
        }

        matches.push({
          row: service.row,
          num: service.num,
          category: service.category,
          name: service.name,
          unit: service.unit,
          quantity,
          confidence: keywordMatches.length / service.keywords.length,
        });
      }
    }

    return matches;
  }

  /**
   * Извлекает GPS координаты с фотографии GPS-трекера через Vision AI
   * Распознаёт текст на экране трекера и извлекает координаты
   * Возвращает координаты в десятичном формате (decimal degrees)
   */
  async extractCoordinatesFromPhoto(imageBase64: string): Promise<ExtractedCoordinates | null> {
    const systemPrompt = `Ты эксперт по распознаванию GPS координат с фотографий GPS-трекеров и навигаторов.

Твоя задача - найти и извлечь координаты с экрана устройства на фотографии и КОНВЕРТИРОВАТЬ их в десятичный формат.

ВАЖНО:
- Ищи числа, похожие на координаты (широта/долгота)
- Координаты на фото могут быть в разных форматах:
  * Градусы и минуты: 55 50.792, 37 39.277
  * Десятичные градусы: 55.84653, 37.65462
  * Градусы, минуты, секунды: 55°50'47.5"N, 37°39'16.6"E
- Широта обычно от 40 до 80 (для России), долгота от 20 до 180
- На экране могут быть подписи: N/С (северная широта), E/В (восточная долгота), lat, lon, ш, д

КОНВЕРТАЦИЯ В ДЕСЯТИЧНЫЙ ФОРМАТ:
- Градусы минуты → десятичные: 55 50.792 = 55 + (50.792/60) = 55.84653
- DMS → десятичные: 55°50'47.5" = 55 + (50/60) + (47.5/3600) = 55.84653

Отвечай СТРОГО в формате JSON с координатами в ДЕСЯТИЧНОМ формате:
{
  "latitude": "55.84653",
  "longitude": "037.65462",
  "format": "decimal"
}

Для долготы добавляй ведущий ноль если меньше 100 (например 037.65462).
Точность: 5 знаков после запятой.

Если координаты не найдены, верни: {"error": "not_found"}`;

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://polevie.app',
          'X-Title': 'Polevie',
        },
        body: JSON.stringify({
          model: 'anthropic/claude-3.5-sonnet',
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Найди и извлеки GPS координаты с этого фото GPS-трекера:',
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/jpeg;base64,${imageBase64}`,
                  },
                },
              ],
            },
          ],
          temperature: 0.1,
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        console.error('OpenRouter Vision API error:', response.status);
        return null;
      }

      const data = (await response.json()) as OpenRouterResponse;
      const content = data.choices[0]?.message?.content || '';
      
      console.log('AI Vision response:', content);

      // Парсим JSON из ответа
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      const parsed = JSON.parse(jsonMatch[0]);
      
      if (parsed.error) return null;
      
      if (parsed.latitude && parsed.longitude) {
        return {
          latitude: String(parsed.latitude),
          longitude: String(parsed.longitude),
          format: parsed.format || 'deg_min',
        };
      }

      return null;
    } catch (error) {
      console.error('Error extracting coordinates from photo:', error);
      return null;
    }
  }

  /**
   * Извлекает данные о слоях отбора проб из текста документа через AI
   * Возвращает унифицированный формат для всех типов проб
   */
  async extractSamplingLayers(documentText: string): Promise<AiSamplingData> {
    const systemPrompt = `Ты эксперт по анализу документов для отбора проб почвы, донных отложений и воды.

Твоя задача - извлечь информацию о слоях отбора проб и количестве проб в каждом слое из текста документа.

ВАЖНО:
1. В документе могут быть разные типы проб:
   - Почва/грунт (ПГ) — ищи секцию "Отбор проб ПГ" или просто "Отбор проб" если нет ПГ/ДО/Вода
   - Донные отложения (ДО) — ищи секцию "Отбор проб ДО"
   - Вода — ищи секцию "Отбор проб Вода"

2. Слои записываются как глубины: "0,0-0,2", "0,2-0,5", "0-0,5" и т.д.
   - Первый слой (обычно 0,0-0,2 или 0-0,2) — это пробная площадка (isPP: true)
   - Остальные слои — скважины (isPP: false)

3. Количество проб обычно указано рядом со слоями или в отдельной колонке "Кол-во" / "проб"
   - Может быть указано как: "4", "2 пробы", "по 2 на слой"

4. Микробиология — ищи упоминания "микробиологическ", "паразитологич", "санитарно-бактериол"
   - Обычно указано общее количество проб

Отвечай СТРОГО в формате JSON:
{
  "soil": {
    "layers": [
      {"depthFrom": 0.0, "depthTo": 0.2, "label": "0,0-0,2", "count": 4, "isPP": true},
      {"depthFrom": 0.2, "depthTo": 0.5, "label": "0,2-0,5", "count": 4, "isPP": false}
    ],
    "totalCount": 8
  },
  "sediment": {
    "layers": [
      {"depthFrom": 0.0, "depthTo": 0.5, "label": "0-0,5", "count": 2, "isPP": false}
    ],
    "totalCount": 2
  },
  "water": {
    "layers": [
      {"depthFrom": 0, "depthTo": 0, "label": "поверхн.", "count": 2, "isPP": false}
    ],
    "totalCount": 2
  },
  "microbiology": {
    "count": 3,
    "hasMicrobiology": true,
    "hasParasitology": true
  }
}

Если какого-то типа проб нет в документе, верни пустой массив layers и totalCount: 0.
Если микробиологии нет, верни count: 0, hasMicrobiology: false, hasParasitology: false.`;

    try {
      const response = await this.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Извлеки данные о слоях отбора проб из этого документа:\n\n${documentText}` },
      ]);

      console.log('AI sampling layers response:', response);

      // Парсим JSON из ответа
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('No JSON found in AI response');
        return this.getEmptySamplingData();
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        soil: {
          layers: (parsed.soil?.layers || []).map(this.normalizeLayer),
          totalCount: parsed.soil?.totalCount || 0,
        },
        sediment: {
          layers: (parsed.sediment?.layers || []).map(this.normalizeLayer),
          totalCount: parsed.sediment?.totalCount || 0,
        },
        water: {
          layers: (parsed.water?.layers || []).map(this.normalizeLayer),
          totalCount: parsed.water?.totalCount || 0,
        },
        microbiology: {
          count: parsed.microbiology?.count || 0,
          hasMicrobiology: parsed.microbiology?.hasMicrobiology || false,
          hasParasitology: parsed.microbiology?.hasParasitology || false,
        },
      };
    } catch (error) {
      console.error('Error extracting sampling layers:', error);
      return this.getEmptySamplingData();
    }
  }

  private normalizeLayer(layer: any): AiSamplingLayer {
    return {
      depthFrom: Number(layer.depthFrom) || 0,
      depthTo: Number(layer.depthTo) || 0,
      label: String(layer.label || ''),
      count: Number(layer.count) || 0,
      isPP: Boolean(layer.isPP),
    };
  }

  private getEmptySamplingData(): AiSamplingData {
    return {
      soil: { layers: [], totalCount: 0 },
      sediment: { layers: [], totalCount: 0 },
      water: { layers: [], totalCount: 0 },
      microbiology: { count: 0, hasMicrobiology: false, hasParasitology: false },
    };
  }
}

// Интерфейсы для AI парсинга слоёв
export interface AiSamplingLayer {
  depthFrom: number;
  depthTo: number;
  label: string;
  count: number;
  isPP: boolean;
}

export interface AiSamplingData {
  soil: {
    layers: AiSamplingLayer[];
    totalCount: number;
  };
  sediment: {
    layers: AiSamplingLayer[];
    totalCount: number;
  };
  water: {
    layers: AiSamplingLayer[];
    totalCount: number;
  };
  microbiology: {
    count: number;
    hasMicrobiology: boolean;
    hasParasitology: boolean;
  };
}

