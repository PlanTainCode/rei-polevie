import { Injectable } from '@nestjs/common';
import * as mammoth from 'mammoth';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { AiService, AiSamplingData } from '../ai/ai.service';

export interface SamplingLayer {
  depthFrom: number;
  depthTo: number;
  label: string; // "0,0-0,2"
  count: number;
  isPP: boolean; // true если это слой 0,0-0,2 (пробная площадка)
  platformNumbers?: number[]; // номера площадок, у которых есть этот слой (например [1,2,3,4,5] или [4,5])
}

// Данные отбора проб по типам
export interface SamplingData {
  // Почва/грунт (ПГ) — основные слои
  soilLayers: SamplingLayer[];
  // Донные отложения (ДО)
  sedimentLayers: SamplingLayer[];
  sedimentCount: number;
  // Вода
  waterLayers: SamplingLayer[];
  waterCount: number;
}

export interface ParsedDocumentInfo {
  rawText: string;
  paragraphs: string[];
  tables: string[][];
  // Извлечённые данные (можно расширять)
  extractedData: {
    clientName?: string;
    objectName?: string;
    address?: string;
    sampleCount?: number;
    depth?: string;
    dates?: string[];
    numbers?: string[];
    // Новые поля для проб
    samplingLayers?: SamplingLayer[];
    samplingData?: SamplingData; // Расширенные данные по типам
    aiSamplingData?: AiSamplingData; // Данные от AI
    microbiologyCount?: number; // Кол-во микробиологических проб (для определения кол-ва ПП/СК)
    contractNumber?: string; // Номер договора (801-110-25)
    // Координаты из ТЗ (таблица "№ точки ... широта, долгота")
    coordinates?: { lat: string; lon: string };
  };
}

@Injectable()
export class WordParserService {
  constructor(private aiService: AiService) {}

  async parseDocument(fileUrl: string): Promise<ParsedDocumentInfo> {
    const filePath = join(process.cwd(), 'uploads', fileUrl);
    const buffer = await readFile(filePath);

    // Извлекаем текст
    const textResult = await mammoth.extractRawText({ buffer });
    const rawText = textResult.value;

    // Извлекаем HTML для анализа структуры
    const htmlResult = await mammoth.convertToHtml({ buffer });
    const html = htmlResult.value;

    // Разбиваем на параграфы
    const paragraphs = rawText
      .split('\n')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    // Пытаемся извлечь таблицы из HTML
    const tables = this.extractTablesFromHtml(html);

    // Извлекаем структурированные данные (передаём таблицы для поиска заказчика)
    const extractedData = await this.extractData(rawText, paragraphs, tables);

    return {
      rawText,
      paragraphs,
      tables,
      extractedData,
    };
  }

