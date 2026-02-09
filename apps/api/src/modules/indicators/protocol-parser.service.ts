import { Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';

export interface ProtocolMetadata {
  protocolNumber: string | null;
  samplingDate: Date | null;
  testingDateFrom: Date | null;
  testingDateTo: Date | null;
  sampleCount: number;
}

export interface ChemistryIndicator {
  name: string;
  value: string | number;
  uncertainty: string | null;
  unit: string;
}

export interface RadiationIndicator {
  name: string;
  value: string | number;
  unit: string;
}

export interface ParsedSample {
  cipher: string;
  chemistry: ChemistryIndicator[];
  radiation: RadiationIndicator[];
}

export interface ParsedProtocol {
  metadata: ProtocolMetadata;
  samples: ParsedSample[];
}

@Injectable()
export class ProtocolParserService {
  /**
   * Парсинг Excel-файла протокола лабораторных исследований
   */
  parseProtocol(filePath: string): ParsedProtocol {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
    }) as unknown[][];

    const metadata = this.extractMetadata(data);
    const samples = this.extractSamples(data);

    return { metadata, samples };
  }

  /**
   * Извлечение метаданных протокола
   */
  private extractMetadata(data: unknown[][]): ProtocolMetadata {
    let protocolNumber: string | null = null;
    let samplingDate: Date | null = null;
    let testingDateFrom: Date | null = null;
    let testingDateTo: Date | null = null;
    let sampleCount = 0;

    for (let i = 0; i < Math.min(50, data.length); i++) {
      const row = data[i];
      if (!Array.isArray(row)) continue;

      const cell = String(row[0] || '');

      // Номер протокола: "Протокол № 1853П-25"
      const protocolMatch = cell.match(/Протокол\s*№\s*([^\s]+)/i);
      if (protocolMatch) {
        protocolNumber = protocolMatch[1];
      }

      // Дата отбора: "Дата отбора образцов: 09.09.2025.*"
      const samplingMatch = cell.match(
        /Дата отбора образцов:\s*(\d{2}\.\d{2}\.\d{4})/i,
      );
      if (samplingMatch) {
        samplingDate = this.parseDate(samplingMatch[1]);
      }

      // Дата проведения испытаний: "Дата проведения испытаний: 09.09.2025-30.09.2025."
      const testingMatch = cell.match(
        /Дата проведения испытаний:\s*(\d{2}\.\d{2}\.\d{4})-(\d{2}\.\d{2}\.\d{4})/i,
      );
      if (testingMatch) {
        testingDateFrom = this.parseDate(testingMatch[1]);
        testingDateTo = this.parseDate(testingMatch[2]);
      }

      // Количество образцов: "Количество образцов:15.*"
      const countMatch = cell.match(/Количество образцов:\s*(\d+)/i);
      if (countMatch) {
        sampleCount = parseInt(countMatch[1], 10);
      }
    }

    return {
      protocolNumber,
      samplingDate,
      testingDateFrom,
      testingDateTo,
      sampleCount,
    };
  }

  /**
   * Извлечение показателей по пробам
   */
  private extractSamples(data: unknown[][]): ParsedSample[] {
    const samples: ParsedSample[] = [];
    let currentSample: ParsedSample | null = null;
    let inChemistry = false;
    let inRadiation = false;

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (!Array.isArray(row)) continue;

      const cell0 = String(row[0] || '').trim();

      // Начало нового образца: "Наименование испытательного образца: 01АХ.01"
      const sampleMatch = cell0.match(
        /Наименование испытательного образца:\s*(.+)/i,
      );
      if (sampleMatch) {
        // Сохраняем предыдущий образец
        if (currentSample) {
          samples.push(currentSample);
        }
        currentSample = {
          cipher: sampleMatch[1].trim(),
          chemistry: [],
          radiation: [],
        };
        inChemistry = false;
        inRadiation = false;
        continue;
      }

      if (!currentSample) continue;

      // Определяем раздел
      if (cell0.toLowerCase().includes('химические исследования')) {
        inChemistry = true;
        inRadiation = false;
        continue;
      }
      if (cell0.toLowerCase().includes('радиационные исследования')) {
        inChemistry = false;
        inRadiation = true;
        continue;
      }

      // Пропускаем заголовки и служебные строки
      if (
        cell0 === '' ||
        cell0 === '1' ||
        cell0.startsWith('Определяемый показатель') ||
        cell0.startsWith('²') ||
        cell0.startsWith('¹')
      ) {
        continue;
      }

      // Парсим показатели
      // Колонки: 0 - показатель, 3 - результат, 4 - неопределённость, 7 - единица измерения
      const indicatorName = cell0;
      const value = row[3];
      const uncertainty = row[4];
      const unit = String(row[7] || '').trim();

      // Проверяем что это действительно показатель (есть единица измерения)
      if (!unit || unit === '' || indicatorName.length > 100) {
        continue;
      }

      if (inChemistry) {
        currentSample.chemistry.push({
          name: indicatorName,
          value: this.parseValue(value),
          uncertainty: this.parseUncertainty(uncertainty),
          unit,
        });
      } else if (inRadiation) {
        currentSample.radiation.push({
          name: indicatorName,
          value: this.parseValue(value),
          unit,
        });
      }
    }

    // Добавляем последний образец
    if (currentSample) {
      samples.push(currentSample);
    }

    return samples;
  }

  /**
   * Парсинг значения (может быть числом или строкой типа "менее 3")
   */
  private parseValue(value: unknown): string | number {
    if (typeof value === 'number') {
      return value;
    }
    const strValue = String(value || '').trim();
    const numValue = parseFloat(strValue.replace(',', '.'));
    if (!isNaN(numValue) && isFinite(numValue)) {
      return numValue;
    }
    return strValue;
  }

  /**
   * Парсинг неопределённости (± 0.1 -> 0.1)
   */
  private parseUncertainty(value: unknown): string | null {
    const strValue = String(value || '').trim();
    if (strValue === '---' || strValue === '') {
      return null;
    }
    // Убираем "±" и пробелы
    return strValue.replace(/[±\s]/g, '') || null;
  }

  /**
   * Парсинг даты формата "09.09.2025"
   */
  private parseDate(dateStr: string): Date | null {
    const parts = dateStr.split('.');
    if (parts.length !== 3) return null;
    const [day, month, year] = parts.map((p) => parseInt(p, 10));
    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
    return new Date(year, month - 1, day);
  }
}
