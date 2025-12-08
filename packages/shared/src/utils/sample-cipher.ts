import type { PlatformType, SampleType } from '../types/sample';

interface CipherParams {
  orderNumber: string;
  platformType: PlatformType;
  platformNumber: number;
  sampleNumber: number;
  sampleType: SampleType;
  year?: number;
}

/**
 * Генерация шифра пробы
 * Формат: {Год}-{НомерПриказа}-{ТипПлощадки}{НомерПлощадки}-{НомерПробы}
 * Пример: 2024-001-ПП1-01
 */
export function generateSampleCipher(params: CipherParams): string {
  const {
    orderNumber,
    platformType,
    platformNumber,
    sampleNumber,
    year = new Date().getFullYear(),
  } = params;

  const platformPrefix = platformType === 'PP' ? 'ПП' : 'СК';
  const paddedSampleNumber = String(sampleNumber).padStart(2, '0');

  return `${year}-${orderNumber}-${platformPrefix}${platformNumber}-${paddedSampleNumber}`;
}

/**
 * Парсинг шифра пробы
 */
export function parseSampleCipher(cipher: string): CipherParams | null {
  const regex = /^(\d{4})-(.+)-(ПП|СК)(\d+)-(\d+)$/;
  const match = cipher.match(regex);

  if (!match) return null;

  const [, yearStr, orderNumber, platformTypeRu, platformNumStr, sampleNumStr] = match;

  return {
    year: parseInt(yearStr, 10),
    orderNumber,
    platformType: platformTypeRu === 'ПП' ? 'PP' : 'SK',
    platformNumber: parseInt(platformNumStr, 10),
    sampleNumber: parseInt(sampleNumStr, 10),
    sampleType: 'SOIL', // По умолчанию, тип не хранится в шифре
  };
}

/**
 * Генерация метки площадки
 * Пример: ПП1, СК2
 */
export function generatePlatformLabel(type: PlatformType, number: number): string {
  const prefix = type === 'PP' ? 'ПП' : 'СК';
  return `${prefix}${number}`;
}