  private extractTablesFromHtml(html: string): string[][] {
    const tables: string[][] = [];
    const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;

    let tableMatch;
    while ((tableMatch = tableRegex.exec(html)) !== null) {
      const tableHtml = tableMatch[1];
      let rowMatch;

      while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
        const rowHtml = rowMatch[1];
        const row: string[] = [];
        let cellMatch;

        while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
          // Убираем HTML теги из содержимого ячейки
          const cellContent = cellMatch[1].replace(/<[^>]*>/g, '').trim();
          row.push(cellContent);
        }

        if (row.length > 0) {
          tables.push(row);
        }
      }
    }

    return tables;
  }

  private async extractData(
    rawText: string,
    paragraphs: string[],
    tables: string[][],
  ): Promise<ParsedDocumentInfo['extractedData']> {
    const data: ParsedDocumentInfo['extractedData'] = {};

    // Ищем название клиента/заказчика
    // Приоритет 1: из таблицы поручения (строка "Заказчик" -> вторая ячейка)
    data.clientName = this.extractClientFromTableRows(tables);
    
    // Приоритет 2: из текста по паттернам
    if (!data.clientName) {
      data.clientName = this.extractClientFromText(rawText);
    }

    // Ищем название объекта
    const objectPatterns = [
      /(?:объект|наименование объекта)[:\s]+([^\n]+)/i,
      /(?:на объекте)[:\s]+([^\n]+)/i,
    ];
    for (const pattern of objectPatterns) {
      const match = rawText.match(pattern);
      if (match) {
        data.objectName = match[1].trim();
        break;
      }
    }

    // Ищем адрес / местоположение объекта
    // 1) Паттерны в самих параграфах: "Местоположение объекта: ...", "Адрес объекта: ..."
    for (const p of paragraphs) {
      const m =
        p.match(/^(?:местоположение\s+объекта|адрес\s+объекта)\s*[:\-–]\s*(.+)$/i) ||
        p.match(/^(?:адрес|местоположение)\s*[:\-–]\s*(.+)$/i);
      if (m?.[1]) {
        data.address = m[1].trim();
        break;
      }
    }

    // 2) Формат ТЗ: строка-заголовок "Местоположение объекта" → следующая строка содержит адрес
    if (!data.address) {
      const idx = paragraphs.findIndex((p) =>
        /^(?:местоположение\s+объекта|адрес\s+объекта)\s*$/i.test(p),
      );
      if (idx >= 0) {
        for (let j = idx + 1; j < Math.min(paragraphs.length, idx + 4); j += 1) {
          const cand = String(paragraphs[j] || '').trim();
          if (!cand) continue;
          if (
            /(?:г\.|город|москва|область|р-н|район|ул\.|улица|пр-кт|проспект|ш\.|шоссе|д\.|дом|км|тер\.|территория)/i.test(cand)
          ) {
            data.address = cand;
            break;
          }
        }
      }
    }

    // 3) Фоллбэк по сырым паттернам в тексте
    if (!data.address) {
    const addressPatterns = [
        /(?:адрес|местоположение)\s*[:\s]+([^\n]+)/i,
      /(?:г\.|город)\s+[^\n]+/i,
    ];
    for (const pattern of addressPatterns) {
      const match = rawText.match(pattern);
      if (match) {
          data.address = (match[1] || match[0]).trim();
        break;
        }
      }
    }

    // Ищем координаты (в том числе в таблице в конце ТЗ)
    data.coordinates = this.extractFirstCoordinatesPair(rawText) || undefined;

    // Ищем количество проб
    const samplePatterns = [
      /(\d+)\s*(?:проб|образц)/i,
      /(?:количество проб|кол-во проб)[:\s]+(\d+)/i,
    ];
    for (const pattern of samplePatterns) {
      const match = rawText.match(pattern);
      if (match) {
        data.sampleCount = parseInt(match[1], 10);
        break;
      }
    }

    // Ищем глубину
    const depthPatterns = [
      /(?:глубина|глубин)[:\s]+([^\n]+)/i,
      /(\d+(?:[.,]\d+)?)\s*(?:м|метр)/i,
    ];
    for (const pattern of depthPatterns) {
      const match = rawText.match(pattern);
      if (match) {
        data.depth = match[1] || match[0];
        break;
      }
    }

    // Извлекаем все даты
    const datePattern = /\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/g;
    const dates = rawText.match(datePattern);
    if (dates) {
      data.dates = [...new Set(dates)];
    }

    // Извлекаем номера (договоров, приказов и т.д.)
    const numberPatterns = [
      /№\s*(\d+[\w/-]*)/g,
      /(?:договор|приказ|поручение)\s*(?:№|номер)?\s*(\d+[\w/-]*)/gi,
    ];
    const numbers: string[] = [];
    for (const pattern of numberPatterns) {
      let match;
      while ((match = pattern.exec(rawText)) !== null) {
        numbers.push(match[1]);
      }
    }
    if (numbers.length > 0) {
      data.numbers = [...new Set(numbers)];
    }

    // Извлекаем номер договора (формат 801-110-25)
    const contractPattern = /(?:договор\s*(?:№|номер)?:?\s*)(\d{3}-\d{2,4}-\d{2})/i;
    const contractMatch = rawText.match(contractPattern);
    if (contractMatch) {
      data.contractNumber = contractMatch[1];
    }

    // Извлекаем слои отбора проб через AI
    const aiSamplingData = await this.aiService.extractSamplingLayers(rawText);
    data.aiSamplingData = aiSamplingData;

    // Конвертируем AI данные в старый формат для совместимости
    data.samplingData = {
      soilLayers: aiSamplingData.soil.layers,
      sedimentLayers: aiSamplingData.sediment.layers,
      sedimentCount: aiSamplingData.sediment.totalCount,
      waterLayers: aiSamplingData.water.layers,
      waterCount: aiSamplingData.water.totalCount,
    };
    
    // Для обратной совместимости: samplingLayers = soilLayers
    data.samplingLayers = data.samplingData.soilLayers;

    // Микробиология из AI
    data.microbiologyCount = aiSamplingData.microbiology.count;

    return data;
  }

  /**
   * Извлекает данные о слоях из таблиц "Отбор проб ПГ", "Отбор проб ДО", "Отбор проб Вода"
   * 
   * Структура таблицы:
   * - Заголовок секции (Отбор проб ПГ / ДО / Вода)
   * - Строки слоёв: "В слое 0,0-0,2", "В слое 0,2-0,5"...
   * - Слово "проб"
   * - Прочерки "-" (могут быть)
   * - Числа — количество проб для каждого слоя (в том же порядке что слои)
   */
  private extractSamplingDataFromTables(
    rawText: string,
    tables: string[][],
  ): SamplingData {
    const result: SamplingData = {
      soilLayers: [],
      sedimentLayers: [],
      sedimentCount: 0,
      waterLayers: [],
      waterCount: 0,
    };

    // Разбиваем текст на строки для построчного анализа
    const lines = rawText.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    
    // Типы секций
    type SectionType = 'soil' | 'sediment' | 'water' | null;
    let currentSection: SectionType = null;
    let currentLayers: { label: string; depthFrom: number; depthTo: number; isPP: boolean }[] = [];
    let currentCounts: number[] = [];
    let passedProbsMarker = false; // Прошли ли маркер "проб"

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      const originalLine = lines[i];

      // Определяем секцию по заголовку таблицы
      // Сначала проверяем конкретные типы (ПГ, ДО, Вода), потом общую секцию "Отбор проб"
      if (line.includes('отбор проб пг') || line.includes('отбор проб почв') || line.includes('почвы (грунт')) {
        // Сохраняем предыдущую секцию если была
        this.saveSectionData(currentSection, currentLayers, currentCounts, result);
        currentSection = 'soil';
        currentLayers = [];
        currentCounts = [];
        passedProbsMarker = false;
        continue;
      }
      
      if (line.includes('отбор проб до') || (line.includes('донн') && line.includes('отложен'))) {
        this.saveSectionData(currentSection, currentLayers, currentCounts, result);
        currentSection = 'sediment';
        currentLayers = [];
        currentCounts = [];
        passedProbsMarker = false;
        continue;
      }
      
      if (line.includes('отбор проб вод') || (line.includes('вода') && line.includes('отбор'))) {
        this.saveSectionData(currentSection, currentLayers, currentCounts, result);
        currentSection = 'water';
        currentLayers = [];
        currentCounts = [];
        passedProbsMarker = false;
        continue;
      }

      // Общая секция "Отбор проб" (без уточнения) — считаем как почву
      if (
        (line === 'отбор проб' || line.match(/^отбор проб\s*$/)) &&
        currentSection === null
      ) {
        this.saveSectionData(currentSection, currentLayers, currentCounts, result);
        currentSection = 'soil';
        currentLayers = [];
        currentCounts = [];
        passedProbsMarker = false;
        continue;
      }

      // Выход из секции при определённых маркерах
      if (
        line.includes('наименование экспертизы') ||
        line.includes('директор') ||
        line.includes('примечание')
      ) {
        this.saveSectionData(currentSection, currentLayers, currentCounts, result);
        currentSection = null;
        passedProbsMarker = false;
        continue;
      }

      // Если мы в секции, парсим данные
      if (currentSection) {
        // Маркер "проб" — после него идут прочерки и числа
        if (line === 'проб' || line === 'проб.' || line.match(/^проб\s*$/)) {
          passedProbsMarker = true;
          continue;
        }

        // Пропускаем прочерки
        if (line === '-' || line === '–') {
          continue;
        }

        // Паттерн слоя: "В слое 0,0-0,2" (до маркера "проб")
        if (!passedProbsMarker) {
          const layerMatch = originalLine.match(
            /(?:[Вв]\s*слое\s*)?(\d+[,.]?\d*)\s*[-–]\s*(\d+[,.]?\d*)/
          );
          
          if (layerMatch) {
            const depthFrom = parseFloat(layerMatch[1].replace(',', '.'));
            const depthTo = parseFloat(layerMatch[2].replace(',', '.'));
            const label = `${layerMatch[1].replace('.', ',')}-${layerMatch[2].replace('.', ',')}`;
            const isPP = depthFrom === 0 && depthTo <= 0.2;
            
            currentLayers.push({ label, depthFrom, depthTo, isPP });
          }
        }

        // Ищем числа (количество проб) — после маркера "проб" и прочерков
        // Берём только первые N чисел, где N = кол-во слоёв
        if (passedProbsMarker && currentCounts.length < currentLayers.length) {
          const numMatch = originalLine.match(/^(\d+)$/);
          if (numMatch) {
            currentCounts.push(parseInt(numMatch[1], 10));
          }
        }
      }
    }

    // Сохраняем последнюю секцию
    this.saveSectionData(currentSection, currentLayers, currentCounts, result);

    // Если почвенные слои не найдены через секции, пробуем старый метод
    if (result.soilLayers.length === 0) {
      result.soilLayers = this.extractSamplingLayersLegacy(rawText);
    }

    return result;
  }

  /**
   * Сохраняет данные секции в результат
   */
  private saveSectionData(
    section: 'soil' | 'sediment' | 'water' | null,
    layers: { label: string; depthFrom: number; depthTo: number; isPP: boolean }[],
    counts: number[],
    result: SamplingData,
  ): void {
    if (!section || layers.length === 0) return;

    // Присваиваем количество слоям (числа идут в том же порядке что и слои)
    const samplingLayers: SamplingLayer[] = layers.map((layer, i) => ({
      ...layer,
      count: counts[i] || 0,
    }));

    if (section === 'soil') {
      result.soilLayers = samplingLayers;
    } else if (section === 'sediment') {
      result.sedimentLayers = samplingLayers;
      result.sedimentCount = samplingLayers.reduce((sum, l) => sum + l.count, 0);
    } else if (section === 'water') {
      result.waterLayers = samplingLayers;
      result.waterCount = samplingLayers.reduce((sum, l) => sum + l.count, 0);
    }
  }

  /**
   * Старый метод извлечения слоёв (резервный)
   */
  private extractSamplingLayersLegacy(rawText: string): SamplingLayer[] {
    const layers: SamplingLayer[] = [];
    const layerPattern = /[Вв]\s*слое\s*(\d+[,.]?\d*)\s*[-–]\s*(\d+[,.]?\d*)/g;

    let match;
    while ((match = layerPattern.exec(rawText)) !== null) {
      const depthFrom = parseFloat(match[1].replace(',', '.'));
      const depthTo = parseFloat(match[2].replace(',', '.'));
      const label = `${match[1].replace('.', ',')}-${match[2].replace('.', ',')}`;
      const isPP = depthFrom === 0 && depthTo <= 0.2;

      layers.push({ depthFrom, depthTo, label, count: 0, isPP });
    }

    // Ищем количество
    const lines = rawText.split('\n').map((l) => l.trim());
    let inSamplingSection = false;
    const counts: number[] = [];

    for (const line of lines) {
      if (line.toLowerCase().includes('отбор проб')) {
        inSamplingSection = true;
        continue;
      }
      if (inSamplingSection) {
        const numMatch = line.match(/^(\d+)$/);
        if (numMatch) {
          counts.push(parseInt(numMatch[1], 10));
        }
        if (line.toLowerCase().includes('наименование экспертизы')) {
          break;
        }
      }
    }

    const relevantCounts = counts.slice(-layers.length);
    for (let i = 0; i < layers.length && i < relevantCounts.length; i++) {
      layers[i].count = relevantCounts[i];
    }

    return layers;
  }

  /**
   * Извлекает количество микробиологических проб
   * (по нему определяется количество ПП и СК)
   */
  private extractMicrobiologyCount(rawText: string): number | undefined {
    // Ищем строку с микробиологией/эпидемической опасностью
    const patterns = [
      /(?:биологическ|микробиолог|эпидемическ)[^\n]*?(\d+)\s*$/gim,
      /(?:БГКП|энтерококк|сальмонелл|гельминт)[^\n]*?(\d+)\s*$/gim,
      /(?:индекс\s+БГКП)[^\n]*?(\d+)/gi,
    ];

    for (const pattern of patterns) {
      const matches = [...rawText.matchAll(pattern)];
      if (matches.length > 0) {
        // Берём последнее совпадение (обычно это количество в таблице)
        const lastMatch = matches[matches.length - 1];
        return parseInt(lastMatch[1], 10);
      }
    }

    return undefined;
  }

  /**
   * Извлекает заказчика из строк таблицы
   * Приоритет: "Наименование и местонахождение заказчика" (секция 5.1)
   * Исключаем блоки СОГЛАСОВАНО
   */
  private extractClientFromTableRows(tables: string[][]): string | undefined {
    // Приоритет 1: ищем "Наименование и местонахождение заказчика" (секция 5.1 ТЗ)
    for (const row of tables) {
      if (row.length >= 2) {
        const header = row[0].toLowerCase();
        if (header.includes('наименование') && header.includes('местонахождение') && header.includes('заказчик')) {
          const client = row[1].trim();
          if (client.length > 2) {
            return client;
          }
        }
      }
    }

    // Приоритет 2: ищем просто "Заказчик", но исключаем СОГЛАСОВАНО
    for (const row of tables) {
      if (row.length >= 2 && row[0].toLowerCase().includes('заказчик')) {
        // Пропускаем строки с СОГЛАСОВАНО или подписями
        const rowText = row.join(' ').toLowerCase();
        if (rowText.includes('согласовано') || rowText.includes('___') || rowText.includes('исполнитель')) {
          continue;
        }
        const client = row[1].trim();
        if (client.length > 2) {
          return client;
        }
      }
    }
    return undefined;
  }

  /**
   * Извлекает заказчика из текста по паттернам (резервный вариант)
   * Исключаем блоки СОГЛАСОВАНО
   */
  private extractClientFromText(rawText: string): string | undefined {
    // Сначала пробуем найти секцию 5.1 с "Наименование и местонахождение заказчика"
    const section51Match = rawText.match(
      /(?:5\.1|Наименование и местонахождение заказчика)[^\n]*\n+([^\n]+(?:ООО|АО|ЗАО|ПАО|ИП)[^\n]+)/i
    );
    if (section51Match?.[1]) {
      const client = section51Match[1].trim().replace(/\s+/g, ' ');
      if (client.length > 3 && !client.toLowerCase().includes('согласовано')) {
        return client;
      }
    }

    const patterns = [
      // "Заказчик: ООО «Название»"
      /Заказчик[:\s]*((?:ООО|АО|ЗАО|ПАО|ИП)\s*[«"]?[^»"\n]+)/gi,
      // Заказчик с кавычками
      /Заказчик[:\s]*[«"]([^»"]+)[»"]/gi,
    ];

    for (const pattern of patterns) {
      // Используем matchAll чтобы найти все совпадения и выбрать подходящее
      const matches = [...rawText.matchAll(pattern)];
      for (const match of matches) {
        if (match && match[1]) {
          let client = match[1].trim();
          client = client.replace(/\s+/g, ' ').trim();
          // Пропускаем если это из блока СОГЛАСОВАНО
          if (client.length > 3 && !client.toLowerCase().includes('согласовано')) {
            // Проверяем контекст — не находится ли это рядом с СОГЛАСОВАНО
            const matchIndex = match.index || 0;
            const contextBefore = rawText.substring(Math.max(0, matchIndex - 100), matchIndex);
            if (!contextBefore.toLowerCase().includes('согласовано')) {
              return client;
            }
          }
        }
      }
    }
    return undefined;
  }

  private extractFirstCoordinatesPair(rawText: string): { lat: string; lon: string } | null {
    const text = String(rawText || '');
    const toNum = (s: string) => Number(String(s).replace(',', '.'));

    const isLat = (n: number) => Number.isFinite(n) && n >= 40 && n <= 70;
    const isLon = (n: number) => Number.isFinite(n) && n >= 20 && n <= 60;

    // Табличный формат: "№ точки <tab/space> 55.xxxxx, 37.xxxxx"
    {
      const re = /(?:^|\n)\s*\d+\s+(\d{2}[.,]\d{3,})\s*,\s*(\d{2}[.,]\d{3,})/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        const lat = toNum(m[1]);
        const lon = toNum(m[2]);
        if (isLat(lat) && isLon(lon)) return { lat: String(lat), lon: String(lon) };
      }
    }

    // Координаты рядом
    {
      const re = /(?<!\d)(\d{2}[.,]\d{3,})(?:\s*[,;]\s*|\s+)(\d{2}[.,]\d{3,})(?!\d)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        const a = toNum(m[1]);
        const b = toNum(m[2]);
        if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
        if (isLat(a) && isLon(b)) return { lat: String(a), lon: String(b) };
        if (isLon(a) && isLat(b)) return { lat: String(b), lon: String(a) };
      }
    }

    return null;
  }
}

