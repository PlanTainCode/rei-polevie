import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  extractProgramIeiOrderFlagsViaAi,
  ProgramIeiOrderFlags,
} from './program-iei/order-flags';
import { matchProgramIeiSection42TableRowsViaAi } from './program-iei/section-42-table-match';
import { extractOrderServiceQuantitiesViaAi } from './program-iei/order-service-quantities';
import { buildBioContaminationLineViaAi } from './program-iei/bio-contamination-line';
import {
  extractProgramIeiSection45ViaAi,
  ProgramIeiSection45Data,
} from './program-iei/section-45';
import {
  extractSection47LayersViaAi,
  Section47LayersData,
} from './program-iei/section-47-layers';
import {
  determineObjectTypeViaAi,
  ObjectTypeFlags,
} from './program-iei/object-type';

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

export type {
  ProgramIeiOrderFlags,
  ProgramIeiSection45Data,
  Section47LayersData,
  ObjectTypeFlags,
};

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
      // Конвертируем Buffer в Uint8Array для совместимости с fetch
      const uint8Array = new Uint8Array(audioBuffer);
      
      const response = await fetch(
        'https://api.deepgram.com/v1/listen?model=nova-2&language=ru&smart_format=true',
        {
          method: 'POST',
          headers: {
            'Authorization': `Token ${deepgramApiKey}`,
            'Content-Type': 'audio/ogg',
          },
          body: uint8Array,
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
   * Извлекает флаги по поручению для настройки состава работ раздела 4 (программа ИЭИ).
   * Логика вынесена в отдельный модуль, чтобы не раздувать `ai.service.ts`.
   */
  async extractProgramIeiOrderFlags(
    orderText: string,
    objectName: string,
  ): Promise<ProgramIeiOrderFlags> {
    return extractProgramIeiOrderFlagsViaAi({
      chat: this.chat.bind(this),
      orderText,
      objectName,
    });
  }

  /**
   * Раздел 4.2 (таблица работ): выбирает, какие строки таблицы оставить по поручению.
   * Вынесено в отдельный модуль, чтобы не раздувать `ai.service.ts`.
   */
  async matchProgramIeiSection42TableRows(params: {
    orderText: string;
    workRows: string[];
    servicesFromOrder: ServiceMatch[];
    tzContextText?: string;
  }): Promise<{ ok: boolean; keepWorkRowIndexes: number[] }> {
    return matchProgramIeiSection42TableRowsViaAi({
      chat: this.chat.bind(this),
      orderText: params.orderText,
      workRows: params.workRows,
      servicesFromOrder: params.servicesFromOrder,
      tzContextText: params.tzContextText,
    });
  }

  /**
   * Поручение (табличная часть): вытаскивает корректные количества (пробы/точки/га/изм)
   * для строк прейскуранта (row). Нужен именно для заполнения таблиц программы ИЭИ.
   */
  async extractOrderServiceQuantities(params: {
    orderText: string;
    servicesFromOrder: ServiceMatch[];
  }): Promise<{ ok: boolean; byRow: Record<number, number | string> }> {
    const res = await extractOrderServiceQuantitiesViaAi({
      chat: this.chat.bind(this),
      orderText: params.orderText,
      servicesCatalog: TEMPLATE_SERVICES.map((s) => ({
        row: s.row,
        category: s.category,
        name: s.name,
        unit: s.unit,
      })),
      servicesFromOrder: params.servicesFromOrder,
    });
    return { ok: res.ok, byRow: res.byRow };
  }

  /**
   * Таблица 4.2: строка \"Оценка биологического загрязнения...\".
   * Возвращает финальный текст строки с/без \"цисты простейших\" по поручению.
   */
  async buildProgramIeiBioContaminationLine(params: {
    orderText: string;
    templateLineText: string;
  }): Promise<{ ok: boolean; hasCysts: boolean; finalText: string }> {
    return buildBioContaminationLineViaAi({
      chat: this.chat.bind(this),
      orderText: params.orderText,
      templateLineText: params.templateLineText,
    });
  }

  /**
   * Извлекает текст раздела "Требования к составлению прогноза изменения природных условий" из ТЗ (для п.4.5)
   */
  async extractProgramIeiSection45(tzText: string): Promise<ProgramIeiSection45Data> {
    return extractProgramIeiSection45ViaAi(tzText, this.chat.bind(this));
  }

  /**
   * П.4.7: Извлекает информацию о слоях грунта из поручения
   */
  async extractSection47Layers(orderText: string): Promise<Section47LayersData> {
    return extractSection47LayersViaAi(orderText, this.chat.bind(this));
  }

  /**
   * П.8.3-8.4: Определяет тип объекта (электросети, дорога) по наименованию
   */
  async determineObjectType(objectName: string): Promise<ObjectTypeFlags> {
    return determineObjectTypeViaAi(objectName, this.chat.bind(this));
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
- Возвращай краткий адрес, достаточный для идентификации места
- ФОРМАТ АДРЕСА: город/область, район (если есть), улица. ОТ КРУПНОГО К МЕЛКОМУ!
- Если адрес найти не удалось, верни пустую строку

Примеры:
- "ЖК Солнечный по адресу: г.Москва, ул.Ленина, д.10" -> "г. Москва, ул. Ленина"
- "Строительство жилого дома, Московская область, Балашиха" -> "Московская обл., г. Балашиха"
- "Объект: ЖК на Сходненской улице" -> "Сходненская ул."
- "район Щукино, ул. Авиационная" -> "г. Москва, район Щукино, ул. Авиационная"
- "пос. Красная Пахра, д. 15" -> "Московская обл., пос. Красная Пахра"

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
   * Форматирует адрес для справок в специальном формате
   * Формат для Москвы: "район ОКРУГ г.Москвы, улица"
   * Пример: "Кузьминки ЮВАО г.Москвы, ул. Юных Ленинцев"
   */
  async formatAddressForInquiries(address: string): Promise<string> {
    if (!address || address.length < 5) return '';

    const systemPrompt = `Ты эксперт по форматированию адресов для официальных запросов в ведомства Москвы.

Твоя задача - преобразовать адрес в СПЕЦИАЛЬНЫЙ ФОРМАТ для справок:
- Для Москвы: "район ОКРУГ г.Москвы, улица"
- Для Московской области: "район/город область, улица"

ВАЖНО:
- Определи район и округ Москвы по адресу
- ОКРУГ указывай аббревиатурой: ЦАО, САО, СВАО, ВАО, ЮВАО, ЮАО, ЮЗАО, ЗАО, СЗАО, ЗелАО, ТАО, НАО
- Район пиши полностью (Кузьминки, Марьино, Отрадное и т.д.)
- Улицу сокращай: ул., пер., пр-т, ш., наб.
- НЕ включай номер дома

Примеры:
- "г. Москва, район Кузьминки, ул. Юных Ленинцев, д. 5" -> "Кузьминки ЮВАО г.Москвы, ул. Юных Ленинцев"
- "Москва, Отрадное, ул. Декабристов" -> "Отрадное СВАО г.Москвы, ул. Декабристов"
- "г. Москва, ул. Тверская, д. 1" -> "Тверской ЦАО г.Москвы, ул. Тверская"
- "Московская обл., г. Балашиха, ул. Ленина" -> "г. Балашиха Московской обл., ул. Ленина"

Отвечай ТОЛЬКО отформатированным адресом, без пояснений.`;

    const userPrompt = `Преобразуй адрес в формат для справок:
${address}`;

    try {
      const response = await this.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ]);

      return response.trim();
    } catch (error) {
      console.error('AI error formatting address for inquiries:', error);
      return address; // Возвращаем исходный адрес при ошибке
    }
  }

  /**
   * Извлекает ТОЛЬКО секцию 5 "Сведения о заказчике" из текста ТЗ
   * Это гарантирует, что AI не увидит блоки СОГЛАСОВАНО и прочий мусор
   */
  private extractClientSection(text: string): string {
    // Паттерны для поиска начала секции о заказчике
    const startPatterns = [
      /5\.\s*СВЕДЕНИЯ\s*О\s*ЗАКАЗЧИКЕ/i,
      /5\s*СВЕДЕНИЯ\s*О\s*ЗАКАЗЧИКЕ/i,
      /5\.1[\.\s]+Наименование\s*(и\s*)?местонахождение\s*заказчика/i,
      /5\.1\s+Наименование/i,
      /СВЕДЕНИЯ\s*О\s*ЗАКАЗЧИКЕ/i,
      /Наименование\s*(и\s*)?местонахождение\s*заказчика/i,
    ];

    // Паттерны для поиска конца секции (начало следующей секции)
    const endPatterns = [
      /6\.\s*СВЕДЕНИЯ/i,
      /6\s+СВЕДЕНИЯ/i,
      /6\.\s*ОБЪЕКТ/i,
      /7\.\s*/,
      /СВЕДЕНИЯ\s*ОБ?\s*ИСПОЛНИТЕЛ/i,
    ];

    let startIndex = -1;
    for (const pattern of startPatterns) {
      const match = text.match(pattern);
      if (match && match.index !== undefined) {
        startIndex = match.index;
        break;
      }
    }

    if (startIndex === -1) {
      // Секция не найдена — возвращаем пустую строку
      console.log('[extractClientSection] Секция 5 о заказчике не найдена');
      return '';
    }

    // Ищем конец секции
    let endIndex = text.length;
    const textFromStart = text.substring(startIndex);
    
    for (const pattern of endPatterns) {
      const match = textFromStart.match(pattern);
      if (match && match.index !== undefined && match.index > 50) {
        // Нашли конец секции (минимум 50 символов от начала)
        endIndex = startIndex + match.index;
        break;
      }
    }

    const section = text.substring(startIndex, Math.min(endIndex, startIndex + 2000));
    console.log(`[extractClientSection] Извлечена секция (${section.length} символов): ${section.substring(0, 200)}...`);
    
    return section;
  }

  /**
   * Извлекает название заказчика из текста ТЗ
   * Ищет секцию п.5.1 "Наименование и местонахождение заказчика"
   */
  async extractClientName(tzText: string): Promise<string> {
    // Извлекаем ТОЛЬКО секцию 5 о заказчике
    const clientSection = this.extractClientSection(tzText);
    
    if (!clientSection) {
      console.log('[extractClientName] Секция о заказчике не найдена, пропускаем');
      return '';
    }
    
    const systemPrompt = `Извлеки НАЗВАНИЕ ЗАКАЗЧИКА из текста.

ФОРМАТ ОТВЕТА:
- Возвращай ТОЛЬКО название организации (например: ООО «КАРАТ-91», ООО «ГВИН-ПИН»)
- НЕ включай адрес, ОГРН, ИНН и другие реквизиты

Отвечай ТОЛЬКО названием, одной строкой.`;

    try {
      const response = await this.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Текст секции о заказчике:\n\n${clientSection}\n\nНазвание заказчика:` },
      ]);

      const clientName = response.trim();
      if (clientName.toLowerCase().includes('не найден') || clientName.length < 3) {
        return '';
      }
      return clientName;
    } catch (error) {
      console.error('AI error extracting client name:', error);
      return '';
    }
  }

  /**
   * Извлекает адрес заказчика из текста документа
   * Ищет строку вида "5.1 Наименование и местонахождение заказчика..."
   */
  async extractClientAddress(documentText: string): Promise<string> {
    // Извлекаем ТОЛЬКО секцию 5 о заказчике
    const clientSection = this.extractClientSection(documentText);
    
    if (!clientSection) {
      console.log('[extractClientAddress] Секция о заказчике не найдена, пропускаем');
      return '';
    }
    
    const systemPrompt = `Извлеки АДРЕС ЗАКАЗЧИКА из текста.

ФОРМАТ ОТВЕТА:
- Адрес содержит: индекс, город, улицу, дом
- НЕ включай ОГРН, ИНН, КПП и другие реквизиты
- Возвращай только адрес, без названия компании

Пример:
Текст: "ООО «ГОРСВЯЗЬСТРОЙ», ОГРН 1097746501269, 121059, Город Москва, наб Бережковская, дом 20"
Результат: "121059, г. Москва, наб. Бережковская, д. 20"

Отвечай ТОЛЬКО адресом, одной строкой.`;

    try {
      const response = await this.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Текст секции о заказчике:\n\n${clientSection}\n\nАдрес заказчика:` },
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
   * Извлекает данные для раздела 1 "Общие сведения" программы ИЭИ
   * AI анализирует ТЗ и шаблон программы, сопоставляет поля
   */
  async extractProgramIeiSection1(
    tzText: string,
    templateSection1Text: string,
  ): Promise<ProgramIeiSection1Data> {
    const systemPrompt = `Ты эксперт по инженерно-экологическим изысканиям (ИЭИ).
Твоя задача - ТОЧНО извлечь данные из Технического Задания (ТЗ) для заполнения программы ИЭИ.

КРИТИЧЕСКИ ВАЖНО - КОПИРУЙ ТЕКСТ ИЗ ТЗ БЕЗ ИЗМЕНЕНИЙ:

1. **goalsAndTasks** - КОПИРУЙ ПОЛНОСТЬЮ ВЕСЬ ТЕКСТ из пункта "Цели и задачи инженерных изысканий" (обычно п.7 ТЗ).
   Пример из ТЗ: "Инженерные изыскания выполняются с целью комплексного изучения условий территории... Задачи ИЭИ определены..."
   → Копируй ДОСЛОВНО весь этот текст!

2. **permanentOccupancy** - из п.10.6 "Наличие помещений с постоянным нахождением людей"
   Возможные значения: "Предусмотрено" или "Отсутствуют" - выбери ОДНО что указано в ТЗ!

3. **urbanPlanningActivity** - из п.4 "Вид градостроительной деятельности"
   Возможные значения: "Архитектурно-строительное проектирование", "Строительство", "Реконструкция", "Капитальный ремонт" и т.д.
   Выбери ОДНО что указано в ТЗ!

4. **siteDescription** - из п.12 "Краткая техническая характеристика объекта" - текст про территорию и площадь, КОПИРУЙ ПОЛНОСТЬЮ!
   Пример: "Территория обследования расположена в деревне Красная Пахра... Площадь участка объекта – около 0,77 га."

5. **technicalCharacteristics** - из п.12 "Краткая техническая характеристика объекта" - КОПИРУЙ ПОЛНОСТЬЮ!
   Включая описание зданий, габариты, этажность, коммуникации.
   ВАЖНО: УБЕРИ текст про глубину земляных работ из этого поля! Например текст вида:
   "Глубина ведения земляных работ (max): в местах фундамента здания – до 5,0 м; в местах прокладки инженерных коммуникаций – до 5,0 м."
   Этот текст НЕ должен быть в technicalCharacteristics!

6. **excavationDepth** - глубина ведения земляных работ из п.12 - КОПИРУЙ ФРАЗУ ЦЕЛИКОМ!
   Пример: "до 5,0 м" или "до 5,0 метров" - НЕ только число!

МАППИНГ ПОЛЕЙ ТЗ → JSON:
- п.1 "Наименование объекта" → objectName
- п.2 "Местоположение объекта" → objectLocation  
- п.4 "Вид градостроительной деятельности" → urbanPlanningActivity (ОДНО значение!)
- п.5.1 → clientName, clientOgrn, clientAddress
- п.5.2 → clientContactName, clientContactPhone, clientContactEmail
- п.7 "Цели и задачи" → goalsAndTasks (ВЕСЬ ТЕКСТ!)
- п.8 "Этап выполнения" → surveyStage
- п.10.1 "Назначение" → objectPurpose
- п.10.2 → transportInfrastructure
- п.10.3 → hazardousProduction
- п.10.4 → fireHazard
- п.10.5 → responsibilityLevel
- п.10.6 "Наличие помещений" → permanentOccupancy (ОДНО значение: Предусмотрено или Отсутствуют!)
- п.11 "Данные о границах" → siteArea (только площадь, например "около 0,77 га")
- п.12 "Техническая характеристика" → technicalCharacteristics (ВЕСЬ ТЕКСТ!), siteDescription (текст про территорию и площадь)
- п.12 → excavationDepth (глубина работ КАК НАПИСАНО, например "до 5,0 м" или "до 5,0 метров", НЕ просто число!)

Для титульной страницы:
- clientDirectorPosition: должность руководителя заказчика (обычно "Директор")
- clientDirectorName: "Фамилия И.О." (сокращённое ФИО из п.5.2, например "Лучников Ю.В." если полное "Лучников Юрий Владимирович")
- clientShortName: название без ООО/АО/ЗАО и кавычек (например "КАРАТ-91" из "ООО «КАРАТ-91»")

Координаты участка (из п.25 ТЗ или таблицы с координатами):
- coordinates: объект {lat, lon} с первой точкой координат участка в десятичном формате
  Пример: если в ТЗ "55.427815257, 37.263461927" → {"lat": 55.427815257, "lon": 37.263461927}
  Если координат нет → null

Кадастровый номер (если указан в ТЗ):
- cadastralNumber: кадастровый номер участка в формате XX:XX:XXXXXXX:XXX
  Если не указан → пустая строка

Для п.2.1 Программы - "Перечень исходных материалов и данных":
- backgroundConcentrationsRef: из п.22.5 ТЗ извлеки ТОЛЬКО номер и дату справки о фоновых концентрациях
  Пример в ТЗ: "Справка о фоновых концентрациях ... (выдана ФГБУ «Центральное УГМС» № Э-312/15/05/ Э-574 от 28.02.2022)"
  → Извлеки только: "№ Э-312/15/05/ Э-574 от 28.02.2022"
  Если нет такого пункта → пустая строка

- previousSurveyReport: из п.22.3 ТЗ СКОПИРУЙ ПОЛНОСТЬЮ текст про технический отчет по результатам ИЭИ
  Пример: "Технический отчет по результатам инженерно-экологических изысканий для подготовки проектной документации № 736-00046-52018-19 для объекта: «Строительство...». ООО «РЭИ-Регион», М.:2020."
  Если нет такого пункта → пустая строка

ФОРМАТ ОТВЕТА - СТРОГО JSON:
{
  "objectName": "",
  "objectLocation": "",
  "clientName": "",
  "clientOgrn": "",
  "clientAddress": "",
  "clientContactName": "",
  "clientContactPhone": "",
  "clientContactEmail": "",
  "goalsAndTasks": "",
  "objectPurpose": "",
  "transportInfrastructure": "",
  "hazardousProduction": "",
  "fireHazard": "",
  "responsibilityLevel": "",
  "permanentOccupancy": "",
  "urbanPlanningActivity": "",
  "surveyStage": "",
  "technicalCharacteristics": "",
  "excavationDepth": "",
  "siteDescription": "",
  "siteArea": "",
  "clientDirectorPosition": "",
  "clientDirectorName": "",
  "clientShortName": "",
  "coordinates": null,
  "cadastralNumber": "",
  "backgroundConcentrationsRef": "",
  "previousSurveyReport": ""
}

ПРАВИЛА:
- Если данные не найдены - пустая строка ""
- НЕ выдумывай данные!
- КОПИРУЙ текст из ТЗ ДОСЛОВНО для goalsAndTasks, siteDescription, technicalCharacteristics`;

    const userPrompt = `Извлеки данные из этого ТЗ. ВАЖНО: копируй текст дословно, особенно для goalsAndTasks (п.7), siteDescription (п.11), technicalCharacteristics (п.12).

ТЗ:
${tzText}`;

    try {
      const response = await this.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ]);

      // Парсим JSON из ответа
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('[AiService] Не удалось найти JSON в ответе:', response);
        return this.getEmptySection1Data();
      }

      const parsed = JSON.parse(jsonMatch[0]) as ProgramIeiSection1Data;
      
      // Валидируем и нормализуем данные
      return this.normalizeSection1Data(parsed);
    } catch (error) {
      console.error('[AiService] Ошибка извлечения данных раздела 1:', error);
      return this.getEmptySection1Data();
    }
  }

  /**
   * Классифицирует адрес/местоположение для заполнения пункта 3.1 программы ИЭИ:
   * - Москва / Московская область
   * - район г. Москвы (если применимо)
   * - выбор одного из 4 шаблонных ландшафтов
   */
  async extractProgramIeiSection31(addressText: string): Promise<ProgramIeiSection31Data> {
    const systemPrompt = `Ты эксперт по инженерно-экологическим изысканиям (ИЭИ).
Твоя задача - по входному адресу/местоположению определить данные для пункта 3.1 программы ИЭИ.

ВАЖНО:
- НЕ выдумывай данные.
- Если не уверен - ставь UNKNOWN.
- moscowDistrict заполняй ТОЛЬКО если это г. Москва и район явно указан/однозначно определяется из текста.
- territoryLocationText: сформируй ОДИН абзац, начинающийся с "Территория обследования расположена ...".
  Если адрес относится к Московской области и можно сформулировать — заполни.
  Если это г. Москва — оставь пустую строку "".
  Если регион UNKNOWN — можно заполнить в нейтральном виде "Территория обследования расположена по адресу: ...".

Нужно вернуть СТРОГО JSON:
{
  "regionType": "MOSCOW_CITY" | "MOSCOW_OBLAST" | "UNKNOWN",
  "moscowDistrict": "",
  "territoryLocationText": "",
  "landscape": "HIMKI" | "MOSKVORETSKO_GRAYVORONSKIY" | "MOSKVORETSKO_SKHODNENSKIY" | "TSARITSYNSKIY" | "UNKNOWN"
}

Пояснение по landscape:
- Выбирай ОДНО значение из списка, соответствующее местоположению.
- Если невозможно определить по адресу/местоположению - UNKNOWN.`;

    const userPrompt = `Адрес/местоположение объекта:
${addressText}`;

    try {
      const response = await this.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ]);

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('[AiService] Не удалось найти JSON в ответе (3.1):', response);
        return {
          regionType: 'UNKNOWN',
          moscowDistrict: '',
          territoryLocationText: '',
          landscape: 'UNKNOWN',
        };
      }

      const parsed = JSON.parse(jsonMatch[0]) as Partial<ProgramIeiSection31Data>;

      const allowedRegion = new Set(['MOSCOW_CITY', 'MOSCOW_OBLAST', 'UNKNOWN'] as const);
      const allowedLandscape = new Set([
        'HIMKI',
        'MOSKVORETSKO_GRAYVORONSKIY',
        'MOSKVORETSKO_SKHODNENSKIY',
        'TSARITSYNSKIY',
        'UNKNOWN',
      ] as const);

      const regionType = allowedRegion.has(parsed.regionType as any)
        ? (parsed.regionType as ProgramIeiSection31Data['regionType'])
        : 'UNKNOWN';

      const landscape = allowedLandscape.has(parsed.landscape as any)
        ? (parsed.landscape as ProgramIeiSection31Data['landscape'])
        : 'UNKNOWN';

      const moscowDistrict = String(parsed.moscowDistrict || '').trim();
      const territoryLocationText = String(parsed.territoryLocationText || '').trim();

      return {
        regionType,
        moscowDistrict,
        territoryLocationText,
        landscape,
      };
    } catch (error) {
      console.error('[AiService] Ошибка извлечения данных пункта 3.1:', error);
      return {
        regionType: 'UNKNOWN',
        moscowDistrict: '',
        territoryLocationText: '',
        landscape: 'UNKNOWN',
      };
    }
  }

  /**
   * Извлекает данные для пункта 3.2 программы ИЭИ из текста ТЗ.
   * Используется для автозаполнения (когда пользователь не заполнил вручную).
   */
  async extractProgramIeiSection32(tzText: string): Promise<ProgramIeiSection32Data> {
    const systemPrompt = `Ты эксперт по инженерно-экологическим изысканиям (ИЭИ).
Твоя задача - извлечь данные для пункта 3.2 программы ИЭИ из текста ТЗ.

КРИТИЧЕСКИ ВАЖНО:
- НЕ выдумывай. Если информации нет - оставь поле пустой строкой \"\" и поставь territoryCondition=UNKNOWN.
- Если в ТЗ есть формулировки типа \"К югу/к востоку/к западу/к северу\" - извлеки правую часть (БЕЗ префикса \"К ...:\") и без финальной пунктуации.
- currentLandUse: текст после смысла \"Современное использование территории\" (коротко, 1 фраза).

territoryCondition:
- OPEN_SOIL: если явно указано, что открытый грунт/не запечатано.
- PARTIALLY_SEALED: если указано, что часть запечатана/асфальт/плиты, и работы выполняются в местах открытого грунта.
- OCCUPIED_BY_BUILDING: если территория занята строением/строительной площадкой и нужен ППР.
- RESTRICTED: если режимный объект/нужен допуск/пропускной режим.
- UNKNOWN: если не удаётся определить.

territoryConditionText:
- Верни ОДИН готовый абзац (без пометок \"если ...\"), соответствующий выбранному territoryCondition.
- Если territoryCondition=UNKNOWN - пустая строка \"\".

ФОРМАТ ОТВЕТА - СТРОГО JSON:
{
  \"nearbySouth\": \"\",
  \"nearbyEast\": \"\",
  \"nearbyWest\": \"\",
  \"nearbyNorth\": \"\",
  \"currentLandUse\": \"\",
  \"territoryCondition\": \"OPEN_SOIL\" | \"PARTIALLY_SEALED\" | \"OCCUPIED_BY_BUILDING\" | \"RESTRICTED\" | \"UNKNOWN\",
  \"territoryConditionText\": \"\"
}`;

    const userPrompt = `ТЗ:\n${tzText}`;

    try {
      const response = await this.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ]);

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('[AiService] Не удалось найти JSON в ответе (3.2):', response);
        return {
          nearbySouth: '',
          nearbyEast: '',
          nearbyWest: '',
          nearbyNorth: '',
          currentLandUse: '',
          territoryCondition: 'UNKNOWN',
          territoryConditionText: '',
        };
      }

      const parsed = JSON.parse(jsonMatch[0]) as Partial<ProgramIeiSection32Data>;

      const allowed = new Set([
        'OPEN_SOIL',
        'PARTIALLY_SEALED',
        'OCCUPIED_BY_BUILDING',
        'RESTRICTED',
        'UNKNOWN',
      ] as const);

      const territoryCondition = allowed.has(parsed.territoryCondition as any)
        ? (parsed.territoryCondition as ProgramIeiSection32Data['territoryCondition'])
        : 'UNKNOWN';

      return {
        nearbySouth: String(parsed.nearbySouth || '').trim(),
        nearbyEast: String(parsed.nearbyEast || '').trim(),
        nearbyWest: String(parsed.nearbyWest || '').trim(),
        nearbyNorth: String(parsed.nearbyNorth || '').trim(),
        currentLandUse: String(parsed.currentLandUse || '').trim(),
        territoryCondition,
        territoryConditionText: String(parsed.territoryConditionText || '').trim(),
      };
    } catch (error) {
      console.error('[AiService] Ошибка извлечения данных пункта 3.2:', error);
      return {
        nearbySouth: '',
        nearbyEast: '',
        nearbyWest: '',
        nearbyNorth: '',
        currentLandUse: '',
        territoryCondition: 'UNKNOWN',
        territoryConditionText: '',
      };
    }
  }

  /**
   * Нормализует данные раздела 1
   */
  private normalizeSection1Data(data: Partial<ProgramIeiSection1Data>): ProgramIeiSection1Data {
    // Обработка координат
    let coordinates: { lat: number; lon: number } | null = null;
    if (data.coordinates && typeof data.coordinates === 'object') {
      const lat = Number(data.coordinates.lat);
      const lon = Number(data.coordinates.lon);
      if (!isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0) {
        coordinates = { lat, lon };
      }
    }

    return {
      objectName: String(data.objectName || '').trim(),
      objectLocation: String(data.objectLocation || '').trim(),
      clientName: String(data.clientName || '').trim(),
      clientOgrn: String(data.clientOgrn || '').trim(),
      clientAddress: String(data.clientAddress || '').trim(),
      clientContactName: String(data.clientContactName || '').trim(),
      clientContactPhone: String(data.clientContactPhone || '').trim(),
      clientContactEmail: String(data.clientContactEmail || '').trim(),
      goalsAndTasks: String(data.goalsAndTasks || '').trim(),
      objectPurpose: String(data.objectPurpose || '').trim(),
      transportInfrastructure: String(data.transportInfrastructure || 'Нет').trim(),
      hazardousProduction: String(data.hazardousProduction || 'Нет').trim(),
      fireHazard: String(data.fireHazard || 'Нет данных').trim(),
      responsibilityLevel: String(data.responsibilityLevel || 'Нормальный').trim(),
      permanentOccupancy: String(data.permanentOccupancy || '').trim(),
      urbanPlanningActivity: String(data.urbanPlanningActivity || '').trim(),
      surveyStage: String(data.surveyStage || 'Инженерные изыскания для подготовки проектной документации').trim(),
      technicalCharacteristics: String(data.technicalCharacteristics || '').trim(),
      excavationDepth: String(data.excavationDepth || '').trim(),
      siteDescription: String(data.siteDescription || '').trim(),
      siteArea: String(data.siteArea || '').trim(),
      clientDirectorPosition: String(data.clientDirectorPosition || 'Директор').trim(),
      clientDirectorName: String(data.clientDirectorName || '').trim(),
      clientShortName: String(data.clientShortName || '').trim(),
      coordinates,
      cadastralNumber: String(data.cadastralNumber || '').trim(),
      backgroundConcentrationsRef: String(data.backgroundConcentrationsRef || '').trim(),
      previousSurveyReport: String(data.previousSurveyReport || '').trim(),
    };
  }

  /**
   * Возвращает пустую структуру данных раздела 1
   */
  private getEmptySection1Data(): ProgramIeiSection1Data {
    return {
      objectName: '',
      objectLocation: '',
      clientName: '',
      clientOgrn: '',
      clientAddress: '',
      clientContactName: '',
      clientContactPhone: '',
      clientContactEmail: '',
      goalsAndTasks: '',
      objectPurpose: '',
      transportInfrastructure: 'Нет',
      hazardousProduction: 'Нет',
      fireHazard: 'Нет данных',
      responsibilityLevel: 'Нормальный',
      permanentOccupancy: '',
      urbanPlanningActivity: '',
      surveyStage: 'Инженерные изыскания для подготовки проектной документации',
      technicalCharacteristics: '',
      excavationDepth: '',
      siteDescription: '',
      siteArea: '',
      clientDirectorPosition: 'Директор',
      clientDirectorName: '',
      clientShortName: '',
      coordinates: null,
      cadastralNumber: '',
      backgroundConcentrationsRef: '',
      previousSurveyReport: '',
    };
  }

  /**
   * Получает данные о земельном участке по координатам через OpenStreetMap
   * и кадастровый номер из ТЗ (если передан)
   */
  async getEgrnDataByCoordinates(
    lat: number,
    lon: number,
    cadastralFromTz?: string,
  ): Promise<EgrnData | null> {
    try {
      // Получаем адрес через OpenStreetMap Nominatim
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=ru`;
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Polevie/1.0 (engineering surveys app)',
        },
      });

      if (!response.ok) {
        console.error('[AiService] Ошибка запроса к OpenStreetMap:', response.status);
        return null;
      }

      const data = await response.json() as {
        display_name?: string;
        address?: {
          road?: string;
          village?: string;
          town?: string;
          city?: string;
          suburb?: string;
          state?: string;
          postcode?: string;
          country?: string;
        };
      };

      // Формируем адрес из компонентов
      const addr = data.address || {};
      const addressParts: string[] = [];
      if (addr.state) addressParts.push(addr.state);
      if (addr.city || addr.town) addressParts.push(addr.city || addr.town || '');
      if (addr.suburb) addressParts.push(addr.suburb);
      if (addr.village) addressParts.push(addr.village);
      if (addr.road) addressParts.push(addr.road);

      const result: EgrnData = {
        cadastralNumber: cadastralFromTz || '',
        category: 'Земли населённых пунктов', // По умолчанию для городских участков
        permittedUse: '',
        address: addressParts.join(', ') || data.display_name || '',
        area: 0,
        status: '',
      };

      console.log('[AiService] Получены данные по координатам:', result);
      return result;
    } catch (error) {
      console.error('[AiService] Ошибка получения данных по координатам:', error);
      return null;
    }
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

4. НОМЕРА ПЛОЩАДОК В СКОБКАХ — слой может иметь указание номеров площадок в скобках:
   - "В слое 0,0-0,2 (1,2,3,4,5)" — слой есть у площадок 1,2,3,4,5
   - "В слое 0,5-1,0 (1,4,5)" — слой есть только у площадок 1, 4, 5
   - "В слое 2,0-3,0 (4)" — слой есть только у площадки 4
   Если номера в скобках есть, добавь поле "platformNumbers": [1,4,5]
   Количество проб (count) = количество чисел в скобках

5. Микробиология — ищи упоминания "микробиологическ", "паразитологич", "санитарно-бактериол"
   - Обычно указано общее количество проб

Отвечай СТРОГО в формате JSON:
{
  "soil": {
    "layers": [
      {"depthFrom": 0.0, "depthTo": 0.2, "label": "0,0-0,2", "count": 5, "isPP": true, "platformNumbers": [1,2,3,4,5]},
      {"depthFrom": 0.2, "depthTo": 0.5, "label": "0,2-0,5", "count": 5, "isPP": false, "platformNumbers": [1,2,3,4,5]},
      {"depthFrom": 0.5, "depthTo": 1.0, "label": "0,5-1,0", "count": 3, "isPP": false, "platformNumbers": [1,4,5]},
      {"depthFrom": 1.0, "depthTo": 2.0, "label": "1,0-2,0", "count": 2, "isPP": false, "platformNumbers": [4,5]},
      {"depthFrom": 2.0, "depthTo": 3.0, "label": "2,0-3,0", "count": 1, "isPP": false, "platformNumbers": [4]}
    ],
    "totalCount": 16
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

Если у слоя нет номеров в скобках — не добавляй поле platformNumbers вообще.
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
    const result: AiSamplingLayer = {
      depthFrom: Number(layer.depthFrom) || 0,
      depthTo: Number(layer.depthTo) || 0,
      label: String(layer.label || ''),
      count: Number(layer.count) || 0,
      isPP: Boolean(layer.isPP),
    };
    
    // Добавляем platformNumbers если есть
    if (Array.isArray(layer.platformNumbers) && layer.platformNumbers.length > 0) {
      result.platformNumbers = layer.platformNumbers.map((n: any) => Number(n)).filter((n: number) => n > 0);
    }
    
    return result;
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
  platformNumbers?: number[]; // номера площадок, у которых есть этот слой (например [1,4,5] если указано "(1,4,5)")
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

/**
 * Данные раздела 1 "Общие сведения" программы ИЭИ
 * Все поля соответствуют пунктам ТЗ и программы
 */
export interface ProgramIeiSection1Data {
  // 1.1 Наименование объекта (ТЗ п.1)
  objectName: string;
  
  // 1.2 Местоположение объекта (ТЗ п.2)
  objectLocation: string;
  
  // 1.3.1 Наименование и местонахождение заказчика (ТЗ п.5.1)
  clientName: string;           // ООО «КАРАТ-91»
  clientOgrn: string;           // ОГРН 1027739580406
  clientAddress: string;        // 125040, г.Москва, Ленинградский пр-кт, д.11
  
  // 1.3.2 ФИО, телефон, email представителя заказчика (ТЗ п.5.2)
  clientContactName: string;    // Лучников Юрий Владимирович
  clientContactPhone: string;   // +79166567815
  clientContactEmail: string;   // karat91@inbox.ru
  
  // 1.5 Цели и задачи инженерных изысканий (ТЗ п.7 - ПОЛНОСТЬЮ)
  goalsAndTasks: string;
  
  // 1.6.1 Назначение (ТЗ п.10.1)
  objectPurpose: string;        // Образовательное учреждение
  
  // 1.6.2 Принадлежность к объектам транспортной инфраструктуры (ТЗ п.10.2)
  transportInfrastructure: string;  // Нет
  
  // 1.6.3 Принадлежность к опасным производственным объектам (ТЗ п.10.3)
  hazardousProduction: string;  // Нет
  
  // 1.6.4 Пожарная и взрывопожарная опасность (ТЗ п.10.4)
  fireHazard: string;           // Нет данных
  
  // 1.6.5 Уровень ответственности зданий и сооружений (ТЗ п.10.5)
  responsibilityLevel: string;  // Нормальный
  
  // 1.6.6 Наличие помещений с постоянным нахождением людей (ТЗ п.10.6)
  permanentOccupancy: string;   // Предусмотрено / Отсутствуют
  
  // 1.7 Вид градостроительной деятельности (ТЗ п.4)
  urbanPlanningActivity: string;  // Архитектурно-строительное проектирование
  
  // 1.8 Этап выполнения инженерных изысканий (ТЗ п.8)
  surveyStage: string;          // Инженерные изыскания для подготовки проектной документации
  
  // 1.9.1 Краткая техническая характеристика объекта (ТЗ п.12)
  technicalCharacteristics: string;
  
  // 1.9.2 Глубина ведения земляных работ (извлечь из ТЗ п.12)
  excavationDepth: string;      // до 5,0 м
  
  // 1.9.3 Границы площадки / территория обследования (ТЗ п.11)
  siteDescription: string;      // Территория обследования расположена в...
  siteArea: string;             // Площадь участка – около 0,77 га
  
  // Для титульной страницы - данные заказчика для согласования
  clientDirectorPosition: string;  // Директор
  clientDirectorName: string;      // Лучников В.М. (короткое ФИО)
  clientShortName: string;         // КАРАТ-91 (без ООО и кавычек)
  
  // Координаты участка из ТЗ (для запроса данных ЕГРН)
  coordinates: { lat: number; lon: number } | null;
  
  // Кадастровый номер участка (если есть в ТЗ)
  cadastralNumber: string;
  
  // 2.1 Перечень исходных материалов и данных
  // п.22.5 ТЗ - номер и дата справки о фоновых концентрациях (например: "№ Э-312/15/05/ Э-574 от 28.02.2022")
  backgroundConcentrationsRef: string;
  // п.22.3 ТЗ - технический отчет по результатам ИЭИ (полный текст)
  previousSurveyReport: string;
}

/**
 * Данные для пункта 3.1 "Краткая физико-географическая характеристика района работ"
 * (классификация по адресу/местоположению).
 */
export interface ProgramIeiSection31Data {
  regionType: 'MOSCOW_CITY' | 'MOSCOW_OBLAST' | 'UNKNOWN';
  // Район г. Москвы (например: "Нагатино-Садовники"). Заполняем только если regionType = MOSCOW_CITY и район явно указан/определён.
  moscowDistrict: string;
  // Абзац формата: "Территория обследования расположена ...". Нужен для 3.1 (обычно для МО).
  territoryLocationText: string;
  // Выбор одного из шаблонных ландшафтов (для удаления остальных вариантов в документе)
  landscape:
    | 'HIMKI'
    | 'MOSKVORETSKO_GRAYVORONSKIY'
    | 'MOSKVORETSKO_SKHODNENSKIY'
    | 'TSARITSYNSKIY'
    | 'UNKNOWN';
}

/**
 * Данные для пункта 3.2 "Краткая характеристика природных условий..."
 */
export interface ProgramIeiSection32Data {
  nearbySouth: string;
  nearbyEast: string;
  nearbyWest: string;
  nearbyNorth: string;
  currentLandUse: string;
  territoryCondition:
    | 'OPEN_SOIL'
    | 'PARTIALLY_SEALED'
    | 'OCCUPIED_BY_BUILDING'
    | 'RESTRICTED'
    | 'UNKNOWN';
  territoryConditionText: string;
}

/**
 * Данные из ЕГРН для пункта 1.10 программы ИЭИ
 */
export interface EgrnData {
  cadastralNumber: string;        // Кадастровый номер (77:06:0009005:10)
  category: string;               // Категория земель (Земли населённых пунктов)
  permittedUse: string;           // Разрешённое использование
  address: string;                // Адрес участка
  area: number;                   // Площадь в кв.м
  status: string;                 // Статус (Учтённый)
}

